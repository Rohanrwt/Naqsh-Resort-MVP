/**
 * NAQSH RESORT - Production-Ready Server
 * Security Hardened Version
 * 
 * Features:
 * - Admin authentication (JWT-like session tokens)
 * - Server-side price calculation (never trust client)
 * - Input validation & sanitization
 * - Async file I/O (non-blocking)
 * - Rate limiting
 * - Security headers
 * - Request logging
 */

const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    PORT: process.env.PORT || 3000,
    PUBLIC_DIR: path.join(__dirname, 'public'),
    DATA_FILE: path.join(__dirname, 'data', 'bookings.json'),
    SESSIONS_FILE: path.join(__dirname, 'data', 'sessions.json'),
    
    // Admin credentials (in production, use environment variables!)
    ADMIN_USERNAME: process.env.ADMIN_USER || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASS || 'naqsh2025secure',
    
    // Session settings
    SESSION_EXPIRY_HOURS: 24,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 100,
    
    // Pricing (SINGLE SOURCE OF TRUTH - server-side only)
    PRICING: {
        group: { 
            rate: 60000, 
            inclusions: "Bonfire, BBQ, Music Night",
            maxGuests: 30
        },
        rooms: {
            "Deluxe Garden": {
                weekday: { ep: 1700, mapai: 2700 },
                weekend: { ep: 2200, mapai: 3200 },
                maxGuests: 2
            },
            "Premium Valley": {
                weekday: { ep: 2000, mapai: 3000 },
                weekend: { ep: 2600, mapai: 3600 },
                maxGuests: 2
            },
            "Family Suite": {
                weekday: { ep: 2700, mapai: 4300 },
                weekend: { ep: 3500, mapai: 5500 },
                maxGuests: 4
            }
        }
    }
};

// ============================================
// MIME TYPES
// ============================================
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// ============================================
// RATE LIMITING (In-Memory)
// ============================================
const rateLimitStore = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW_MS;
    
    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, []);
    }
    
    const requests = rateLimitStore.get(ip).filter(time => time > windowStart);
    requests.push(now);
    rateLimitStore.set(ip, requests);
    
    return requests.length > CONFIG.RATE_LIMIT_MAX_REQUESTS;
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const windowStart = Date.now() - CONFIG.RATE_LIMIT_WINDOW_MS;
    for (const [ip, requests] of rateLimitStore.entries()) {
        const valid = requests.filter(time => time > windowStart);
        if (valid.length === 0) {
            rateLimitStore.delete(ip);
        } else {
            rateLimitStore.set(ip, valid);
        }
    }
}, 60000);

// ============================================
// DATA STORAGE (Async with Locking)
// ============================================
let dataLock = Promise.resolve();

async function ensureDataFiles() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (e) {}
    
    try {
        await fs.access(CONFIG.DATA_FILE);
    } catch {
        await fs.writeFile(CONFIG.DATA_FILE, JSON.stringify({ bookings: [], inquiries: [] }, null, 2));
    }
    
    try {
        await fs.access(CONFIG.SESSIONS_FILE);
    } catch {
        await fs.writeFile(CONFIG.SESSIONS_FILE, JSON.stringify({ sessions: [] }, null, 2));
    }
}

