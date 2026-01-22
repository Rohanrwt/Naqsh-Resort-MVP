# Naqsh Resort - Production Ready MVP

A boutique resort booking website for **Naqsh Resort**, Rishikesh.
**Status**: 🟢 Production Ready (MVP)

This project has been upgraded from a basic prototype to a secure, high-performance web application.

## 🚀 Quick Start

### 1. Run the Production Server
The project now uses a secure server file (`server-secure.js`) instead of the unsecured `server.js`.

```bash
# Start the secure server
node server-secure.js
```

### 2. Access the Website
- **Website**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin.html

### 3. Admin Login Credentials
To access the dashboard, use the following default credentials (change these in production!):

- **Username**: `admin`
- **Password**: `naqsh2025secure`

---

## ✨ Key Features

### 🔒 Security (New)
- **Admin Authentication**: Session-based login required for the dashboard.
- **Server-Side Pricing**: Prices are calculated on the server to prevent manipulation.
- **Input Validation**: All data (names, phones, dates) is validated before storage.
- **Rate Limiting**: Limits requests to 100/min per IP to prevent abuse.

### ⚡ Performance & SEO (New)
- **Gzip Compression**: Reduces file sizes by ~70% for faster loading.
- **Browser Caching**: Static assets (images, CSS) are cached for instant repeat visits.
- **SEO Optimized**: Sitemap, Robots.txt, and strict meta tags included for better Google ranking.

### 🏨 Core Functionality
- **Dynamic Booking Form**: Real-time price calculation for Weekdays vs Weekends.
- **Group Booking Mode**: Toggle to book the entire property (₹60,000/night).
- **WhatsApp Integration**: Sends booking details directly to the owner's WhatsApp.
- **Data Persistence**: Uses secure JSON file storage (with write locking) in `data/`.

---

## 📁 Project Structure

```
naqsh-resort-mvp/
├── server-secure.js    # 🟢 MAIN PRODUCTION SERVER
├── server.js           # 🔴 Legacy prototype (do not use)
├── .gitignore          # Git configuration (ignores sensitive data)
├── package.json        # Project metadata
├── data/               # 🔒 Database directory (Ignored by Git)
│   ├── bookings.json   # Stores reservations
│   └── sessions.json   # Stores active admin sessions
└── public/             # Frontend Assets
    ├── index.html      # Homepage
    ├── admin.html      # Admin Dashboard (Protected)
    ├── sitemap.xml     # SEO Sitemap
    ├── robots.txt      # Crawler instructions
    └── css/ & js/      # Styles and Scripts
```

---

## � Configuration (Environment Variables)

In a real production environment (e.g., VPS, Railway, Render), do not hardcode credentials. Set these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `ADMIN_USER` | Admin username | admin |
| `ADMIN_PASS` | Admin password | naqsh2025secure |

## 🔌 API Endpoints

The `server-secure.js` exposes the following JSON APIs:

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/bookings` | Public | Create new booking |
| POST | `/api/inquiries` | Public | Submit contact form |
| POST | `/api/calculate-price` | Public | Server-side price check |
| POST | `/api/auth/login` | Public | Admin login |
| GET | `/api/bookings` | **Admin** | List all bookings |
| PUT | `/api/bookings/:id` | **Admin** | Update status |

---

## 📞 Contact Support

**Naqsh Resort**
- 📍 Mohanchatti, Rishikesh
- 📞 +91 90454 67967

---
*Built with Node.js (No external dependencies required for `server-secure.js`)*
