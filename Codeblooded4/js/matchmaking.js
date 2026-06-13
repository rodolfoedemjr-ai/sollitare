/**
 * Advanced Recommendation Engine Scoring Algorithm
 * Implements skill-affinity mapping matrix alongside target status adjustments
 */
export function calculateAdvancedSynergyMetrics(userSkills = [], userLevel = 1, requiredSkillsOrArray = "", targetMinLevel = 1, endorsementsMap = {}) {
    let score = 0;
    let logs = [];

    // 1. Structural Skill Alignment Analysis
    let targetSkills = [];
    if (Array.isArray(requiredSkillsOrArray)) {
        targetSkills = requiredSkillsOrArray;
    } else if (typeof requiredSkillsOrArray === 'string') {
        targetSkills = requiredSkillsOrArray.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (targetSkills.length === 0) {
        score += 30;
        logs.push("📊 Neutral Alignment Stack: Empty core parameters.");
    } else {
        let matches = 0;
        targetSkills.forEach(skill => {
            const normalizedSkill = userSkills.map(s => s.toLowerCase()).indexOf(skill.toLowerCase());
            if (normalizedSkill !== -1) {
                matches++;
                // Bonus points allocated based on vouch metrics stored inside peerEndorsementsLedger
                const runVouches = endorsementsMap[userSkills[normalizedSkill]] || 0;
                score += 20 + Math.min(runVouches * 3, 15); 
                logs.push(`🎯 Match Node Verified: [${skill}] (+${20 + Math.min(runVouches * 3, 15)} Affinity)`);
            }
        });
        if (matches === 0) {
            logs.push("⚠️ Skill Mismatch: Divergent technology footprints.");
        }
    }

    // 2. Clearance Variance Intercept
    const clearanceDifference = userLevel - targetMinLevel;
    if (clearanceDifference >= 0) {
        score += 25;
        logs.push(`🔐 Authorization Secure: Level clearance verified (+25 Affinity)`);
    } else {
        score -= Math.abs(clearanceDifference) * 15;
        logs.push(`❌ Security Gate Alert: Deficit of ${Math.abs(clearanceDifference)} rank levels.`);
    }

    // Bound output constraints perfectly between 0% and 100%
    score = Math.max(0, Math.min(100, score));
    return { score, logs };
}

/**
 * Time-Decay Behavioral Vector Formula Algorithm
 * Implements Newton's Law of Cooling for user tracking activity parameters
 * Formula: Intensity * e^(-decay_constant * time_delta)
 */
export function calculateDecayedInterests(behavioralLogs = []) {
    const decayConstant = 0.00000005; // Fixed algorithmic half-life decay speed metric
    const currentTime = Date.now();
    
    let vectors = { hardware: 10, web: 10, data: 10 }; // Default baseline weight balances

    behavioralLogs.forEach(signal => {
        const timeDelta = currentTime - signal.timestamp;
        const remainingIntensity = signal.intensity * Math.exp(-decayConstant * timeDelta);
        
        if (vectors[signal.category] !== undefined) {
            vectors[signal.category] += remainingIntensity;
        }
    });

    return vectors;
}