async function readData() {
    try {
        const data = await fs.readFile(CONFIG.DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data:', error);
        return { bookings: [], inquiries: [] };
    }
}

async function writeData(data) {
    // Simple lock to prevent race conditions
    const previousLock = dataLock;
    let resolveLock;
    dataLock = new Promise(resolve => { resolveLock = resolve; });
    
    await previousLock;
    try {
        await fs.writeFile(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
    } finally {
        resolveLock();
    }
}

async function readSessions() {
    try {
        const data = await fs.readFile(CONFIG.SESSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { sessions: [] };
    }
}

async function writeSessions(data) {
    await fs.writeFile(CONFIG.SESSIONS_FILE, JSON.stringify(data, null, 2));
}

// ============================================
// INPUT VALIDATION
// ============================================
const Validator = {
    isString(value, minLen = 0, maxLen = 1000) {
        return typeof value === 'string' && value.length >= minLen && value.length <= maxLen;
    },
    
    isPhone(value) {
        if (!this.isString(value, 6, 20)) return false;
        // Allow digits, spaces, +, -
        return /^[\d\s+\-()]+$/.test(value);
    },
    
    isEmail(value) {
        if (!value) return true; // Optional
        if (!this.isString(value, 0, 100)) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    
    isDate(value) {
        if (!this.isString(value, 10, 10)) return false;
        const date = new Date(value);
        return !isNaN(date.getTime());
    },
    
    isNumber(value, min = 0, max = Infinity) {
        const num = Number(value);
        return !isNaN(num) && num >= min && num <= max;
    },
    
    isRoomType(value) {
        return Object.keys(CONFIG.PRICING.rooms).includes(value) || value === 'Full Resort';
    },
    
    isMealPlan(value) {
        return ['EP', 'MAPAI'].includes(value);
    },
    
    isBookingStatus(value) {
        return ['Pending', 'Confirmed', 'Cancelled'].includes(value);
    },
    
    sanitizeString(value) {
        if (typeof value !== 'string') return '';
        // Remove potentially dangerous characters while keeping basic punctuation
        return value.replace(/[<>]/g, '').trim().substring(0, 1000);
    }
};

// ============================================
// PRICE CALCULATION (Server-Side Only!)
// ============================================
function calculatePrice(checkIn, checkOut, roomType, mealPlan, isGroupBooking) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { error: 'Invalid dates' };
    }
    
    if (startDate >= endDate) {
        return { error: 'Check-out must be after check-in' };
    }
    
    let total = 0;
    const breakdown = [];
    
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Fri & Sat
        const dateStr = d.toISOString().split('T')[0];
        
        let nightlyRate = 0;
        
        if (isGroupBooking) {
            nightlyRate = CONFIG.PRICING.group.rate;
        } else {
            const room = CONFIG.PRICING.rooms[roomType];
            if (!room) {
                return { error: `Invalid room type: ${roomType}` };
            }
            
            const planKey = mealPlan === 'MAPAI' ? 'mapai' : 'ep';
            nightlyRate = isWeekend ? room.weekend[planKey] : room.weekday[planKey];
        }
        
        total += nightlyRate;
        breakdown.push({
            date: dateStr,
            isWeekend,
            rate: nightlyRate
        });
    }
    
    return {
        total,
        nights: breakdown.length,
        breakdown,
        roomType: isGroupBooking ? 'Full Resort' : roomType,
        mealPlan: isGroupBooking ? 'Included' : mealPlan
    };
}

// ============================================
// AUTHENTICATION
// ============================================
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'naqsh_salt_2025').digest('hex');
}

