# Naqsh Resort - Production-Ready MVP Website

A boutique resort booking website for **Naqsh Resort**, a 12-room property in Mohanchatti, Rishikesh.

This package includes **two server versions**:
- `server.js` - Simple MVP for quick testing
- `server-secure.js` - **Production-ready** with full security features

---

## 🚀 Quick Start

### Requirements
- Node.js v14+ (no npm install needed!)

### Run Production Server (Recommended)

```bash
cd naqsh-resort-mvp
node server-secure.js
```

Then open:
- **Website:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin.html

**Default Admin Login:**
- Username: `admin`
- Password: `naqsh2025secure`

⚠️ **Change these credentials before deploying!**

---

## 🔐 Security Features (server-secure.js)

| Feature | Description |
|---------|-------------|
| **Admin Authentication** | Login required for dashboard & data access |
| **Server-Side Pricing** | Price calculated server-side (never trust client) |
| **Input Validation** | All inputs validated for type, length, format |
| **Input Sanitization** | XSS prevention, dangerous chars removed |
| **Rate Limiting** | 100 requests/minute per IP |
| **Async I/O** | Non-blocking file operations |
| **Write Locking** | Prevents race conditions on concurrent writes |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, etc. |
| **Request Logging** | JSON-formatted logs for monitoring |

---

## 📁 Project Structure

```
naqsh-resort-mvp/
├── server.js           # Basic MVP server
├── server-secure.js    # Production server with security
├── package.json        # Project metadata
├── data/
│   ├── bookings.json   # Bookings & inquiries
│   └── sessions.json   # Admin sessions (auto-created)
├── public/
│   ├── index.html      # Homepage
│   ├── rooms.html      # Room listings
│   ├── group-booking.html
│   ├── contact.html    # Contact page
│   ├── admin.html      # Admin dashboard (protected)
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
└── src/                # Original backend reference
```

---

## 🔌 API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/pricing` | Get pricing configuration |
| POST | `/api/calculate-price` | Calculate price (server-side) |
| POST | `/api/bookings` | Create booking (price calculated by server) |
| POST | `/api/inquiries` | Submit contact form |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/logout` | Admin logout |
| GET | `/api/auth/check` | Check auth status |

### Protected Endpoints (Require Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List all bookings |
| GET | `/api/bookings/:id` | Get single booking |
| PUT | `/api/bookings/:id` | Update booking status |
| DELETE | `/api/bookings/:id` | Delete booking |
| GET | `/api/inquiries` | List all inquiries |
| GET | `/api/stats` | Dashboard statistics |

---

## 🛡️ Security Audit Compliance

This version addresses all critical issues from the production audit:

### ✅ Fixed: Zero Authentication on Admin
```
Before: /admin.html accessible to anyone
After:  Login required, JWT-like session tokens
```

### ✅ Fixed: Client-Side Price Trust
```
Before: Server accepted totalAmount from client
After:  Server calculates price from dates/room/plan
```

### ✅ Fixed: Missing Input Validation
```
Before: Accepted any JSON without validation
After:  Validates type, length, format, sanitizes strings
```

### ✅ Fixed: Synchronous Blocking I/O
```
Before: fs.readFileSync blocked event loop
After:  fs.promises with async/await
```

### ✅ Fixed: Race Conditions
```
Before: Concurrent writes could corrupt data
After:  Simple write locking mechanism
```

---

## ⚙️ Configuration

Edit the `CONFIG` object in `server-secure.js`:

```javascript
const CONFIG = {
    PORT: process.env.PORT || 3000,
    
    // Change these in production!
    ADMIN_USERNAME: process.env.ADMIN_USER || 'admin',
    ADMIN_PASSWORD: process.env.ADMIN_PASS || 'naqsh2025secure',
    
    // Session expires after 24 hours
    SESSION_EXPIRY_HOURS: 24,
    
    // Rate limiting
    RATE_LIMIT_MAX_REQUESTS: 100, // per minute
    
    // Pricing (edit as needed)
    PRICING: {
        group: { rate: 60000 },
        rooms: { ... }
    }
};
```

### Environment Variables
```bash
# Set these for production
export PORT=3000
export ADMIN_USER=your_admin_username
export ADMIN_PASS=your_secure_password
```

---

## 💰 Room Pricing

| Room Type | Capacity | Weekday | Weekend | With Meals |
|-----------|----------|---------|---------|------------|
| Deluxe Garden | 2 guests | ₹1,700 | ₹2,200 | +₹1,000 |
| Premium Valley | 2 guests | ₹2,000 | ₹2,600 | +₹1,000 |
| Family Suite | 4 guests | ₹2,700 | ₹3,500 | +₹1,600 |
| **Full Resort** | 30 guests | ₹60,000/night | - | Included |

---

## 🚀 Deployment Checklist

### Before Going Live:

- [ ] Change admin username and password
- [ ] Set credentials via environment variables
- [ ] Test all booking flows
- [ ] Review rate limit settings
- [ ] Set up HTTPS (use nginx + Let's Encrypt)
- [ ] Use PM2 for process management
- [ ] Set up log rotation
- [ ] Configure firewall

### Recommended Stack:
```
┌─────────────────┐
│   Cloudflare    │  (DDoS protection, SSL)
└────────┬────────┘
         │
┌────────▼────────┐
│     Nginx       │  (Reverse proxy, HTTPS)
└────────┬────────┘
         │
┌────────▼────────┐
│   PM2 + Node    │  (Process management)
└────────┬────────┘
         │
┌────────▼────────┐
│  server-secure  │  (This application)
└─────────────────┘
```

### PM2 Setup:
```bash
npm install -g pm2
pm2 start server-secure.js --name naqsh-resort
pm2 save
pm2 startup
```

---

## 📋 Future Improvements

### Recommended Upgrades:
- [ ] **Database:** Migrate to SQLite/MongoDB for better concurrency
- [ ] **Email notifications:** Add Nodemailer for booking confirmations
- [ ] **Payment integration:** Razorpay for advance payments
- [ ] **Calendar view:** Visual availability calendar
- [ ] **Proper password hashing:** Use bcrypt instead of SHA256
- [ ] **CSRF tokens:** Add for form protection

---

## 📞 Contact

**Naqsh Resort**
- 📍 Mohanchatti, Rishikesh, Uttarakhand
- 📞 +91 90454 67967
- 📧 stay@naqshresort.com

---

## 📄 License

Proprietary - Naqsh Resort. All rights reserved.

---

*Production-ready MVP with security hardening. Zero external dependencies.*
