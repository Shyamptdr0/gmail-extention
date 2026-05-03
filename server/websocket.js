const WebSocket = require('ws');

let clients = [];

function initWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Extension connected to WebSocket');
        clients.push(ws);

        ws.on('close', () => {
            clients = clients.filter(c => c !== ws);
            console.log('Extension disconnected');
        });

        // Basic ping-pong to keep connection alive
        ws.on('message', (message) => {
            if (message.toString() === 'ping') ws.send('pong');
        });
    });
}

function notifyAll(data) {
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

module.exports = { initWebSocket, notifyAll };
