/**
 * Gmail Tracker - Content Script
 * Handles UI injection and communicates with background.js for tracking.
 */

const TICK_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12L9 17L20 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const BACKEND_URL = 'https://gmail-extention.onrender.com'; // Production Render URL

// Helper: Generate Unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 1. Injected Ticks UI
function injectTicks() {
    const isSentFolder = window.location.hash.includes('#sent') || window.location.hash.includes('label/sent');
    
    if (!isSentFolder) {
        document.querySelectorAll('.gmail-tick-container').forEach(t => t.remove());
        return;
    }

    const rows = document.querySelectorAll('tr.zA');
    rows.forEach(row => {
        if (row.querySelector('.gmail-tick-container')) return;

        const starCell = row.querySelector('td.apU');
        if (starCell) {
            const container = document.createElement('div');
            container.className = 'gmail-tick-container';
            container.style.marginLeft = '4px';
            
            const subjectElement = row.querySelector('.y6');
            const subject = subjectElement ? subjectElement.innerText.trim() : '';
            
            container.innerHTML = `
                <span class="gmail-tick tick-sent">${TICK_SVG}</span>
            `;
            
            starCell.style.display = 'flex';
            starCell.style.alignItems = 'center';
            starCell.appendChild(container);
            
            if (subject) {
                syncTickStatus(container, subject);
            }
        }
    });
}

// 2. Sync Status via Background Script
function syncTickStatus(container, subject) {
    chrome.runtime.sendMessage({ type: 'GET_STATUS', subject: subject }, (response) => {
        if (response && response.success && response.data.status === 'read') {
            container.classList.add('double');
            container.innerHTML = `
                <span class="gmail-tick tick-read">${TICK_SVG}</span>
                <span class="gmail-tick tick-read last-tick">${TICK_SVG}</span>
            `;
        }
    });
}

// 3. Compose Window Pixel Injection
function monitorCompose() {
    const composeWindows = document.querySelectorAll('.editable[role="textbox"]');
    composeWindows.forEach(editor => {
        if (editor.getAttribute('data-tracker-injected')) return;
        
        const composeContainer = editor.closest('.AD');
        if (!composeContainer) return;

        const trackingId = generateId();
        
        // Inject pixel immediately when compose opens
        chrome.storage.local.get(['senderId'], (result) => {
            const sid = result.senderId || 'unknown';
            const pixelUrl = `${BACKEND_URL}/t/${trackingId}?sid=${sid}`;
            
            // Append as a hidden image at the end of the body (Mailsuite style)
            const pixelHtml = `<img width="0" height="0" class="mail-tracker-img" alt="" style="display:none !important;" src="${pixelUrl}">`;
            
            // Gmail's editor can be tricky, we append to the end
            const spacer = '<div dir="ltr" class="gmail_signature"><br></div>';
            editor.innerHTML += pixelHtml;
            console.log('Pixel pre-injected into compose body');
        });

        const sendButton = composeContainer.querySelector('.T-I.J-J5-Ji.aoO') || 
                           composeContainer.querySelector('div[role="button"][data-tooltip*="Send"]');

        if (sendButton) {
            sendButton.addEventListener('mousedown', () => { 
                chrome.storage.local.get(['senderId'], (result) => {
                    const sid = result.senderId || 'unknown';
                    const subject = composeContainer.querySelector('input[name="subjectbox"]')?.value || 'No Subject';
                    const recipient = composeContainer.querySelector('input[name="to"]')?.value || 'Unknown';

                    console.log('Registering email on send:', subject);

                    // Register via background script
                    chrome.runtime.sendMessage({
                        type: 'REGISTER_EMAIL',
                        data: {
                            trackingId,
                            senderId: sid,
                            subject: subject.trim(),
                            recipient: recipient.trim()
                        }
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            // Expected if window closes fast, ignore
                            return;
                        }
                    });
                });
            });
            editor.setAttribute('data-tracker-injected', 'true');
        }
    });
}

// 4. Handle Real-time Updates from Background
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'UPDATE_TICKS') {
        console.log('Real-time update received for email open');
        injectTicks(); // Re-scan and update UI
    }
});

// Initialization
const observer = new MutationObserver(() => {
    injectTicks();
    monitorCompose();
});

observer.observe(document.body, { childList: true, subtree: true });
injectTicks();
window.addEventListener('hashchange', injectTicks);

console.log('Gmail Tracker Active (Service Worker Mode)');
