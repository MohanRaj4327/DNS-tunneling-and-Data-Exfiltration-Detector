document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('domain');
    const score = params.get('score');
    const severity = params.get('severity');
    
    let reasons = [];
    try {
        reasons = JSON.parse(params.get('reasons') || '[]');
    } catch(e) {}

    document.getElementById('domainDisplay').textContent = domain;
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('severityDisplay').textContent = severity;
    
    const reasonsList = document.getElementById('reasonsList');
    reasons.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        reasonsList.appendChild(li);
    });

    document.getElementById('btnBack').addEventListener('click', () => {
        window.history.back();
        // Fallback if history is empty
        setTimeout(() => window.close(), 100);
    });

    document.getElementById('btnContinue').addEventListener('click', () => {
        chrome.runtime.sendMessage({action: "whitelist", domain: domain}, () => {
            window.location.href = `http://${domain}`;
        });
    });
});
