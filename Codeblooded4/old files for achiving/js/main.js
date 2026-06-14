import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const storage = getStorage();
let registeredHandleKey = "Anonymous_Node";

// 🔊 LOGIC INTERFACE FX UTILITIES
export function playSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();                                                                                                                                                                  
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode); gainNode.connect(ctx.destination);
        if (type === 'click') {
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
            osc.start(); osc.stop(ctx.currentTime + 0.04);
        }
    } catch (e) {}
}

export function logToTerminal(message) {
    const stream = document.getElementById('terminal-stream');
    if (!stream) return;
    const timeStr = new Date().toTimeString().split(' ')[0];
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.innerHTML = `<span>[${timeStr}]</span> ${message}`;
    stream.appendChild(logLine);
    stream.scrollTop = stream.scrollHeight;
}

// 👤 LISTEN TO CHOSEN OPERATOR REAL-TIME PERSONAL DATABASE DOC
function listenToUserFirestoreRecords() {
    onSnapshot(doc(db, "users", registeredHandleKey), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        
        document.getElementById('profile-pane-focus').innerText = (data.focus || "Frontend Architect").toUpperCase();
        document.getElementById('profile-pane-bio').innerText = data.bio || "Active matrix worker inside CodeBlooded.";
        
        const nameDisplay = document.getElementById('guild-name-display');
        const metaDisplay = document.getElementById('guild-meta-display');
        if (data.guildAffiliation) {
            nameDisplay.innerText = `SYNDICATE: ${data.guildAffiliation.toUpperCase()}`;
            metaDisplay.innerText = `Node trace actively broadcasting security clearance tokens within the network loop.`;
        } else {
            nameDisplay.innerText = "NO ALLIANCE AFFILIATION FOUND";
            metaDisplay.innerText = "Independent operator node. Request entry or join a guild channel below.";
        }
        
        executeAlgorithmicMatchingAssessment(data.focus, data.bio);
    });
}

// 🧠 THE PROFILE MATCHING ANALYSIS ALGORITHM
function executeAlgorithmicMatchingAssessment(focusStr, bioStr) {
    if (!focusStr || !bioStr) return;
    
    const combinedString = (focusStr + " " + bioStr).toLowerCase();
    
    const hardwareMatches = (combinedString.match(/(hardware|cyber|port|security|kernel|sysop|system|verilog)/g) || []).length;
    const webInterfaceMatches = (combinedString.match(/(web|frontend|interface|css|js|component|design|ui|grid)/g) || []).length;
    const dataStreamMatches = (combinedString.match(/(data|database|sql|index|extraction|query|ml|model)/g) || []).length;
    
    const totalWeights = hardwareMatches + webInterfaceMatches + dataStreamMatches || 1;
    
    const calculatedHW = Math.min(100, Math.round((hardwareMatches / totalWeights) * 100) + 15);
    const calculatedWeb = Math.min(100, Math.round((webInterfaceMatches / totalWeights) * 100) + 20);
    const calculatedData = Math.min(100, Math.round((dataStreamMatches / totalWeights) * 100) + 10);
    
    if (document.getElementById('vector-hw')) document.getElementById('vector-hw').innerText = `${calculatedHW}%`;
    if (document.getElementById('vector-web')) document.getElementById('vector-web').innerText = `${calculatedWeb}%`;
    if (document.getElementById('vector-data')) document.getElementById('vector-data').innerText = `${calculatedData}%`;
    
    return { hw: calculatedHW, web: calculatedWeb, data: calculatedData };
}

