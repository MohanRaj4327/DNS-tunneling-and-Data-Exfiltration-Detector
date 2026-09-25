document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;

        // ── Offline detection ────────────────────────────────────────────────
        const content = document.getElementById('content');
        content.innerHTML = `<div class="loading">Analyzing ${domain}...</div>`;

        chrome.runtime.sendMessage({ action: 'checkRisk', domain }, response => {
            if (!response || response.error === 'API_UNAVAILABLE') {
                content.innerHTML = `
                    <div class="offline-box">
                        <div class="offline-icon">⚠</div>
                        <div class="offline-title">Backend Offline</div>
                        <div class="offline-msg">
                            DNSentinel API is not running.<br>
                            Start the backend to enable protection.
                        </div>
                        <div class="offline-cmd">scripts\\start_backend.bat</div>
                    </div>
                `;
                return;
            }

            const score = response.risk_score;
            const severity = response.severity;
            const sevClass = severity.toLowerCase();
            const reasonsHtml = (response.explanation || ['No unusual DNS behavior detected.'])
                .map(r => `<li>${r}</li>`).join('');

            // Score ring color
            const ringColor = {
                LOW: '#10b981', MEDIUM: '#f59e0b',
                HIGH: '#f97316', CRITICAL: '#ef4444'
            }[severity] || '#10b981';

            content.innerHTML = `
                <div class="domain-name">${domain}</div>
                <div class="score-ring" style="--ring-color: ${ringColor}">
                    <div class="score-number">${score}</div>
                    <div class="score-label">/ 100</div>
                </div>
                <div class="severity-badge ${sevClass}">${severity}</div>

                <div class="reasons-box">
                    <div class="reasons-title">${score >= 60 ? '🚨 Why suspicious?' : '✅ Status'}</div>
                    <ul class="reason-list">${reasonsHtml}</ul>
                </div>

                <div class="footer-link" id="openDashboard">Open Dashboard →</div>
            `;

            document.getElementById('openDashboard').addEventListener('click', () => {
                chrome.tabs.create({ url: 'http://localhost:5173' });
            });

            // Save to history
            saveHistory(domain, score, severity);
        });
    });
});

function saveHistory(domain, score, severity) {
    chrome.storage.local.get(['history'], ({ history = [] }) => {
        const entry = { domain, score, severity, time: Date.now() };
        const updated = [entry, ...history.filter(h => h.domain !== domain)].slice(0, 10);
        chrome.storage.local.set({ history: updated });
    });
}
