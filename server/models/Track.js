const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    trackingId: { type: String, required: true, unique: true },
    senderId: String,
    threadId: String,
    subject: String,
    recipient: String,
    status: { type: String, default: 'sent' },
    opens: [{
        timestamp: { type: Date, default: Date.now },
        ip: String,
        userAgent: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('Track', trackSchema);