// INTERCEPT AND READ USER TARGET PROFILE REGISTRY
async function interceptTargetProfileTelemetry(targetUserHandle) {
    const nameDisplay = document.getElementById('radar-profile-name');
    const rankDisplay = document.getElementById('radar-profile-rank');
    const focusDisplay = document.getElementById('radar-profile-focus');
    const bioDisplay = document.getElementById('radar-profile-bio');
    const reportDisplay = document.getElementById('radar-algorithmic-analysis');
    
    logToTerminal(`⚡ RUNNING INTERCEPT SPECTRUM ON NODE: @${targetUserHandle}`);
    
    nameDisplay.innerText = `@${targetUserHandle}`;
    rankDisplay.innerText = "RANK: PROCESSING...";
    focusDisplay.innerText = "Interrogating registry...";
    bioDisplay.innerText = "Extracting telemetry files from firestore...";
    
    try {
        const userDocRef = doc(db, "users", targetUserHandle);
        const snapshot = await getDoc(userDocRef);
        
        if (snapshot.exists()) {
            const data = snapshot.data();
            rankDisplay.innerText = `RANK: LEVEL ${data.level || 1}`;
            focusDisplay.innerText = (data.focus || "General Operations").toUpperCase();
            bioDisplay.innerText = data.bio || "No profile signature declared in records.";
            
            const targetWeights = executeAlgorithmicMatchingAssessment(data.focus, data.bio);
            if (targetWeights) {
                if (targetWeights.web > targetWeights.hw && targetWeights.web > targetWeights.data) {
                    reportDisplay.innerText = `📈 CRITICAL MATCH: High Front-End interface density found. Recommended candidate for core grid adjustments.`;
                    reportDisplay.style.color = "var(--accent)";
                } else if (targetWeights.hw > targetWeights.data) {
                    reportDisplay.innerText = `🛡️ THREAT AUDIT DETECTED: Security infrastructure orientation. Reliable entity for port routing tasks.`;
                    reportDisplay.style.color = "var(--glow)";
                } else {
                    reportDisplay.innerText = `🧮 SYSTEM NOTE: Deep telemetry pipeline focus identified. Best assigned to parsing server arrays.`;
                    reportDisplay.style.color = "#f1c40f";
                }
            }
        } else {
            rankDisplay.innerText = "RANK: NONE FOUND";
            focusDisplay.innerText = "UNREGISTERED SENDER";
            bioDisplay.innerText = "This node does not hold an initialized telemetry signature profile.";
            reportDisplay.innerText = "Cannot evaluate metric proximity ratios.";
            reportDisplay.style.color = "var(--text-muted)";
        }
    } catch (err) {
        logToTerminal("❌ PROFILE INTERCEPT REJECTED: Database query error.");
    }
}

// 🛸 SETUP REAL-TIME TIMELINE STREAM SYSTEM
function initializeRealtimeTimelineStream() {
    const timelineContainer = document.getElementById('social-feed-timeline');
    if (!timelineContainer) return;
    
    const timelineQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    
    onSnapshot(timelineQuery, (snapshot) => {
        timelineContainer.innerHTML = "";
        
        if (snapshot.empty) {
            timelineContainer.innerHTML = `<div style="text-align:center; padding:2rem; font-size:0.75rem; color:var(--text-muted);">No logs synchronized. Start the broadcast...</div>`;
            return;
        }
        
        snapshot.forEach(docRecord => {
            const post = docRecord.data();
            const postCard = document.createElement('div');
            postCard.className = "feed-post-card";
            
            const mediaRow = post.imageUrl 
                ? `<div class="feed-post-image-wrap"><img src="${post.imageUrl}" alt="Cloud Upload Asset"></div>` 
                : '';
                
            const displayTime = post.timestamp ? new Date(post.timestamp).toLocaleTimeString() : 'Recent';

            postCard.innerHTML = `
                <div class="feed-post-header">
                    <strong class="interactive-node-trigger" data-sender="${post.user}">@${post.user}</strong>
                    <span style="color: var(--text-muted); font-size:0.65rem;">${displayTime}</span>
                </div>
                <div class="feed-post-body">${post.text}</div>
                ${mediaRow}
            `;
            timelineContainer.appendChild(postCard);
        });
    });
}

