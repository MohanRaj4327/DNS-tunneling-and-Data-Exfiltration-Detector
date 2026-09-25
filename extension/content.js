/**
 * DNSentinel Content Script v2
 * Directly calls the local API (no background relay needed).
 * Scans all links and highlights suspicious domains.
 */

const API = 'http://127.0.0.1:8000/api/risk';
const CACHE = {};      // domain → risk data
const QUEUED = new Set();

// ── Inject styles ─────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .dns-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: bold;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: middle;
    font-family: monospace;
    cursor: default;
    pointer-events: none;
    line-height: 1.5;
  }
  .dns-medium   { background:#451a03; color:#fcd34d; border:1px solid #f59e0b; }
  .dns-high     { background:#450a0a; color:#fca5a5; border:1px solid #ef4444; }
  .dns-critical { background:#7f1d1d; color:#fff;    border:1px solid #dc2626;
                  animation: dns-pulse 1s ease-in-out infinite; }
  @keyframes dns-pulse {
    0%,100% { opacity:1; } 50% { opacity:0.55; }
  }
  .dns-link-warn {
    outline: 2px solid #ef4444 !important;
    outline-offset: 2px;
    border-radius: 2px;
  }
`;
document.head.appendChild(style);

// ── Fetch risk for a single domain ────────────────────────────────────────────
async function fetchRisk(domain) {
    if (CACHE[domain] !== undefined) return CACHE[domain];
    try {
        const res = await fetch(`${API}/${domain}`, { cache: 'no-store' });
        const data = await res.json();
        CACHE[domain] = data;
        return data;
    } catch (e) {
        CACHE[domain] = null; // API offline — mark to skip
        return null;
    }
}

// ── Apply badge to a link element ─────────────────────────────────────────────
function applyBadge(link, data) {
    if (!data || link.dataset.dnsTagged) return;
    link.dataset.dnsTagged = '1';

    const score = data.risk_score;
    if (score < 30) return; // LOW — no badge

    const severity = (data.severity || 'LOW').toLowerCase();
    const reasons = (data.explanation || []).join('\n') || 'Potentially suspicious DNS pattern.';

    const badge = document.createElement('span');
    badge.className = `dns-badge dns-${severity}`;
    badge.textContent = `⚡${score}`;
    badge.title = `DNSentinel ${data.severity} (${score}/100)\n${reasons}`;

    if (score >= 60) {
        link.classList.add('dns-link-warn');
    }

    if (link.parentNode) {
        link.insertAdjacentElement('afterend', badge);
    }
}

// ── Scan all links on page ────────────────────────────────────────────────────
async function scanLinks() {
    const links = [...document.querySelectorAll('a[href]')];

    // Collect unique external domains not yet queued
    const todo = new Map(); // domain → [links]
    for (const link of links) {
        try {
            const u = new URL(link.href);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
            const domain = u.hostname;
            if (domain === location.hostname) continue;
            if (domain === '127.0.0.1' || domain === 'localhost') continue;
            if (QUEUED.has(domain)) {
                // Already fetched — just badge it
                if (CACHE[domain]) applyBadge(link, CACHE[domain]);
                continue;
            }
            if (!todo.has(domain)) todo.set(domain, []);
            todo.get(domain).push(link);
        } catch (e) {}
    }

    if (todo.size === 0) return;

    // Mark all as queued before firing fetches
    for (const domain of todo.keys()) QUEUED.add(domain);

    // Fire all fetches concurrently (max 10 at a time to be polite)
    const domains = [...todo.keys()];
    const CHUNK = 10;
    for (let i = 0; i < domains.length; i += CHUNK) {
        const chunk = domains.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async domain => {
            const data = await fetchRisk(domain);
            if (data) todo.get(domain)?.forEach(link => applyBadge(link, data));
        }));
    }
}

// ── Run on load, then watch for dynamic content ───────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(scanLinks, 600));
} else {
    setTimeout(scanLinks, 600);
}

// MutationObserver — handles SPAs, infinite scroll, lazy-loaded content
let debounceTimer;
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanLinks, 800);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
