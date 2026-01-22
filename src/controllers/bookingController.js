const Booking = require('../models/Booking');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Public
const createBooking = async (req, res) => {
    try {
        console.log("Incoming Booking Data:", req.body); // Log the data
        const {
            guestName,
            guestPhone,
            checkIn,
            checkOut,
            roomType,
            guests,
            mealPlan,
            totalAmount,
            isGroupBooking
        } = req.body;

        // Basic validation
        if (!guestName || !checkIn || !checkOut || !totalAmount) {
            return res.status(400).json({ message: 'Please fill in all required fields' });
        }

        // Create new booking instance
        const booking = new Booking({
            guestName,
            guestPhone,
            checkIn,
            checkOut,
            roomType: isGroupBooking ? 'Full Resort' : roomType,
            isGroupBooking,
            guests,
            mealPlan,
            totalAmount
        });

        // Save to DB
        const savedBooking = await booking.save();

        res.status(201).json({
            success: true,
            data: savedBooking,
            message: 'Booking request sent successfully!'
        });

    } catch (error) {
        console.error('Error creating booking:', error); // Check server terminal
        res.status(500).json({
            success: false,
            message: error.message || String(error) || 'Server Error: Could not save booking.'
        });
    }
};

module.exports = { createBooking };
