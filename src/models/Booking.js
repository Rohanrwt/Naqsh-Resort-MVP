const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    guestName: {
        type: String,
        required: true
    },
    guestPhone: {
        type: String,
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: {
        type: Date,
        required: true
    },
    roomType: {
        type: String,
        required: true
    },
    isGroupBooking: {
        type: Boolean,
        default: false
    },
    guests: {
        type: Number,
        required: true
    },
    mealPlan: {
        type: String, // 'EP' or 'MAPAI'
        default: 'EP'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
