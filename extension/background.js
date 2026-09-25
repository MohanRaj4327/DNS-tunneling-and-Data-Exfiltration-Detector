let warnedDomains = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────
function setBadge(tabId, score, severity) {
    const colors = {
        LOW:      [34, 197, 94, 255],   // green
        MEDIUM:   [234, 179, 8, 255],   // yellow
        HIGH:     [249, 115, 22, 255],  // orange
        CRITICAL: [239, 68, 68, 255]    // red
    };
    const color = colors[severity] || colors.LOW;
    chrome.action.setBadgeText({ text: String(score), tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
}

function clearBadge(tabId) {
    chrome.action.setBadgeText({ text: '', tabId });
}

// ── Real-time navigation interceptor ──────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;

    try {
        const url = new URL(changeInfo.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

        const domain = url.hostname;
        if (domain === '127.0.0.1' || domain === 'localhost') return;

        fetch(`http://127.0.0.1:8000/api/risk/${domain}?source=navigation`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                // Always update badge with current score
                setBadge(tabId, data.risk_score, data.severity);

                if (!warnedDomains.has(domain) && data.risk_score >= 60) {
                    warnedDomains.add(domain + '_warned');
                    const params = new URLSearchParams({
                        domain: domain,
                        score: data.risk_score,
                        severity: data.severity,
                        reasons: JSON.stringify(data.explanation || [])
                    });
                    const warningUrl = chrome.runtime.getURL(`warning.html?${params.toString()}`);
                    chrome.tabs.update(tabId, { url: warningUrl });
                }
            })
            .catch(() => {
                // Backend offline — show offline badge
                chrome.action.setBadgeText({ text: 'OFF', tabId });
                chrome.action.setBadgeBackgroundColor({ color: [100, 116, 139, 255], tabId });
            });
    } catch (e) {}
});

// ── Clear badge when tab navigates away ───────────────────────────────────────
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, tab => {
        if (!tab || !tab.url) { clearBadge(tabId); return; }
        try {
            const url = new URL(tab.url);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                clearBadge(tabId); return;
            }
        } catch(e) { clearBadge(tabId); }
    });
});

// ── Popup message handler ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkRisk') {
        fetch(`http://127.0.0.1:8000/api/risk/${request.domain}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(() => sendResponse({ error: 'API_UNAVAILABLE' }));
        return true;
    }

    if (request.action === 'whitelist') {
        warnedDomains.delete(request.domain + '_warned');
        warnedDomains.add(request.domain);
        sendResponse({ success: true });
        return false;
    }

    if (request.action === 'checkBatch') {
        // Used by content script to check multiple domains at once
        const domains = request.domains || [];
        const results = {};
        let pending = domains.length;
        if (pending === 0) { sendResponse(results); return false; }

        domains.forEach(domain => {
            fetch(`http://127.0.0.1:8000/api/risk/${domain}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => { results[domain] = data; })
                .catch(() => { results[domain] = { error: true }; })
                .finally(() => {
                    pending--;
                    if (pending === 0) sendResponse(results);
                });
        });
        return true; // async
    }
});
