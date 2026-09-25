chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkRisk") {
        fetch(`http://127.0.0.1:8000/api/risk/${request.domain}`)
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(error => sendResponse({ error: "API_UNAVAILABLE" }));
        return true; 
    } else if (request.action === "whitelist") {
        warnedDomains.add(request.domain);
        sendResponse({success: true});
        return false;
    }
});

let warnedDomains = new Set();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
        try {
            const url = new URL(tab.url);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
            
            const domain = url.hostname;
            if (warnedDomains.has(domain)) return; // Already warned and bypassed
            
            fetch(`http://127.0.0.1:8000/api/risk/${domain}`)
                .then(res => res.json())
                .then(data => {
                    if (data.risk_score >= 30) {
                        // Redirect to warning page
                        const warningUrl = chrome.runtime.getURL(`warning.html?domain=${encodeURIComponent(domain)}&score=${data.risk_score}&severity=${data.severity}&reasons=${encodeURIComponent(JSON.stringify(data.explanation))}`);
                        chrome.tabs.update(tabId, { url: warningUrl });
                    }
                })
                .catch(e => console.log("DNSentinel API not reachable"));
        } catch(e) {}
    }
});
