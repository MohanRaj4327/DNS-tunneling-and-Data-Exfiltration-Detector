/**
 * DNSentinel Content Script
 * Scans all links on the page and highlights suspicious domains.
 * Runs inside every HTTP/HTTPS page.
 */

const RISK_CACHE = {};   // domain → risk data
const CHECKED = new Set();

// ── Inject styles ─────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .dnsentinel-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: middle;
    cursor: default;
    font-family: monospace;
    line-height: 1.4;
    text-decoration: none !important;
  }
  .dnsentinel-low    { background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; }
  .dnsentinel-medium { background: #451a03; color: #fcd34d; border: 1px solid #f59e0b; }
  .dnsentinel-high   { background: #450a0a; color: #fca5a5; border: 1px solid #ef4444; }
  .dnsentinel-critical { background: #7f1d1d; color: #fff; border: 1px solid #dc2626; animation: dnspulse 1s infinite; }

  @keyframes dnspulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .dnsentinel-link-warn {
    outline: 2px solid #ef4444 !important;
    outline-offset: 1px;
    border-radius: 2px;
  }
`;
document.head.appendChild(style);

// ── Collect unique domains from all links ────────────────────────────────────
function getUniqueDomains(links) {
    const domains = new Set();
    links.forEach(a => {
        try {
            const url = new URL(a.href);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
            const domain = url.hostname;
            if (domain === window.location.hostname) return; // skip same-origin
            if (domain === '127.0.0.1' || domain === 'localhost') return;
            domains.add(domain);
        } catch (e) {}
    });
    return [...domains];
}

// ── Apply visual badge to a link ─────────────────────────────────────────────
function applyBadge(link, data) {
    if (link.dataset.dnsChecked) return;
    link.dataset.dnsChecked = '1';

    if (!data || data.error) return;

    const score = data.risk_score;
    const severity = (data.severity || 'LOW').toLowerCase();

    // Only badge MEDIUM and above
    if (score < 30) return;

    const badge = document.createElement('span');
    badge.className = `dnsentinel-badge dnsentinel-${severity}`;
    badge.title = `DNSentinel: ${score}/100 ${data.severity}\n${(data.explanation || []).join('\n')}`;
    badge.textContent = `⚡${score}`;

    // Add red outline to HIGH/CRITICAL links
    if (score >= 60) {
        link.classList.add('dnsentinel-link-warn');
    }

    // Insert badge after the link
    if (link.parentNode) {
        link.parentNode.insertBefore(badge, link.nextSibling);
    }
}

// ── Scan links and fetch risk scores in batches ───────────────────────────────
function scanLinks() {
    const links = [...document.querySelectorAll('a[href]')];
    const newDomains = getUniqueDomains(links).filter(d => !CHECKED.has(d));
    if (newDomains.length === 0) return;

    newDomains.forEach(d => CHECKED.add(d));

    // Batch check via background script
    chrome.runtime.sendMessage({ action: 'checkBatch', domains: newDomains }, results => {
        if (!results) return;
        Object.entries(results).forEach(([domain, data]) => {
            RISK_CACHE[domain] = data;
        });

        // Apply badges to all matching links
        links.forEach(link => {
            try {
                const domain = new URL(link.href).hostname;
                if (RISK_CACHE[domain]) {
                    applyBadge(link, RISK_CACHE[domain]);
                }
            } catch (e) {}
        });
    });
}

// ── Run on page load + watch for dynamic content ──────────────────────────────
window.addEventListener('load', () => {
    setTimeout(scanLinks, 800); // slight delay to let page settle
});

// MutationObserver to catch dynamically loaded links (SPAs, infinite scroll, etc.)
const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(scanLinks, 500);
});
observer.observe(document.body, { childList: true, subtree: true });