async function createSession(username) {
    const token = generateToken();
    const expiresAt = Date.now() + (CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    
    const sessions = await readSessions();
    // Clean expired sessions
    sessions.sessions = sessions.sessions.filter(s => s.expiresAt > Date.now());
    // Add new session
    sessions.sessions.push({ token, username, expiresAt, createdAt: Date.now() });
    await writeSessions(sessions);
    
    return token;
}

async function validateSession(token) {
    if (!token) return null;
    
    const sessions = await readSessions();
    const session = sessions.sessions.find(s => s.token === token && s.expiresAt > Date.now());
    return session || null;
}

async function deleteSession(token) {
    const sessions = await readSessions();
    sessions.sessions = sessions.sessions.filter(s => s.token !== token);
    await writeSessions(sessions);
}

function getTokenFromRequest(req) {
    // Check Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Check cookie
    const cookies = req.headers.cookie;
    if (cookies) {
        const match = cookies.match(/admin_token=([^;]+)/);
        if (match) return match[1];
    }
    
    return null;
}

// ============================================
// HELPERS
// ============================================
function generateId(prefix = 'BK') {
    return prefix + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        const maxSize = 1024 * 1024; // 1MB limit
        
        req.on('data', chunk => {
            size += chunk.length;
            if (size > maxSize) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Cache-Control': 'no-store'
    });
    res.end(body);
}


const zlib = require('zlib');

async function serveStaticFile(res, req, filePath) {
    // Prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(CONFIG.PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    try {
        const stats = await fs.stat(filePath);
        const fileContent = await fs.readFile(filePath);
        
        // Cache Headers
        const isImmutable = ['.css', '.js', '.jpg', '.png', '.webp', '.woff2'].includes(ext);
        const cacheControl = isImmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
        const etag = `"${stats.size}-${stats.mtimeMs}"`;
        
        // Handle 304 Not Modified
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304, {
                'ETag': etag,
                'Cache-Control': cacheControl
            });
            res.end();
            return;
        }

        const headers = {
            'Content-Type': mimeType,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': cacheControl,
            'ETag': etag,
            'Vary': 'Accept-Encoding'
        };

        // Gzip Compression
        const acceptEncoding = req.headers['accept-encoding'] || '';
        if (/\bgzip\b/.test(acceptEncoding) && ['.html', '.css', '.js', '.json', '.svg'].includes(ext)) {
            zlib.gzip(fileContent, (err, buffer) => {
                if (!err) {
                    headers['Content-Encoding'] = 'gzip';
                    headers['Content-Length'] = buffer.length;
                    res.writeHead(200, headers);
                    res.end(buffer);
                } else {
                    // Fallback to uncompressed
                    res.writeHead(200, headers);
                    res.end(fileContent);
                }
            });
        } else {
            res.writeHead(200, headers);
            res.end(fileContent);
        }

    } catch (err) {
        if (err.code === 'ENOENT') {
            // Try serving index.html for SPA behavior
            try {
                // Recursive call for index.html (simplified, no recursion infinite loop risk here)
                const indexData = await fs.readFile(path.join(CONFIG.PUBLIC_DIR, 'index.html'));
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(indexData);
            } catch {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            }
        } else {
            console.error('File Error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error');
        }
    }
}


function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.connection?.remoteAddress || 
           'unknown';
}

function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    console.log(JSON.stringify(logEntry));
}

