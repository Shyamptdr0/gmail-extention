const BACKEND_URL = 'https://gmail-extention.onrender.com';
const WS_URL = 'wss://gmail-extention.onrender.com';

let senderId = '';
chrome.storage.local.get(['senderId'], (result) => {
    if (result.senderId) {
        senderId = result.senderId;
    } else {
        senderId = Math.random().toString(36).substring(2, 15);
        chrome.storage.local.set({ senderId });
    }
});

// WebSocket connection for real-time notifications
let ws;
function connectWS() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Connected to Tracking WebSocket');
        // Heartbeat to keep Render connection alive
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 20000);
    };
    
    ws.onmessage = (event) => {
        if (event.data === 'pong') return; // Ignore heartbeat responses
        
        const data = JSON.parse(event.data);
        if (data.type === 'OPENED') {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Email Opened!',
                message: `Recipient opened: ${data.subject || 'Your Email'}`,
                priority: 2
            });
            
            // Notify content scripts to update UI instantly
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_TICKS', trackingId: data.trackingId });
                });
            });
        }
    };

    ws.onerror = (err) => console.error('WS Error:', err);

    ws.onclose = () => {
        console.log('WS closed, reconnecting in 5s...');
        setTimeout(connectWS, 5000);
    };
}
connectWS();

// HTTP Request handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'REGISTER_EMAIL') {
        // Respond immediately to prevent channel closure error
        sendResponse({ success: true, message: 'Registration started' });

        fetch(`${BACKEND_URL}/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({ ...request.data, senderId })
        })
        .then(res => res.json())
        .then(data => console.log('Registration successful:', data))
        .catch(err => console.error('Registration failed:', err));
        
        return false; // Channel closed intentionally after immediate response
    }

    if (request.type === 'GET_STATUS') {
        const encodedSubject = encodeURIComponent(request.subject);
        fetch(`${BACKEND_URL}/status/${encodedSubject}`, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});