// INTERCEPT SENDER HANDLE CLICKS
document.getElementById('social-feed-timeline')?.addEventListener('click', (e) => {
    const clickedTarget = e.target;
    if (clickedTarget.classList.contains('interactive-node-trigger')) {
        playSound('click');
        const clickedHandle = clickedTarget.getAttribute('data-sender');
        interceptTargetProfileTelemetry(clickedHandle);
    }
});

// SUBMIT NEW REAL-TIME TIMELINE MESSAGES
document.getElementById('post-submit-btn')?.addEventListener('click', async () => {
    playSound('click');
    const textInput = document.getElementById('post-text-input');
    const fileInput = document.getElementById('post-image-input');
    
    if (!textInput.value.trim() && !fileInput.files[0]) return;
    
    logToTerminal("INITIATING PACKET BROADCAST PIPELINE...");
    let uploadedAssetUrl = null;
    
    if (fileInput.files[0]) {
        const rawBlobFile = fileInput.files[0];
        const cloudStoragePointer = ref(storage, `timeline_blobs/${Date.now()}_${rawBlobFile.name}`);
        
        try {
            logToTerminal("Compressing binary stream to cloud system storage...");
            const uploadSnapshot = await uploadBytes(cloudStoragePointer, rawBlobFile);
            uploadedAssetUrl = await getDownloadURL(uploadSnapshot.ref);
            logToTerminal("CDN visual link generated successfully.");
        } catch (storageErr) {
            logToTerminal("❌ CLOUD BLOB UPLOAD FAILED. Aborting broadcast.");
            return;
        }
    }
    
    try {
        await addDoc(collection(db, "posts"), {
            user: registeredHandleKey,
            text: textInput.value,
            imageUrl: uploadedAssetUrl,
            timestamp: Date.now()
        });
        
        textInput.value = "";
        fileInput.value = "";
        logToTerminal("✓ TIMELINE LEDGER RECORD BROADCAST SUCCESSFUL.");
    } catch (dbErr) {
        logToTerminal("❌ DATA PIPELINE WRITE FAILED.");
    }
});

// 🛸 FIX: RELIABLE SYSTEM BOOT ROUTER SEQUENCE
function triggerSystemPipelineBootSequence() {
    const diagnosticBox = document.getElementById('boot-diagnostic-log');
    const connectBtn = document.getElementById('boot-connect-btn');
    const usernameField = document.getElementById('boot-username-field');
    const authForm = document.getElementById('boot-auth-form');
    const progressContainer = document.getElementById('boot-progress-container');
    const progressBar = document.getElementById('boot-progress-bar');
    
    const pushLog = (txt) => {
        if (!diagnosticBox) return;
        const log = document.createElement('div');
        log.innerText = `[LOG] ${txt}`;
        diagnosticBox.appendChild(log);
        diagnosticBox.scrollTop = diagnosticBox.scrollHeight;
    };

    setTimeout(() => pushLog("SCANNING SECURITY ACCESS LEDGER... READY."), 200);

    connectBtn?.addEventListener('click', async () => {
        playSound('click');
        const rawHandle = usernameField.value.trim();
        
        if (!rawHandle) {
            alert("Please input a valid crypto handle name.");
            return;
        }

        // Clean user handle structure string parameters safely
        registeredHandleKey = rawHandle.replace(/[^a-zA-Z0-9_]/g, "");
        document.getElementById('dev-name').innerText = `@${registeredHandleKey}`;

        // Switch panel components out of view
        authForm.style.display = "none";
        progressContainer.style.display = "flex";
        pushLog(`CONNECTING TO DECENTRALIZED DATA NODE...`);

        let displayOnboardingForm = false;

        try {
            // Check if user profile blueprint already exists in Firestore
            const profileSnapshot = await getDoc(doc(db, "users", registeredHandleKey));
            if (profileSnapshot.exists()) {
                pushLog("OPERATOR PROFILE MATCH VERIFIED. INDEXING CACHE...");
            } else {
                displayOnboardingForm = true;
                pushLog("NEW IDENTITY DISCOVERED. ROUTING PROFILE ENTRY PROMPTS...");
            }
        } catch (err) {
            // Handle offline/rule blockages safely without breaking layout streams
            pushLog("DATABASE CONNECT BLOCKED. PROCEEDING WITH TRANSIENT RECORD BUFFER...");
            displayOnboardingForm = true; 
        }

        // Animate progress loading metric vectors smoothly
        let currentPct = 0;
        const bootLoop = setInterval(() => {
            currentPct += 20;
            if (progressBar) progressBar.style.width = `${currentPct}%`;
            if (document.getElementById('boot-progress-percent')) {
                document.getElementById('boot-progress-percent').innerText = `${currentPct}%`;
            }

            if (currentPct >= 100) {
                clearInterval(bootLoop);
                
                // Remove shielding curtain entirely
                document.getElementById('boot-sequence-shield').style.display = "none";
                
                if (displayOnboardingForm) {
                    document.getElementById('onboarding-modal-overlay').style.display = "flex";
                } else {
                    document.querySelector('.master-dashboard-layout').classList.remove('system-hidden-state');
                    listenToUserFirestoreRecords();
                    initializeRealtimeTimelineStream();
                    logToTerminal(`🚀 TERMINAL INTERCEPT LINK ESTABLISHED FOR OPERATOR: @${registeredHandleKey}`);
                }
            }
        }, 150);
    });
}

