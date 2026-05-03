require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const trackRoutes = require('./routes/trackRoutes');
const { initWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// Connect to Database
connectDB();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// Initialize WebSocket
initWebSocket(server);

// Routes
app.use('/', trackRoutes);

// Root Route
app.get('/', (req, res) => {
    res.send('Gmail Tracker Server with WebSocket is running!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
