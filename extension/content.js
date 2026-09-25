/**
 * DNSentinel Content Script v3
 * Features:
 *  1. Hover tooltip — shows risk score BEFORE you click any link
 *  2. Link badge scanner — marks suspicious links with colored badges
 *  3. Red outline on HIGH/CRITICAL links
 */

const API   = 'http://127.0.0.1:8000/api/risk';
const CACHE = {};          // domain → risk data (shared between hover + scan)
const QUEUED = new Set();  // domains already fetched or in-flight

// ── Inject styles ──────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  /* ── Hover Tooltip ─────────────────────────────── */
  #dns-tooltip {
    position: fixed;
    z-index: 2147483647;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 14px;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    color: #f8fafc;
    pointer-events: none;
    box-shadow: 0 8px 24px #0005;
    min-width: 200px;
    max-width: 280px;
    transition: opacity 0.15s;
    opacity: 0;
  }
  #dns-tooltip.visible { opacity: 1; }
  #dns-tooltip .tt-domain { color: #94a3b8; font-size: 11px; margin-bottom: 6px; word-break: break-all; }
  #dns-tooltip .tt-loading { color: #64748b; font-size: 11px; }
  #dns-tooltip .tt-score {
    font-size: 22px;
    font-weight: bold;
    line-height: 1;
    margin-bottom: 2px;
  }
  #dns-tooltip .tt-severity {
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1px;
    padding: 2px 8px;
    border-radius: 99px;
    display: inline-block;
    margin-bottom: 8px;
  }
  #dns-tooltip .tt-reasons {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.5;
    border-top: 1px solid #1e293b;
    padding-top: 6px;
    margin-top: 2px;
  }
  #dns-tooltip .tt-offline {
    color: #f59e0b;
    font-size: 11px;
  }

  /* ── Severity colours ───────────────────────────── */
  .dns-color-LOW      { color: #10b981; }
  .dns-color-MEDIUM   { color: #f59e0b; }
  .dns-color-HIGH     { color: #f97316; }
  .dns-color-CRITICAL { color: #ef4444; }

  .dns-sev-LOW      { background:#064e3b33; color:#10b981; border:1px solid #10b981; }
  .dns-sev-MEDIUM   { background:#451a0333; color:#f59e0b; border:1px solid #f59e0b; }
  .dns-sev-HIGH     { background:#431407aa; color:#f97316; border:1px solid #f97316; }
  .dns-sev-CRITICAL { background:#450a0aaa; color:#ef4444; border:1px solid #ef4444; }

  /* ── Link badges ────────────────────────────────── */
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
  .dns-badge-MEDIUM   { background:#451a03; color:#fcd34d; border:1px solid #f59e0b; }
  .dns-badge-HIGH     { background:#450a0a; color:#fca5a5; border:1px solid #ef4444; }
  .dns-badge-CRITICAL {
    background:#7f1d1d; color:#fff; border:1px solid #dc2626;
    animation: dns-pulse 1s ease-in-out infinite;
  }
  @keyframes dns-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

  .dns-link-warn { outline:2px solid #ef4444 !important; outline-offset:2px; border-radius:2px; }
`;
document.head.appendChild(style);

// ── Create tooltip element ─────────────────────────────────────────────────────
const tooltip = document.createElement('div');
tooltip.id = 'dns-tooltip';
document.body.appendChild(tooltip);

let hideTimer;

function showTooltip(x, y, domain, data) {
    clearTimeout(hideTimer);
    tooltip.classList.add('visible');

    // Position near cursor (avoid going off screen)
    const margin = 12;
    const left = Math.min(x + margin, window.innerWidth - 300);
    const top  = Math.min(y + margin, window.innerHeight - 160);
    tooltip.style.left = `${left}px`;
    tooltip.style.top  = `${top}px`;

    if (!data) {
        // Loading state
        tooltip.innerHTML = `
            <div class="tt-domain">🔍 ${domain}</div>
            <div class="tt-loading">Checking risk score...</div>
        `;
        return;
    }

    if (data.offline) {
        tooltip.innerHTML = `
            <div class="tt-domain">${domain}</div>
            <div class="tt-offline">⚠ Backend offline — cannot score</div>
        `;
        return;
    }

    const score    = data.risk_score;
    const severity = data.severity || 'LOW';
    const reasons  = (data.explanation || []);

    if (severity === 'UNKNOWN' || data.status === 'AWAITING_ANALYSIS') {
        tooltip.innerHTML = `
            <div class="tt-domain">${domain}</div>
            <div class="tt-offline">⏳ Awaiting DNS analysis (no recent local result)</div>
        `;
        return;
    }

    const reasonsHtml = reasons.length > 0
        ? reasons.map(r => `• ${r}`).join('<br>')
        : '• No unusual DNS behavior detected.';

    const icon = score >= 80 ? '🚨' : score >= 60 ? '⚠️' : score >= 30 ? '🟡' : '✅';

    tooltip.innerHTML = `
        <div class="tt-domain">${domain}</div>
        <div class="tt-score dns-color-${severity}">${icon} ${score} <span style="font-size:13px;color:#64748b">/ 100</span></div>
        <span class="tt-severity dns-sev-${severity}">${severity}</span>
        <div class="tt-reasons">${reasonsHtml}</div>
    `;
}

function hideTooltip() {
    hideTimer = setTimeout(() => tooltip.classList.remove('visible'), 120);
}

// ── Fetch risk (with cache) ────────────────────────────────────────────────────
async function fetchRisk(domain) {
    const now = Date.now();
    if (CACHE[domain] !== undefined) {
        if (now - CACHE[domain]._timestamp < 10000) {
            return CACHE[domain].data;
        }
    }
    
    QUEUED.add(domain);
    try {
        const res  = await fetch(`${API}/${domain}`, { cache: 'no-store' });
        const data = await res.json();
        CACHE[domain] = { data: data, _timestamp: now };
        return data;
    } catch {
        const offline = { offline: true };
        CACHE[domain] = { data: offline, _timestamp: now };
        return offline;
    }
}

// ── Hover listeners — attach to every link ─────────────────────────────────────
function attachHover(link) {
    if (link.dataset.dnsHover) return;
    link.dataset.dnsHover = '1';

    let domain;
    try {
        const u = new URL(link.href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
        domain = u.hostname;
        if (domain === location.hostname) return;  // skip same-origin
        if (domain === '127.0.0.1' || domain === 'localhost') return;
    } catch { return; }

    link.addEventListener('mouseenter', async (e) => {
        const cached = CACHE[domain];
        const cachedData = cached ? cached.data : null;
        showTooltip(e.clientX, e.clientY, domain, cachedData);

        if (!cached) {
            const data = await fetchRisk(domain);
            // Only update if tooltip is still showing this domain
            if (tooltip.classList.contains('visible')) {
                showTooltip(e.clientX, e.clientY, domain, data);
            }
            // Also apply badge now that we have data
            applyBadge(link, data);
        }
    });

    link.addEventListener('mousemove', (e) => {
        if (tooltip.classList.contains('visible')) {
            const left = Math.min(e.clientX + 12, window.innerWidth - 300);
            const top  = Math.min(e.clientY + 12, window.innerHeight - 160);
            tooltip.style.left = `${left}px`;
            tooltip.style.top  = `${top}px`;
        }
    });

    link.addEventListener('mouseleave', hideTooltip);
}

// ── Apply badge to link ────────────────────────────────────────────────────────
function applyBadge(link, data) {
    if (!data || data.offline || link.dataset.dnsTagged) return;
    link.dataset.dnsTagged = '1';
    const score    = data.risk_score;
    const severity = data.severity || 'LOW';
    if (score < 30) return;

    const badge = document.createElement('span');
    badge.className = `dns-badge dns-badge-${severity}`;
    badge.textContent = `⚡${score}`;
    badge.title = `DNSentinel: ${severity} (${score}/100)`;
    if (score >= 60) link.classList.add('dns-link-warn');
    link.insertAdjacentElement('afterend', badge);
}

// ── Scan all links: attach hover + badge ──────────────────────────────────────
async function scanLinks() {
    const links = [...document.querySelectorAll('a[href]')];

    // Attach hover to ALL links immediately
    links.forEach(attachHover);

    // Pre-fetch for links NOT yet cached
    const domains = new Set();
    links.forEach(link => {
        try {
            const u = new URL(link.href);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
            const d = u.hostname;
            if (d === location.hostname || d === '127.0.0.1') return;
            if (!QUEUED.has(d)) domains.add(d);
        } catch {}
    });

    for (const domain of domains) {
        QUEUED.add(domain);
        fetchRisk(domain).then(data => {
            // Badge all matching links once data arrives
            links.forEach(link => {
                try {
                    if (new URL(link.href).hostname === domain) applyBadge(link, data);
                } catch {}
            });
        });
    }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(scanLinks, 500));
} else {
    setTimeout(scanLinks, 500);
}

// Watch for dynamic content (SPAs, infinite scroll)
let debounce;
const observer = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(scanLinks, 800);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
