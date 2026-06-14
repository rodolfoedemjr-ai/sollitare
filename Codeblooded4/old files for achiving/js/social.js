import { db } from './firebase-config.js';
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc, getDoc, arrayUnion, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { calculateAdvancedSynergyMetrics } from './matchmaking.js';

export let behavioralSignalLogs = [
    { category: "hardware", intensity: 15, timestamp: Date.now() - 86400000 }, 
    { category: "data", intensity: 20, timestamp: Date.now() - 360000 }
];

let activeFirestorePosts = [];
let targetedInspectedProfile = null;

let cachedIncomingOffers = [];
let cachedOutgoingOffers = [];

/**
 * Initializes real-time background snapshot stream listener pipes across collections
 */
export function initializeLiveSocialFeedStream(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap, syncRadarUI) {
    const activeHandle = document.getElementById('dev-name')?.innerText || "Anonymous_Node";
    
    // 1. Live Global Social Feed Stream
    const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    onSnapshot(postsQuery, (snapshot) => {
        activeFirestorePosts = [];
        snapshot.forEach((docSnap) => {
            activeFirestorePosts.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderSocialNetworkFeed(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap, syncRadarUI);
    }, (error) => {
        logToTerminal(`❌ FEED PIPELINE ERROR: Parse connection failed.`);
    });

    // 2. Incoming Escrow Streams (Target = Active Account Node)
    const incomingQuery = query(collection(db, "offers"), where("targetUser", "==", activeHandle));
    onSnapshot(incomingQuery, (snapshot) => {
        cachedIncomingOffers = [];
        snapshot.forEach(d => cachedIncomingOffers.push({ id: d.id, ...d.data() }));
        renderIncomingOffersShelf(playSound, logToTerminal, updateWalletCallback);
    });

    // 3. Outgoing Escrow Streams (Sender = Active Account Node)
    const outgoingQuery = query(collection(db, "offers"), where("senderUser", "==", activeHandle));
    onSnapshot(outgoingQuery, (snapshot) => {
        cachedOutgoingOffers = [];
        snapshot.forEach(d => cachedOutgoingOffers.push({ id: d.id, ...d.data() }));
        renderOutgoingOffersShelf(playSound, logToTerminal, updateWalletCallback);
    });
}

export function renderSocialNetworkFeed(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap = {}, syncRadarUI) {
    const feedContainer = document.getElementById('social-feed-timeline');
    if (!feedContainer) return;

    if (activeFirestorePosts.length === 0) {
        feedContainer.innerHTML = `<div class="empty-state-notice">🛰️ NO COMM LINK BROADCASTS DETECTED ON CORE CHANNELS</div>`;
        return;
    }

    feedContainer.innerHTML = activeFirestorePosts.map(post => {
        const { score } = calculateAdvancedSynergyMetrics(mySkills, currentLevel, post.skills || [], post.rank || 1, endorsementsMap);
        const isHighlyRecommendedPeer = score >= 50;

        const mediaAttachment = post.media ? `<div class="feed-media-viewport" style="margin-top:0.4rem;"><img src="${post.media}" alt="Feed Attachment"></div>` : '';
        const notesSection = (post.notes || []).map(n => `<div>${n}</div>`).join('');
        const notesContainer = (post.notes || []).length > 0 ? `<div class="feed-notes-tray-panel" style="margin-top:0.4rem;">📁 COMPILED LOG SCHEMAS:<br>${notesSection}</div>` : '';
        const commentsSection = (post.comments || []).map(c => `<div class="feed-comment-row"><span class="comment-author clickable-node-trigger" data-user="${c.sender}">${c.sender}:</span> <span class="comment-text">${c.text}</span></div>`).join('');

        let algorithmicBadge = '';
        if (score >= 85) algorithmicBadge = '<span class="rec-badge" style="background:rgba(63,185,80,0.15); border-color:var(--glow); color:var(--glow);">🎯 PERFECT SYNERGY MATCH</span>';
        else if (isHighlyRecommendedPeer) algorithmicBadge = '<span class="rec-badge">⚡ COMPATIBLE PROXIMITY</span>';

        return `
            <div class="feed-post-card ${isHighlyRecommendedPeer ? 'peer-recommended-glow' : ''}">
                <div class="feed-post-header">
                    <div class="author-meta">
                        <strong class="clickable-node-trigger" data-user="${post.author}" style="cursor:pointer; color:var(--accent);">[${post.author}]</strong>
                        <span class="author-rank-lbl">RANK ${post.rank || 1}</span>
                        ${algorithmicBadge}
                    </div>
                </div>
                <p class="feed-post-body">${post.content}</p>
                ${mediaAttachment}
                ${notesContainer}
                
                <div class="feed-post-footer-actions">
                    <button class="structural-action-lbl boost-btn-hook" data-id="${post.id}">
                        ⚡ Boost Core (${post.boosts || 0})
                    </button>
                    <button class="structural-action-lbl retransmit-btn-hook" data-id="${post.id}">
                        📡 Retransmit Pipeline (${post.retransmits || 0})
                    </button>
                    <button class="structural-action-lbl note-btn-hook" data-id="${post.id}">
                        📝 Attach Note
                    </button>
                    <button class="structural-action-lbl comment-toggle-btn-hook" data-id="${post.id}" style="margin-left:auto;">
                        💬 Comms (${(post.comments || []).length})
                    </button>
                </div>

                <div class="feed-comments-container-block">
                    <div class="comments-scroll-tray">${commentsSection}</div>
                    <div class="comment-append-row">
                        <input type="text" class="post-comment-input-field" placeholder="Transmit network payload comment..." data-id="${post.id}">
                        <button class="post-comment-submit-btn" data-id="${post.id}">Send</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    bindFeedSignalsEventHandlers(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap, syncRadarUI);
}

function bindFeedSignalsEventHandlers(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap, syncRadarUI) {
    document.querySelectorAll('.clickable-node-trigger').forEach(el => {
        el.addEventListener('click', (e) => {
            playSound('click');
            inspectProfileRadarNode(e.target.getAttribute('data-user'), logToTerminal, endorsementsMap);
        });
    });

    document.querySelectorAll('.boost-btn-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            playSound('click');
            const targetId = e.target.getAttribute('data-id');
            const post = activeFirestorePosts.find(p => p.id === targetId);
            if (post) {
                await updateDoc(doc(db, "posts", targetId), { boosts: (post.boosts || 0) + 1 });
                behavioralSignalLogs.push({ category: post.category, intensity: 20, timestamp: Date.now() });
                syncRadarUI();
            }
        });
    });

    document.querySelectorAll('.retransmit-btn-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            playSound('chime');
            const targetId = e.target.getAttribute('data-id');
            const post = activeFirestorePosts.find(p => p.id === targetId);
            if (post) {
                await updateDoc(doc(db, "posts", targetId), { retransmits: (post.retransmits || 0) + 1 });
                behavioralSignalLogs.push({ category: post.category, intensity: 45, timestamp: Date.now() });
                syncRadarUI();
            }
        });
    });

    document.querySelectorAll('.note-btn-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetId = e.target.getAttribute('data-id');
            const inputNote = prompt("Append technical audit/review note details onto this public runtime frame:");
            if (inputNote && inputNote.trim()) {
                await updateDoc(doc(db, "posts", targetId), {
                    notes: arrayUnion(`🛠️ Technical Note: ${inputNote.trim()}`)
                });
                logToTerminal(`SYSTEM AUDIT LOGGED: Uploaded cloud tracking entry metadata for [${targetId}]`);
            }
        });
    });

    document.querySelectorAll('.post-comment-submit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const postId = e.target.getAttribute('data-id');
            const field = document.querySelector(`.post-comment-input-field[data-id="${postId}"]`);
            if (!field || !field.value.trim()) return;
            const activeUser = document.getElementById('dev-name')?.innerText || "Anonymous_Node";
            
            await updateDoc(doc(db, "posts", postId), {
                comments: arrayUnion({ sender: activeUser, text: field.value.trim() })
            });
            field.value = "";
            logToTerminal("FEED STREAM SYNCED: Uploaded live verification message link packet.");
        });
    });
}

function inspectProfileRadarNode(username, logToTerminal, endorsementsMap) {
    const nameLbl = document.getElementById('radar-profile-name');
    const rankLbl = document.getElementById('radar-profile-rank');
    const skillsGrid = document.getElementById('radar-profile-skills');
    const deployBtn = document.getElementById('radar-deploy-offer-btn');
    const vouchBtn = document.getElementById('radar-vouch-btn');
    
    let profile = activeFirestorePosts.find(p => p.author === username) || { author: username, rank: 1, skills: ["Python", "SQL"] };
    targetedInspectedProfile = profile;
    
    logToTerminal(`RADAR INTEGRATION LOCK: Intercepted system profile nodes for identity [@${username.toUpperCase()}]`);
    if (nameLbl) nameLbl.innerText = `[${profile.author}]`;
    if (rankLbl) rankLbl.innerText = `SECURITY REQ DISPATCH: RANK LEVEL ${profile.rank || 1}`;
    
    if (skillsGrid) {
        skillsGrid.innerHTML = (profile.skills || ["Python"]).map(s => {
            const runningVouches = endorsementsMap[s] || 0;
            return `
                <span class="skill-tag" style="padding:0.2rem 0.4rem; font-size:0.7rem;">
                    <span><span class="skill-dot"></span>${s}</span>
                    <span class="vouch-count-badge">👍 ${runningVouches}</span>
                </span>
            `;
        }).join('');
    }
    if (deployBtn) deployBtn.style.display = 'block';
    if (vouchBtn) vouchBtn.style.display = 'block';
}

export async function executeCreateSocialPost(mySkills, currentLevel, playSound, logToTerminal, updateWalletCallback, endorsementsMap, syncRadarUI) {
    const textInput = document.getElementById('post-text-input');
    const mediaInput = document.getElementById('post-media-input');
    if (!textInput || !textInput.value.trim()) return;

    playSound('chime');
    const activeHandle = document.getElementById('dev-name')?.innerText || "Anonymous_Node";
    
    let postBody = textInput.value.toLowerCase();
    let computedCategory = "web";
    if (postBody.includes("verilog") || postBody.includes("hardware") || postBody.includes("assembly")) computedCategory = "hardware";
    else if (postBody.includes("sql") || postBody.includes("query") || postBody.includes("data")) computedCategory = "data";

    try {
        await addDoc(collection(db, "posts"), {
            author: activeHandle,
            rank: currentLevel,
            skills: [...mySkills],
            category: computedCategory,
            content: textInput.value.trim(),
            media: mediaInput?.value.trim() || "",
            boosts: 0, retransmits: 0, notes: [], comments: [], timestamp: Date.now()
        });
        textInput.value = ""; if (mediaInput) mediaInput.value = "";
        logToTerminal(`TIMELINE DATABASE PIPELINE COMMITTED: Broadcast uploaded.`);
    } catch(err) {
        logToTerminal("❌ CLOUD TRANSMISSION REFUSED.");
    }
}

export function toggleContractEscrowModal(showFlag) {
    const modal = document.getElementById('contract-modal-overlay');
    if (modal) modal.style.display = showFlag ? 'flex' : 'none';
}

// 🔐 REAL SECURED ESCROW PAYLOAD ROUTING TRANSMITTER
export async function transmitCustomBountyOffer(userTokens, walletUpdateCallback, playSound, logToTerminal) {
    const title = document.getElementById('modal-contract-title').value.trim();
    const skills = document.getElementById('modal-contract-skills').value.trim();
    const stake = Number(document.getElementById('modal-contract-reward').value || 0);
    const activeHandle = document.getElementById('dev-name')?.innerText || "Anonymous_Node";

    if (!targetedInspectedProfile || targetedInspectedProfile.author === activeHandle) {
        return alert("Security Intercept: Cannot execute an escrow route targeting your own core handle.");
    }
    if (!title || stake < 10 || userTokens < stake) {
        return alert("Validation error matching structural ledger token thresholds.");
    }

    playSound('click');
    toggleContractEscrowModal(false);

    // Charge sender client wallet upfront & park inside escrow state hold document
    await walletUpdateCallback(-stake);
    logToTerminal(`🔒 STAKE LOCKED: Transmitting ${stake} CQ out of active wallet storage into Secure Escrow Hold...`);

    try {
        await addDoc(collection(db, "offers"), {
            title: title,
            requiredSkills: skills,
            tokenReward: stake,
            senderUser: activeHandle,
            targetUser: targetedInspectedProfile.author,
            status: "pending_approval",
            timestamp: Date.now()
        });
        logToTerminal(`📥 ESCROW COMPILED: Contract dispatched to remote tracking node [@${targetedInspectedProfile.author.toUpperCase()}]`);
        playSound('chime');
    } catch(e) {
        logToTerminal("❌ ESCROW CRITICAL FAIL: Transmission payload rejected by remote coordinator.");
    }
}

// 📥 RENDER INCOMING TRANSACTIONS HOOK TRAY (Only when I am the worker targeted)
export function renderIncomingOffersShelf(playSound, logToTerminal, walletUpdateCallback) {
    const shelf = document.getElementById('incoming-offers-shelf');
    if (!shelf) return;

    if (cachedIncomingOffers.length === 0) {
        shelf.innerHTML = `<div class="empty-state-notice" style="padding:0.5rem; font-size:0.7rem;">NO INCOMING ASSIGNMENT OFFER LEDGERS MOUNTED</div>`;
        return;
    }

    shelf.innerHTML = cachedIncomingOffers.map(offer => `
        <div class="party-item" style="border-left: 2px solid var(--glow); background:#11161d; gap:0.4rem; padding:0.6rem; border-radius:6px; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <strong style="font-size:0.75rem; color:#fff; display:block;">${offer.title}</strong>
                    <span style="font-size:0.62rem; color:var(--text-muted);">From: @${offer.senderUser}</span>
                </div>
                <span class="bounty-reward" style="background:var(--glow-bg); color:var(--glow); font-size:0.65rem;">💎 ${offer.tokenReward} CQ</span>
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted);">Requires: ${offer.requiredSkills}</div>
            <div style="display:flex; gap:0.3rem; margin-top:0.2rem;">
                <button class="claim-bounty-btn offer-decline-hook" data-id="${offer.id}" style="border-color:#f85149; color:#f85149; flex:1; padding:0.2rem; font-size:0.65rem;">Decline</button>
                <button class="claim-bounty-btn offer-accept-hook" data-id="${offer.id}" style="border-color:var(--glow); color:var(--glow); flex:1; padding:0.2rem; font-size:0.65rem;">Accept & Release</button>
            </div>
        </div>
    `).join('');

    shelf.querySelectorAll('.offer-accept-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const offer = cachedIncomingOffers.find(o => o.id === id);
            if (offer) {
                playSound('chime');
                // Target worker accepts payout stakes plus a system completion bonus
                await walletUpdateCallback(offer.tokenReward + 35);
                await deleteDoc(doc(db, "offers", id));
                logToTerminal(`💼 HANDSHAKE LINK EXECUTED: Released contract stakes into profile balance.`);
            }
        });
    });

    shelf.querySelectorAll('.offer-decline-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const offer = cachedIncomingOffers.find(o => o.id === id);
            if (offer) {
                playSound('click');
                // Return original payments directly to client entry document
                const senderProfileRef = doc(db, "users", offer.senderUser);
                try {
                    const snap = await getDoc(senderProfileRef);
                    if (snap.exists()) {
                        await updateDoc(senderProfileRef, { tokens: (snap.data().tokens || 250) + offer.tokenReward });
                    }
                } catch(err) {}
                await deleteDoc(doc(db, "offers", id));
                logToTerminal(`🛑 PIPELINE DECLINED: Escrow balances automatically refunded to client [@${offer.senderUser}]`);
            }
        });
    });
}

// 📤 RENDER OUTGOING CONTRACT REQUEST LOGS TRAY (Only when I am the client tracking progress)
export function renderOutgoingOffersShelf(playSound, logToTerminal, walletUpdateCallback) {
    const shelf = document.getElementById('outgoing-offers-shelf');
    if (!shelf) return;

    if (cachedOutgoingOffers.length === 0) {
        shelf.innerHTML = `<div class="empty-state-notice" style="padding:0.5rem; font-size:0.7rem;">NO OUTGOING REQUEST TRANSACTIONS DEPLOYED</div>`;
        return;
    }

    shelf.innerHTML = cachedOutgoingOffers.map(offer => `
        <div class="party-item" style="border-left: 2px solid var(--accent); background:#161b22; padding:0.6rem; border-radius:6px; display:flex; flex-direction:column; gap:0.3rem;">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <strong style="font-size:0.75rem; color:#fff; display:block;">${offer.title}</strong>
                    <span style="font-size:0.62rem; color:var(--text-muted);">Assigned Worker: @${offer.targetUser}</span>
                </div>
                <span class="bounty-reward" style="background:var(--accent-glow); color:var(--accent); font-size:0.65rem;">Staked: ${offer.tokenReward}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.2rem;">
                <span style="font-size:0.65rem; font-family:monospace; color:#f1c40f; text-transform:uppercase;">⏳ STATUS: PENDING APPROVAL</span>
                <button class="claim-bounty-btn offer-abort-hook" data-id="${offer.id}" data-reward="${offer.tokenReward}" style="border-color:#f85149; color:#f85149; max-width:65px; padding:0.15rem; font-size:0.65rem; margin:0;">
                    Abort
                </button>
            </div>
        </div>
    `).join('');

    shelf.querySelectorAll('.offer-abort-hook').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const refund = Number(e.target.getAttribute('data-reward'));
            playSound('click');
            
            // Abort escrow, refund client wallet instantly, delete tracing entry document
            await walletUpdateCallback(refund);
            await deleteDoc(doc(db, "offers", id));
            logToTerminal(`🛑 ESCROW ABORTED BY SENDER: Restored ${refund} CQ back into base profile balance.`);
        });
    });
}

export function triggerUserVouchHandshake(logToTerminal, endorsementsMap, syncRadarUI) {
    if (!targetedInspectedProfile) return;
    const coreSkill = targetedInspectedProfile.skills[0]; 
    if (!coreSkill) return;

    if (!endorsementsMap[coreSkill]) endorsementsMap[coreSkill] = 0;
    endorsementsMap[coreSkill] += 1;

    logToTerminal(`🤝 PEER REPUTATION BOOST: Endorsed user [@${targetedInspectedProfile.author.toUpperCase()}] skill tree node [${coreSkill}]`);
    inspectProfileRadarNode(targetedInspectedProfile.author, logToTerminal, endorsementsMap);
    syncRadarUI();
}
