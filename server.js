/**
 * NAQSH RESORT - MVP Server
 * Pure Node.js server with no external dependencies
 * Features: Static file serving, Booking API, JSON file-based storage
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize bookings file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: [], inquiries: [] }, null, 2));
}

// MIME types for static files
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

// Helper: Read JSON data
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { bookings: [], inquiries: [] };
    }
}

// Helper: Write JSON data
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper: Generate unique ID
function generateId() {
    return 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// Helper: Parse JSON body from request
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
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

// Helper: Send JSON response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

// Helper: Serve static file
function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found - try serving index.html for SPA-like behavior
                const indexPath = path.join(PUBLIC_DIR, 'index.html');
                fs.readFile(indexPath, (err2, indexData) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('404 Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexData);
                    }
                });
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        }
    });
}

// API Routes Handler
async function handleAPI(req, res, pathname) {
    const method = req.method;
    
    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    try {
        // Health check
        if (pathname === '/api/health') {
            sendJSON(res, 200, { 
                status: 'OK', 
                message: 'Naqsh Resort API is running',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Pricing config (for frontend)
        if (pathname === '/api/pricing' && method === 'GET') {
            sendJSON(res, 200, {
                success: true,
                pricing: {
                    group: { rate: 60000 },
                    rooms: {
                        "Deluxe Garden": { weekday: { ep: 1700, mapai: 2700 }, weekend: { ep: 2200, mapai: 3200 } },
                        "Premium Valley": { weekday: { ep: 2000, mapai: 3000 }, weekend: { ep: 2600, mapai: 3600 } },
                        "Family Suite": { weekday: { ep: 2700, mapai: 4300 }, weekend: { ep: 3500, mapai: 5500 } }
                    }
                }
            });
            return;
        }

        // Calculate price (server-side)
        if (pathname === '/api/calculate-price' && method === 'POST') {
            const body = await parseBody(req);
            const checkIn = body.checkIn;
            const checkOut = body.checkOut;
            const roomType = body.roomType || 'Deluxe Garden';
            const mealPlan = body.mealPlan || 'EP';
            const isGroup = body.isGroupBooking || false;
            
            const PRICING = {
                group: { rate: 60000 },
                rooms: {
                    "Deluxe Garden": { weekday: { ep: 1700, mapai: 2700 }, weekend: { ep: 2200, mapai: 3200 } },
                    "Premium Valley": { weekday: { ep: 2000, mapai: 3000 }, weekend: { ep: 2600, mapai: 3600 } },
                    "Family Suite": { weekday: { ep: 2700, mapai: 4300 }, weekend: { ep: 3500, mapai: 5500 } }
                }
            };
            
            if (!checkIn || !checkOut) {
                sendJSON(res, 400, { success: false, message: 'Invalid dates' });
                return;
            }
            
            const startDate = new Date(checkIn);
            const endDate = new Date(checkOut);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
                sendJSON(res, 400, { success: false, message: 'Invalid date range' });
                return;
            }
            
            let total = 0;
            const breakdown = [];
            
            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
                const dateStr = d.toISOString().split('T')[0];
                
                let rate = 0;
                if (isGroup) {
                    rate = PRICING.group.rate;
                } else {
                    const room = PRICING.rooms[roomType];
                    if (room) {
                        const planKey = mealPlan === 'MAPAI' ? 'mapai' : 'ep';
                        rate = isWeekend ? room.weekend[planKey] : room.weekday[planKey];
                    }
                }
                
                total += rate;
                breakdown.push({ date: dateStr, isWeekend, rate });
            }
            
            sendJSON(res, 200, {
                success: true,
                total,
                nights: breakdown.length,
                breakdown,
                roomType: isGroup ? 'Full Resort' : roomType,
                mealPlan: isGroup ? 'Included' : mealPlan
            });
            return;
        }

        // Create booking
        if (pathname === '/api/bookings' && method === 'POST') {
            const body = await parseBody(req);
            
            // Server-side price calculation
            const PRICING = {
                group: { rate: 60000 },
                rooms: {
                    "Deluxe Garden": { weekday: { ep: 1700, mapai: 2700 }, weekend: { ep: 2200, mapai: 3200 } },
                    "Premium Valley": { weekday: { ep: 2000, mapai: 3000 }, weekend: { ep: 2600, mapai: 3600 } },
                    "Family Suite": { weekday: { ep: 2700, mapai: 4300 }, weekend: { ep: 3500, mapai: 5500 } }
                }
            };
            
            const isGroup = body.isGroupBooking || false;
            const roomType = isGroup ? 'Full Resort' : (body.roomType || 'Deluxe Garden');
            const mealPlan = body.mealPlan || 'EP';
            
            // Calculate total server-side (never trust client!)
            let totalAmount = 0;
            let nights = 0;
            
            if (body.checkIn && body.checkOut) {
                const startDate = new Date(body.checkIn);
                const endDate = new Date(body.checkOut);
                
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate < endDate) {
                    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                        const dayOfWeek = d.getDay();
                        const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
                        
                        if (isGroup) {
                            totalAmount += PRICING.group.rate;
                        } else {
                            const room = PRICING.rooms[roomType];
                            if (room) {
                                const planKey = mealPlan === 'MAPAI' ? 'mapai' : 'ep';
                                totalAmount += isWeekend ? room.weekend[planKey] : room.weekday[planKey];
                            }
                        }
                        nights++;
                    }
                }
            }
            
            const data = readData();
            
            const booking = {
                id: generateId(),
                guestName: body.guestName || 'Guest',
                guestPhone: body.guestPhone || '',
                guestEmail: body.guestEmail || '',
                checkIn: body.checkIn,
                checkOut: body.checkOut,
                roomType: roomType,
                isGroupBooking: isGroup,
                guests: body.guests || 2,
                mealPlan: isGroup ? 'Included' : mealPlan,
                totalAmount: totalAmount, // Server-calculated!
                nights: nights,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                notes: body.notes || ''
            };
            
            data.bookings.push(booking);
            writeData(data);
            
            console.log(`[${new Date().toISOString()}] New booking created: ${booking.id} (₹${totalAmount})`);
            
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

        // Get all bookings (for admin)
        if (pathname === '/api/bookings' && method === 'GET') {
            const data = readData();
            sendJSON(res, 200, {
                success: true,
                count: data.bookings.length,
                data: data.bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            });
            return;
        }

        // Get single booking
        if (pathname.startsWith('/api/bookings/') && method === 'GET') {
            const id = pathname.split('/')[3];
            const data = readData();
            const booking = data.bookings.find(b => b.id === id);
            
            if (booking) {
                sendJSON(res, 200, { success: true, data: booking });
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }

        // Update booking status
        if (pathname.startsWith('/api/bookings/') && method === 'PUT') {
            const id = pathname.split('/')[3];
            const body = await parseBody(req);
            const data = readData();
            const index = data.bookings.findIndex(b => b.id === id);
            
            if (index !== -1) {
                data.bookings[index] = { ...data.bookings[index], ...body, updatedAt: new Date().toISOString() };
                writeData(data);
                sendJSON(res, 200, { success: true, data: data.bookings[index] });
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }

        // Delete booking
        if (pathname.startsWith('/api/bookings/') && method === 'DELETE') {
            const id = pathname.split('/')[3];
            const data = readData();
            const index = data.bookings.findIndex(b => b.id === id);
            
            if (index !== -1) {
                data.bookings.splice(index, 1);
                writeData(data);
                sendJSON(res, 200, { success: true, message: 'Booking deleted' });
            } else {
                sendJSON(res, 404, { success: false, message: 'Booking not found' });
            }
            return;
        }

        // Contact form / Inquiry
        if (pathname === '/api/inquiries' && method === 'POST') {
            const body = await parseBody(req);
            const data = readData();
            
            const inquiry = {
                id: 'INQ' + Date.now().toString(36).toUpperCase(),
                name: body.name || 'Guest',
                phone: body.phone || '',
                email: body.email || '',
                inquiryType: body.inquiryType || 'General',
                message: body.message || '',
                status: 'New',
                createdAt: new Date().toISOString()
            };
            
            data.inquiries.push(inquiry);
            writeData(data);
            
            console.log(`[${new Date().toISOString()}] New inquiry received: ${inquiry.id}`);
            
            sendJSON(res, 201, {
                success: true,
                data: inquiry,
                message: 'Thank you for your message! We will get back to you soon.'
            });
            return;
        }

        // Get all inquiries (for admin)
        if (pathname === '/api/inquiries' && method === 'GET') {
            const data = readData();
            sendJSON(res, 200, {
                success: true,
                count: data.inquiries.length,
                data: data.inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            });
            return;
        }

        // Check room availability
        if (pathname === '/api/availability' && method === 'POST') {
            const body = await parseBody(req);
            const { checkIn, checkOut, roomType } = body;
            const data = readData();
            
            // Check for conflicts (simplified logic)
            const conflictingBookings = data.bookings.filter(booking => {
                if (booking.status === 'Cancelled') return false;
                if (roomType && booking.roomType !== roomType) return false;
                
                const bookingStart = new Date(booking.checkIn);
                const bookingEnd = new Date(booking.checkOut);
                const requestStart = new Date(checkIn);
                const requestEnd = new Date(checkOut);
                
                return (requestStart < bookingEnd && requestEnd > bookingStart);
            });
            
            const isAvailable = conflictingBookings.length === 0;
            
            sendJSON(res, 200, {
                success: true,
                available: isAvailable,
                message: isAvailable ? 'Rooms available for your dates!' : 'Some rooms may not be available. Please contact us.',
                conflicts: conflictingBookings.length
            });
            return;
        }

        // Stats endpoint (for admin dashboard)
        if (pathname === '/api/stats' && method === 'GET') {
            const data = readData();
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
                    totalInquiries: data.inquiries.length,
                    newInquiries: data.inquiries.filter(i => i.status === 'New').length,
                    thisMonthBookings: thisMonth.length,
                    thisMonthRevenue: thisMonth.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
                }
            });
            return;
        }

        // 404 for unknown API routes
        sendJSON(res, 404, { success: false, message: 'API endpoint not found' });
        
    } catch (error) {
        console.error('API Error:', error);
        sendJSON(res, 500, { success: false, message: 'Server error: ' + error.message });
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Handle API routes
    if (pathname.startsWith('/api/')) {
        await handleAPI(req, res, pathname);
        return;
    }
    
    // For non-API paths, only allow GET (POST to root should redirect)
    if (req.method === 'POST') {
        // Redirect POST to root back to GET (happens when form submits before JS loads)
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return;
    }
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }
    
    // Serve static files
    // Remove trailing slash
    if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
    }
    
    // Default to index.html for root
    if (pathname === '/') {
        pathname = '/index.html';
    }
    
    // Add .html extension if no extension and file exists
    let filePath = path.join(PUBLIC_DIR, pathname);
    if (!path.extname(pathname) && !fs.existsSync(filePath)) {
        const withHtml = filePath + '.html';
        if (fs.existsSync(withHtml)) {
            filePath = withHtml;
        }
    }
    
    serveStaticFile(res, filePath);
});

// Start server
server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   NAQSH RESORT - Server Started');
    console.log('========================================');
    console.log(`   🌐 URL: http://localhost:${PORT}`);
    console.log(`   📁 Serving: ${PUBLIC_DIR}`);
    console.log(`   💾 Data: ${DATA_FILE}`);
    console.log('========================================\n');
    console.log('   API Endpoints:');
    console.log('   POST /api/bookings     - Create booking');
    console.log('   GET  /api/bookings     - List all bookings');
    console.log('   GET  /api/bookings/:id - Get single booking');
    console.log('   PUT  /api/bookings/:id - Update booking');
    console.log('   POST /api/inquiries    - Submit inquiry');
    console.log('   POST /api/availability - Check availability');
    console.log('   GET  /api/stats        - Get statistics');
    console.log('   GET  /api/health       - Health check');
    console.log('========================================\n');
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port.`);
    } else {
        console.error('Server error:', error);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