// ============================================
// API HANDLERS
// ============================================
async function handleAPI(req, res, pathname) {
    const method = req.method;
    const ip = getClientIP(req);
    
    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }
    
    try {
        // ==================
        // PUBLIC ENDPOINTS
        // ==================
        
        // Health check
        if (pathname === '/api/health') {
            sendJSON(res, 200, { 
                status: 'OK', 
                message: 'Naqsh Resort API is running',
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        // Get pricing (public - for frontend)
        if (pathname === '/api/pricing' && method === 'GET') {
            sendJSON(res, 200, {
                success: true,
                pricing: CONFIG.PRICING
            });
            return;
        }
        
        // Calculate price (server-side calculation)
        if (pathname === '/api/calculate-price' && method === 'POST') {
            const body = await parseBody(req);
            
            if (!Validator.isDate(body.checkIn) || !Validator.isDate(body.checkOut)) {
                sendJSON(res, 400, { success: false, message: 'Invalid dates' });
                return;
            }
            
            const result = calculatePrice(
                body.checkIn,
                body.checkOut,
                body.roomType || 'Deluxe Garden',
                body.mealPlan || 'EP',
                body.isGroupBooking || false
            );
            
            if (result.error) {
                sendJSON(res, 400, { success: false, message: result.error });
                return;
            }
            
            sendJSON(res, 200, { success: true, ...result });
            return;
        }
        
        // Create booking (PUBLIC - but with server-side validation)
        if (pathname === '/api/bookings' && method === 'POST') {
            const body = await parseBody(req);
            
            // Validate required fields
            if (!Validator.isString(body.guestName, 2, 100)) {
                sendJSON(res, 400, { success: false, message: 'Valid guest name is required (2-100 chars)' });
                return;
            }
            if (!Validator.isPhone(body.guestPhone)) {
                sendJSON(res, 400, { success: false, message: 'Valid phone number is required' });
                return;
            }
            if (!Validator.isDate(body.checkIn) || !Validator.isDate(body.checkOut)) {
                sendJSON(res, 400, { success: false, message: 'Valid check-in and check-out dates required' });
                return;
            }
            
            // Validate dates are in the future
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (new Date(body.checkIn) < today) {
                sendJSON(res, 400, { success: false, message: 'Check-in date must be today or later' });
                return;
            }
            
            const isGroupBooking = body.isGroupBooking === true;
            const roomType = isGroupBooking ? 'Full Resort' : Validator.sanitizeString(body.roomType);
            const mealPlan = Validator.isMealPlan(body.mealPlan) ? body.mealPlan : 'EP';
            
            // Validate room type for non-group bookings
            if (!isGroupBooking && !Validator.isRoomType(roomType)) {
                sendJSON(res, 400, { success: false, message: 'Invalid room type' });
                return;
            }
            
            // SERVER-SIDE PRICE CALCULATION (never trust client!)
            const priceResult = calculatePrice(
                body.checkIn,
                body.checkOut,
                roomType,
                mealPlan,
                isGroupBooking
            );
            
            if (priceResult.error) {
                sendJSON(res, 400, { success: false, message: priceResult.error });
                return;
            }
            
            const data = await readData();
            
            const booking = {
                id: generateId('BK'),
                guestName: Validator.sanitizeString(body.guestName),
                guestPhone: Validator.sanitizeString(body.guestPhone),
                guestEmail: Validator.sanitizeString(body.guestEmail || ''),
                checkIn: body.checkIn,
                checkOut: body.checkOut,
                roomType: priceResult.roomType,
                isGroupBooking,
                guests: Validator.isNumber(body.guests, 1, 30) ? parseInt(body.guests) : 2,
                mealPlan: priceResult.mealPlan,
                totalAmount: priceResult.total, // Server-calculated!
                nights: priceResult.nights,
                priceBreakdown: priceResult.breakdown,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                ip: ip,
                notes: Validator.sanitizeString(body.notes || '')
            };
            
            data.bookings.push(booking);
            await writeData(data);
            
            log('info', 'Booking created', { bookingId: booking.id, ip });
            
            sendJSON(res, 201, {
                success: true,
                data: {
                    id: booking.id,
                    totalAmount: booking.totalAmount,
                    nights: booking.nights,
                    roomType: booking.roomType
                },
                message: 'Booking request received! We will contact you shortly.'
            });
            return;
        }
        
        // Create inquiry (PUBLIC)
        if (pathname === '/api/inquiries' && method === 'POST') {
            const body = await parseBody(req);
            
            if (!Validator.isString(body.name, 2, 100)) {
                sendJSON(res, 400, { success: false, message: 'Valid name is required' });
                return;
            }
            if (!Validator.isPhone(body.phone)) {
                sendJSON(res, 400, { success: false, message: 'Valid phone number is required' });
                return;
            }
            if (!Validator.isString(body.message, 10, 2000)) {
                sendJSON(res, 400, { success: false, message: 'Message must be 10-2000 characters' });
                return;
            }
            
            const data = await readData();
            
            const inquiry = {
                id: generateId('INQ'),
                name: Validator.sanitizeString(body.name),
                phone: Validator.sanitizeString(body.phone),
                email: Validator.sanitizeString(body.email || ''),
                inquiryType: Validator.sanitizeString(body.inquiryType || 'General'),
                message: Validator.sanitizeString(body.message),
                status: 'New',
                createdAt: new Date().toISOString(),
                ip: ip
            };
            
            data.inquiries.push(inquiry);
            await writeData(data);
            
            log('info', 'Inquiry created', { inquiryId: inquiry.id, ip });
            
            sendJSON(res, 201, {
                success: true,
                data: { id: inquiry.id },
                message: 'Thank you for your message! We will get back to you soon.'
            });
            return;
        }
        
        // ==================
        // AUTHENTICATION
        // ==================
        
        // Admin login
        if (pathname === '/api/auth/login' && method === 'POST') {
            const body = await parseBody(req);
            
            const username = body.username || '';
            const password = body.password || '';
            
            // Simple credential check (in production, use proper hashing)
            if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
                const token = await createSession(username);
                
                log('info', 'Admin login successful', { username, ip });
                
                sendJSON(res, 200, {
                    success: true,
                    token,
                    message: 'Login successful',
                    expiresIn: CONFIG.SESSION_EXPIRY_HOURS * 60 * 60
                });
            } else {
                log('warn', 'Admin login failed', { username, ip });
                sendJSON(res, 401, { success: false, message: 'Invalid credentials' });
            }
            return;
        }
        
        // Admin logout
        if (pathname === '/api/auth/logout' && method === 'POST') {
            const token = getTokenFromRequest(req);
            if (token) {
                await deleteSession(token);
            }
            sendJSON(res, 200, { success: true, message: 'Logged out' });
            return;
        }
        
        // Check auth status
        if (pathname === '/api/auth/check' && method === 'GET') {
            const token = getTokenFromRequest(req);
            const session = await validateSession(token);
            
            if (session) {
                sendJSON(res, 200, { success: true, authenticated: true, username: session.username });
            } else {
                sendJSON(res, 200, { success: true, authenticated: false });
            }
            return;
        }
        
        // ==================
        // PROTECTED ENDPOINTS (Require Authentication)
        // ==================
        
        const token = getTokenFromRequest(req);
        const session = await validateSession(token);
        
        // Check if protected endpoint
        const protectedPaths = [
            '/api/bookings',
            '/api/inquiries', 
            '/api/stats'
        ];
        
        const isProtectedGET = protectedPaths.some(p => pathname.startsWith(p)) && method === 'GET';
        const isProtectedPUT = pathname.startsWith('/api/bookings/') && method === 'PUT';
        const isProtectedDELETE = pathname.startsWith('/api/bookings/') && method === 'DELETE';
        
        if ((isProtectedGET || isProtectedPUT || isProtectedDELETE) && !session) {
            sendJSON(res, 401, { success: false, message: 'Authentication required' });
            return;
        }
        
        // Get all bookings (PROTECTED)
        if (pathname === '/api/bookings' && method === 'GET') {
            const data = await readData();
            sendJSON(res, 200, {
                success: true,
                count: data.bookings.length,
                data: data.bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            });
            return;
        }
        
        // Get single booking (PROTECTED)
        if (pathname.match(/^\/api\/bookings\/[A-Z0-9]+$/) && method === 'GET') {
            const id = pathname.split('/')[3];
            const data = await readData();
            const booking = data.bookings.find(b => b.id === id);
            
            if (booking) {
                sendJSON(res, 200, { success: true, data: booking });
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }
        
        // Update booking (PROTECTED)
        if (pathname.match(/^\/api\/bookings\/[A-Z0-9]+$/) && method === 'PUT') {
            const id = pathname.split('/')[3];
            const body = await parseBody(req);
            const data = await readData();
            const index = data.bookings.findIndex(b => b.id === id);
            
            if (index !== -1) {
                // Only allow status update
                if (body.status && Validator.isBookingStatus(body.status)) {
                    data.bookings[index].status = body.status;
                    data.bookings[index].updatedAt = new Date().toISOString();
                    data.bookings[index].updatedBy = session.username;
                    await writeData(data);
                    
                    log('info', 'Booking updated', { bookingId: id, status: body.status, by: session.username });
                    
                    sendJSON(res, 200, { success: true, data: data.bookings[index] });
                } else {
                    sendJSON(res, 400, { success: false, message: 'Invalid status' });
                }
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }
        
        // Delete booking (PROTECTED)
        if (pathname.match(/^\/api\/bookings\/[A-Z0-9]+$/) && method === 'DELETE') {
            const id = pathname.split('/')[3];
            const data = await readData();
            const index = data.bookings.findIndex(b => b.id === id);
            
            if (index !== -1) {
                data.bookings.splice(index, 1);
                await writeData(data);
                
                log('info', 'Booking deleted', { bookingId: id, by: session.username });
                
                sendJSON(res, 200, { success: true, message: 'Booking deleted' });
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }
        
        // Get all inquiries (PROTECTED)
        if (pathname === '/api/inquiries' && method === 'GET') {
            const data = await readData();
            sendJSON(res, 200, {
                success: true,
                count: data.inquiries.length,
                data: data.inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            });
            return;
        }
        
        // Get stats (PROTECTED)
        if (pathname === '/api/stats' && method === 'GET') {
            const data = await readData();
            const now = new Date();
            const thisMonth = data.bookings.filter(b => {
                const created = new Date(b.createdAt);
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            });
            
            sendJSON(res, 200, {
                success: true,
                stats: {
                    totalBookings: data.bookings.length,
                    pendingBookings: data.bookings.filter(b => b.status === 'Pending').length,
                    confirmedBookings: data.bookings.filter(b => b.status === 'Confirmed').length,
                    cancelledBookings: data.bookings.filter(b => b.status === 'Cancelled').length,
                    totalInquiries: data.inquiries.length,
                    newInquiries: data.inquiries.filter(i => i.status === 'New').length,
                    thisMonthBookings: thisMonth.length,
                    thisMonthRevenue: thisMonth.filter(b => b.status !== 'Cancelled').reduce((sum, b) => sum + (b.totalAmount || 0), 0)
                }
            });
            return;
        }
        
        // 404 for unknown API routes
        sendJSON(res, 404, { success: false, message: 'API endpoint not found' });
        
    } catch (error) {
        log('error', 'API Error', { error: error.message, pathname, method });
        sendJSON(res, 500, { success: false, message: 'Server error' });
    }
}

// ============================================
// REQUEST HANDLER
// ============================================
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    const ip = getClientIP(req);
    
    // Rate limiting
    if (isRateLimited(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
        return;
    }
    
    log('debug', 'Request', { method: req.method, path: pathname, ip });
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
        await handleAPI(req, res, pathname);
        return;
    }
    
    // Only allow GET for static files
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }
    
    // Normalize pathname
    if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
    }
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Add .html extension if needed
    let filePath = path.join(CONFIG.PUBLIC_DIR, pathname);
    if (!path.extname(pathname)) {
        const withHtml = filePath + '.html';
        try {
            await fs.access(withHtml);
            filePath = withHtml;
        } catch {}
    }
    
    await serveStaticFile(res, req, filePath);
}

// ============================================
// SERVER STARTUP
// ============================================
const server = http.createServer(handleRequest);

async function start() {
    await ensureDataFiles();
    
    server.listen(CONFIG.PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log('   NAQSH RESORT - Production Server');
        console.log('='.repeat(50));
        console.log(`   🌐 URL: http://localhost:${CONFIG.PORT}`);
        console.log(`   📁 Static: ${CONFIG.PUBLIC_DIR}`);
        console.log(`   💾 Data: ${CONFIG.DATA_FILE}`);
        console.log('='.repeat(50));
        console.log('   🔐 Security Features:');
        console.log('   ✓ Admin authentication required');
        console.log('   ✓ Server-side price calculation');
        console.log('   ✓ Input validation & sanitization');
        console.log('   ✓ Rate limiting (100 req/min)');
        console.log('   ✓ Async I/O with write locking');
        console.log('='.repeat(50));
        console.log('   📋 Admin Login:');
        console.log(`   Username: ${CONFIG.ADMIN_USERNAME}`);
        console.log(`   Password: ${CONFIG.ADMIN_PASSWORD}`);
        console.log('   (Change these in production!)');
        console.log('='.repeat(50) + '\n');
    });
}

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${CONFIG.PORT} is already in use.`);
    } else {
        console.error('Server error:', error);
    }
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
});

start();
