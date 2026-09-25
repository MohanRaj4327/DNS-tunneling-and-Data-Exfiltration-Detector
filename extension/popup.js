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
            
            // Check if we actually have data for this domain
            if (severity === 'UNKNOWN' || response.status === 'AWAITING_ANALYSIS') {
                content.innerHTML = `
                    <div class="section">
                        <div class="label">Current Site:</div>
                        <div class="domain">${domain}</div>
                    </div>
                    <div class="offline-box" style="margin-top: 15px; border-color: var(--border);">
                        <div class="offline-icon" style="color: var(--text-muted);">⏳</div>
                        <div class="offline-title" style="color: var(--text);">Awaiting DNS analysis</div>
                        <div class="offline-msg">
                            No recent DNS activity detected for this domain by the local monitor.
                        </div>
                    </div>
                    <button class="details-btn" id="openDashboard">[ View Details ]</button>
                `;
            } else {
                const sevClass = `val-${severity.toLowerCase()}`;
                const reasonsHtml = (response.explanation || ['No unusual DNS behavior detected.'])
                    .map(r => `<li>${r}</li>`).join('');
                
                const timeStr = response.timestamp ? new Date(response.timestamp * 1000).toLocaleTimeString() : 'Unknown';

                content.innerHTML = `
                    <div class="section">
                        <div class="label">Current Site:</div>
                        <div class="domain">${domain}</div>
                    </div>

                    <div class="section">
                        <div class="stat-row">
                            <span class="stat-label">Risk:</span>
                            <span class="stat-value ${sevClass}">${score}/100</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Severity:</span>
                            <span class="stat-value ${sevClass}">${severity}</span>
                        </div>
                    </div>

                    <div class="section">
                        <div class="label">Why?</div>
                        <ul class="reasons-list">
                            ${reasonsHtml}
                        </ul>
                    </div>
                    
                    <div class="section" style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">
                        <div class="stat-row">
                            <span class="stat-label" style="font-size: 0.8rem;">Timestamp:</span>
                            <span class="stat-value" style="font-size: 0.8rem; color: var(--text-muted);">${timeStr}</span>
                        </div>
                    </div>

                    <button class="details-btn" id="openDashboard">[ View Details ]</button>
                `;
            }

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