// PROFILE COMMIT FOR ONBOARDING
document.getElementById('onboard-submit-btn')?.addEventListener('click', async () => {
    playSound('click');
    const focusVal = document.getElementById('onboard-focus').value.trim() || "Frontend Developer";
    const bioVal = document.getElementById('onboard-bio').value.trim() || "Operating system worker inside CodeBlooded.";

    try {
        await setDoc(doc(doc(db, "users", registeredHandleKey)), {
            handle: registeredHandleKey, level: 1, xp: 45, tokens: 250, focus: focusVal, bio: bioVal, timestamp: Date.now(), guildAffiliation: ""
        });
    } catch(e) {
        logToTerminal("⚠️ Database write restricted. Running on fallback buffer mode.");
    }
    
    document.getElementById('onboarding-modal-overlay').style.display = "none";
    document.querySelector('.master-dashboard-layout').classList.remove('system-hidden-state');
    
    listenToUserFirestoreRecords();
    initializeRealtimeTimelineStream();
    logToTerminal(`✅ OPERATOR INITIALIZATION COMPLETE: Welcome @${registeredHandleKey}`);
});

document.getElementById('create-guild-btn')?.addEventListener('click', async () => {
    playSound('click');
    const guildInput = document.getElementById('guild-name-input');
    const customName = guildInput?.value.trim();
    if (!customName) return;
    try {
        await updateDoc(doc(db, "users", registeredHandleKey), { guildAffiliation: customName });
        guildInput.value = "";
        logToTerminal(`🛡️ ALLIANCE SHIFT: Re-enlisting terminal core files to group [${customName}]`);
    } catch (err) {}
});

// UI PANEL NAVIGATION SYSTEM FUNCTION
document.querySelectorAll('.sidebar-navigation .nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        playSound('click');
        const targetTabElement = e.currentTarget;
        const bufferShutter = document.getElementById('telemetry-buffer-shutter');
        
        if (bufferShutter) bufferShutter.style.display = "flex";
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.workspace-view').forEach(v => v.classList.remove('active'));
        
        targetTabElement.classList.add('active');
        const viewId = targetTabElement.getAttribute('data-target');

        setTimeout(() => {
            const destinationView = document.getElementById(viewId);
            if (destinationView) destinationView.classList.add('active');
            if (bufferShutter) bufferShutter.style.display = "none";
        }, 200);
    });
});

triggerSystemPipelineBootSequence();
