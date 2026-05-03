const Track = require('../models/Track');
const { notifyAll } = require('../websocket');

// @desc    Serve tracking pixel and log open event
// @route   GET /t/:id
exports.trackPixel = async (req, res) => {
    const trackingId = req.params.id;
    const sid = req.query.sid;
    
    try {
        // Atomic Upsert: If not exists, create with 'sent' status.
        let track = await Track.findOneAndUpdate(
            { trackingId },
            { 
                $setOnInsert: { 
                    trackingId, 
                    senderId: sid, 
                    status: 'sent',
                    opens: [] 
                } 
            },
            { upsert: true, new: true }
        );

        // Check if this hit should mark it as read
        // It's a real open if:
        // 1. There's no sid (likely recipient) OR sid doesn't match senderId
        if (sid && track.senderId === sid) {
            console.log('Self-open detected, ignoring...');
        } else {
            // INSTANT NOTIFICATION (Before DB Save to match Mailsuite speed)
            notifyAll({
                type: 'OPENED',
                trackingId: track.trackingId,
                subject: track.subject,
                recipient: track.recipient
            });

            // Async DB update
            track.status = 'read';
            track.opens.push({
                timestamp: new Date(),
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            await track.save();
            
            console.log('Email marked as READ and notified (INSTANT MODE)');
        }
    } catch (err) {
        console.error('Error tracking pixel:', err);
    }

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.end(pixel);
};

// @desc    Get status of an email
// @route   GET /status/:idOrSubject
exports.getStatus = async (req, res) => {
    const param = decodeURIComponent(req.params.id);
    try {
        console.log('Fetching status for:', param);
        
        // 1. Try searching by trackingId
        let track = await Track.findOne({ trackingId: param });
        
        if (!track) {
            // 2. Try searching by subject (Case-Insensitive)
            track = await Track.findOne({ 
                subject: { $regex: new RegExp('^' + param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } 
            }).sort({ createdAt: -1 });
        }
        
        if (!track) {
            return res.json({ status: 'not_found' });
        }

        res.json({
            status: track.status,
            subject: track.subject,
            opensCount: track.opens.length,
            lastOpen: track.opens.length > 0 ? track.opens[track.opens.length - 1].timestamp : null
        });
    } catch (err) {
        console.error('Status fetch error:', err);
        res.status(500).json({ error: err.message });
    }
};

// @desc    Register a new email for tracking
// @route   POST /register
exports.registerEmail = async (req, res) => {
    const { trackingId, senderId, subject, recipient } = req.body;
    try {
        console.log(`[REGISTER] Subject: ${subject} | Recipient: ${recipient}`);
        
        // Use findOneAndUpdate with upsert to handle pre-emptive pixel hits
        await Track.findOneAndUpdate(
            { trackingId },
            { senderId, subject, recipient },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get all tracks for debugging
// @route   GET /all-tracks
exports.getAllTracks = async (req, res) => {
    try {
        const tracks = await Track.find().sort({ createdAt: -1 }).limit(50);
        res.json(tracks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
