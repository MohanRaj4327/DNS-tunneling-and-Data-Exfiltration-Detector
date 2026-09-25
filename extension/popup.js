document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        
        chrome.runtime.sendMessage({action: "checkRisk", domain: domain}, response => {
            const content = document.getElementById('content');
            
            if (response.error) {
                content.innerHTML = `
                    <div class="domain">${domain}</div>
                    <div class="error">⚠ DNSentinel analyzer unavailable.<br>The site has not been classified.</div>
                `;
                return;
            }
            
            const sevClass = response.severity.toLowerCase();
            const reasonsHtml = response.explanation.map(r => `<li>${r}</li>`).join('');
            
            content.innerHTML = `
                <div class="domain">${domain}</div>
                <div>Risk Score:</div>
                <div class="score">${response.risk_score} / 100</div>
                <div class="severity ${sevClass}">${response.severity}</div>
                
                <div class="reasons">
                    ${response.risk_score >= 60 ? '<strong>Why?</strong>' : 'Status:'}
                    <ul class="reason-list">
                        ${reasonsHtml}
                    </ul>
                </div>
            `;
        });
    });
});
