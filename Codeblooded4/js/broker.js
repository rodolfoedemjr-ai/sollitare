import { calculateAdvancedSynergyMetrics } from './matchmaking.js';

export function renderBrokerMarketplace(localBountiesCache, mySkills, currentLevel, executeNodeVerificationProcess, endorsementsMap = {}) {
    const container = document.getElementById('broker-quest-list');
    if (!container) return;
    
    const searchVal = document.getElementById('broker-search-input')?.value.toLowerCase() || "";
    const lvlFilter = document.getElementById('broker-level-filter')?.value || "all";
    container.innerHTML = "";
    
    let processedList = localBountiesCache.filter(quest => {
        const matchesSearch = quest.title.toLowerCase().includes(searchVal) || 
                              (quest.requiredSkills && quest.requiredSkills.toLowerCase().includes(searchVal));
        const matchesLvl = lvlFilter === "all" ? true : currentLevel >= (quest.minLevel || 1);
        return matchesSearch && matchesLvl;
    });

    if (processedList.length === 0) {
        container.innerHTML = `<div class="empty-state-notice">⚡ NO REGISTERED REGISTRY ROWS FOUND AGAINST SEARCH QUERIES</div>`;
        return;
    }

    container.innerHTML = processedList.map(quest => {
        const { score, logs } = calculateAdvancedSynergyMetrics(mySkills, currentLevel, quest.requiredSkills || "", quest.minLevel || 1, endorsementsMap);
        const explainerRows = logs.map(l => `<div>${l}</div>`).join('');
        
        return `
            <div class="broker-list-row ${score >= 60 ? 'high-synergy-row' : ''}" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin:0; font-size:0.9rem; color:#fff;">${quest.title} <span class="broker-lvl-lbl">LEVEL ${quest.minLevel || 1}</span></h4>
                        <p style="margin:0.2rem 0; font-size:0.75rem; color:var(--text-muted);">Demands: ${quest.requiredSkills}</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-family:monospace; font-size:0.8rem; font-weight:bold; color:var(--accent);">AFFINITY: ${score.toFixed(0)}%</span>
                        <span class="broker-cash">💎 ${quest.tokenReward || 20} CQ</span>
                    </div>
                </div>
                
                <div class="reco-explainer-heatmap">
                    <strong>🔍 Algorithmic Synergy Pathing Analysis:</strong>
                    ${explainerRows}
                </div>

                <button class="claim-bounty-btn broker-claim-hook" data-id="${quest.id}" data-tokens="${quest.tokenReward || 20}" style="margin-top:0.25rem;">Execute Sync Connection</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.broker-claim-hook').forEach(btn => {
        btn.addEventListener('click', (e) => {
            executeNodeVerificationProcess(e.target.getAttribute('data-id'), "Registry Selection Node", e.target.getAttribute('data-tokens'));
        });
    });
}
