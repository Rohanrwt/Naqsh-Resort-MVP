const express = require('express');
const cors = require('cors'); // Added this
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');

// Connect Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Middleware
app.use(express.json());

// Routes
app.use('/api/bookings', require('./routes/bookingRoutes'));

// Serve Static Files (The Frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Basic API Route (Test)
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Naqsh Backend is running' });
});

// Fallback: Send index.html for any other route (good for SPAs, though this is currently multi-page)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, '../public')}`);
});
