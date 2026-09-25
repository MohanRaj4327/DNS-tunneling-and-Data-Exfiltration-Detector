let warnedDomains = new Set();

// ── Real-time navigation interceptor ──────────────────────────────────────────
// changeInfo.url fires BEFORE the page loads, giving us time to redirect
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only act when a new URL is being navigated to
    if (!changeInfo.url) return;

    try {
        const url = new URL(changeInfo.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

        const domain = url.hostname;

        // Skip if user already chose to continue past the warning
        if (warnedDomains.has(domain)) return;

        // Skip our own warning page to avoid infinite redirect
        if (domain === '127.0.0.1' || domain === 'localhost') return;

        fetch(`http://127.0.0.1:8000/api/risk/${domain}`)
            .then(res => res.json())
            .then(data => {
                if (data.risk_score >= 60) {
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
                // API not running — fail silently, let user browse normally
            });
    } catch (e) {}
});

// ── Popup message handler ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkRisk") {
        fetch(`http://127.0.0.1:8000/api/risk/${request.domain}`)
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(() => sendResponse({ error: "API_UNAVAILABLE" }));
        return true; // Keep message channel open for async
    }

    if (request.action === "whitelist") {
        warnedDomains.add(request.domain);
        sendResponse({ success: true });
        return false;
    }
});
