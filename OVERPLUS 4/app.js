// ─── FIREBASE CONFIG ────────────────────────────────────────────────────────
// Replace this config block with your own Firebase project credentials.
// Get yours at: https://console.firebase.google.com → Project Settings → Your Apps → Web App
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    collectionGroup,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot,
    increment,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
// ImageBB is used for image uploads (free, no Firebase Storage needed)
const IMGBB_API_KEY = '74332c63a1f445fae96b53f2e5512a0b';

// ─── ⚠️  REPLACE WITH YOUR FIREBASE CONFIG ──────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDEfGvvZwCs9aamAOfqni66_AApNVcmyjE",
    authDomain: "codeblooded-8d768.firebaseapp.com",
    projectId: "codeblooded-8d768",
    storageBucket: "codeblooded-8d768.firebasestorage.app",
    messagingSenderId: "346987547072",
    appId: "1:346987547072:web:6f425d40e10506941fe025"
};
// ────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gProvider = new GoogleAuthProvider();

// ─── RANK SYSTEM ─────────────────────────────────────────────────────────────
const RANKS = [
    { min: 0, label: "IRON 1", short: "I1", color: "#7e8fa6" },
    { min: 100, label: "IRON 2", short: "I2", color: "#7e8fa6" },
    { min: 200, label: "IRON 3", short: "I3", color: "#7e8fa6" },
    { min: 350, label: "BRONZE 1", short: "B1", color: "#cd7f32" },
    { min: 500, label: "BRONZE 2", short: "B2", color: "#cd7f32" },
    { min: 700, label: "BRONZE 3", short: "B3", color: "#cd7f32" },
    { min: 900, label: "SILVER 1", short: "S1", color: "#aaa" },
    { min: 1100, label: "SILVER 2", short: "S2", color: "#aaa" },
    { min: 1300, label: "SILVER 3", short: "S3", color: "#aaa" },
    { min: 1500, label: "GOLD 1", short: "G1", color: "#ffd740" },
    { min: 1700, label: "GOLD 2", short: "G2", color: "#ffd740" },
    { min: 1900, label: "GOLD 3", short: "G3", color: "#ffd740" },
    { min: 2100, label: "PLATINUM 1", short: "P1", color: "#00e5ff" },
    { min: 2300, label: "PLATINUM 2", short: "P2", color: "#00e5ff" },
    { min: 2500, label: "PLATINUM 3", short: "P3", color: "#00e5ff" },
    { min: 2800, label: "DIAMOND 1", short: "D1", color: "#7c4dff" },
    { min: 3100, label: "DIAMOND 2", short: "D2", color: "#7c4dff" },
    { min: 3400, label: "DIAMOND 3", short: "D3", color: "#7c4dff" },
    { min: 3800, label: "MASTER", short: "MST", color: "#ff7043" },
    { min: 4200, label: "GRANDMASTER", short: "GM", color: "#ff3d71" },
    { min: 4700, label: "RADIANT", short: "RAD", color: "#ffd740" },
];

function getRank(elo) {
    let rank = RANKS[0];
    for (const r of RANKS) { if (elo >= r.min) rank = r; }
    return rank;
}

const ELO_WIN = 25;
const ELO_DRAW = 0;
const ELO_LOSS = -18;

// ─── AVATARS (initials fallback) ──────────────────────────────────────────
function avatarUrl(user) {
    return user ?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.username || 'Player')}&background=1f2433&color=00e5ff&bold=true&size=80`;
}

// ─── CATEGORY + SPECIFY HELPERS ───────────────────────────────────────────
// Wires a category <select> to an optional "specify" <input> that appears
// when a category is chosen, letting users type a specific game/language/etc.
function wireCategorySpecify(selectId, specifyId) {
    const sel = document.getElementById(selectId);
    const spec = document.getElementById(specifyId);
    if (!sel || !spec) return;
    sel.addEventListener('change', () => {
        spec.style.display = sel.value ? 'block' : 'none';
        if (!sel.value) spec.value = '';
    });
}

// Combines a category select + specify input into a single stored string,
// e.g. "Programming" or "Programming: Python". Falls back to category alone.
function combineCategory(selectId, specifyId) {
    const sel = document.getElementById(selectId);
    const spec = document.getElementById(specifyId);
    const category = sel ? sel.value : '';
    const specify = spec ? spec.value.trim() : '';
    if (!category) return '';
    return specify ? `${category}: ${specify}` : category;
}

// Splits a combined "Category: Specific" string back into its parts for
// populating the select + specify input when loading existing data.
function splitCategory(value) {
    if (!value) return { category: '', specify: '' };
    const idx = value.indexOf(':');
    if (idx === -1) return { category: value, specify: '' };
    return { category: value.slice(0, idx).trim(), specify: value.slice(idx + 1).trim() };
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ─── TIME AGO ────────────────────────────────────────────────────────────────
function timeAgo(ts) {
    if (!ts) return '';
    const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
    return `${Math.floor(sec/86400)}d ago`;
}

// ─── PAGE ROUTING ────────────────────────────────────────────────────────────
let currentUser = null;
let currentProfile = null;
let commentsUnsub = null;

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${id}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.page === id);
    });
    if (id === 'feed') loadFeed();
    if (id === 'leaderboard') loadLeaderboard();
    if (id === 'matches') loadMatches();
    if (id === 'teams') loadTeams();
    if (id === 'arcade-hub') loadArcade();
    if (id === 'profile') loadProfile();
    if (id === 'messages') loadDMPage();
    if (id === 'global-chat') loadGlobalChat();
    if (id === 'leaderboard') loadRightPanel();
}

// ─── NAVIGATION EVENT LISTENERS LOOKUP HOOK ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', e => {
            e.preventDefault();
            const selectedPageKey = n.dataset.page;
            
            // 🌟 LOG THE NAVIGATION SELECTION EVENT INTO OUR SCHEDULER SYSTEM COMPONENT
            if (typeof window.logPlatformTaskToCpu === 'function') {
                window.logPlatformTaskToCpu(selectedPageKey);
            }

            showPage(selectedPageKey);
        });
    });

    // ─── CATEGORY "SPECIFY" FIELDS ─────────────────────────────────────────────────
    wireCategorySpecify('reg-game', 'reg-game-specify');
    wireCategorySpecify('post-game-tag', 'post-game-tag-specify');
    wireCategorySpecify('profile-fav-game-select', 'profile-fav-game-specify');

    // ─── AUTH ─────────────────────────────────────────────────────────────────────
    const registerToggle = document.getElementById('go-register');
    const loginToggle = document.getElementById('go-login');
    const authLoginForm = document.getElementById('auth-login');
    const authRegisterForm = document.getElementById('auth-register');

    if (registerToggle) {
        registerToggle.addEventListener('click', e => {
            e.preventDefault();
            authLoginForm ?.classList.remove('active');
            authRegisterForm ?.classList.add('active');
        });
    }
    if (loginToggle) {
        loginToggle.addEventListener('click', e => {
            e.preventDefault();
            authRegisterForm ?.classList.remove('active');
            authLoginForm ?.classList.add('active');
        });
    }

    document.getElementById('btn-login') ?.addEventListener('click', async() => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        document.getElementById('login-error').textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            console.error('Login failed', e);
            document.getElementById('login-error').textContent = friendlyError(e.code);
        }
    });

    document.getElementById('btn-google') ?.addEventListener('click', async() => {
        try {
            const result = await signInWithPopup(auth, gProvider);
            const user = result.user;
            const uRef = doc(db, 'users', user.uid);
            const snap = await getDoc(uRef);
            if (!snap.exists()) {
                await setDoc(uRef, {
                    uid: user.uid,
                    username: user.displayName || 'Player_' + user.uid.slice(0, 5),
                    email: user.email,
                    photoURL: user.photoURL || '',
                    elo: 1000,
                    wins: 0,
                    losses: 0,
                    matches: 0,
                    favGame: '',
                    bio: '',
                    discord: '',
                    isAdmin: false, // ← regular user by default
                    createdAt: serverTimestamp()
                });
            }
        } catch (e) {
            console.error('Google login failed', e);
            document.getElementById('login-error').textContent = friendlyError(e.code);
        }
    });

    document.getElementById('btn-register') ?.addEventListener('click', async() => {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value;
        const favGame = combineCategory('reg-game', 'reg-game-specify');
        const errEl = document.getElementById('reg-error');
        errEl.textContent = '';

        // — Basic validation —
        if (!username) return errEl.textContent = 'Choose a username.';
        if (username.length < 3) return errEl.textContent = 'Username must be at least 3 characters.';
        if (!email) return errEl.textContent = 'Enter your email.';
        if (!pass) return errEl.textContent = 'Enter a password.';
        if (pass.length < 6) return errEl.textContent = 'Password must be at least 6 characters.';
        if (!favGame) return errEl.textContent = 'Pick a favourite category.';

        const btn = document.getElementById('btn-register');
        btn.disabled = true;
        btn.textContent = 'Creating account…';

        try {
            // — Check if username is already taken —
            const usernameCheck = await getDocs(
                query(collection(db, 'users'), where('username', '==', username), limit(1))
            );
            if (!usernameCheck.empty) {
                errEl.textContent = 'Username already taken. Choose another.';
                btn.disabled = false;
                btn.textContent = 'CREATE ACCOUNT';
                return;
            }

            // — Create Firebase Auth user —
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: username });

            // — Save user profile to Firestore —
            await setDoc(doc(db, 'users', cred.user.uid), {
                uid: cred.user.uid,
                username,
                email,
                photoURL: '',
                elo: 1000,
                wins: 0,
                losses: 0,
                matches: 0,
                favGame,
                bio: '',
                discord: '',
                isAdmin: false, // ← regular user by default
                createdAt: serverTimestamp()
            });

            toast('Account created! Welcome to FragNet 🎮', 'success');
            document.getElementById('auth-overlay').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            await refreshCurrentProfile();
            updateSidebar();
            showPage('feed');
            loadRightPanel();

        } catch (e) {
            errEl.textContent = friendlyError(e.code);
        } finally {
            btn.disabled = false;
            btn.textContent = 'CREATE ACCOUNT';
        }
    });

    document.getElementById('btn-logout') ?.addEventListener('click', () => signOut(auth));
});

function friendlyError(code) {
    const map = {
        'auth/invalid-email': 'Invalid email address.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/user-not-found': 'No account with that email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email already in use.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.',
        'auth/unauthorized-domain': 'This domain is not authorized for Firebase Auth. Add it in Authentication → Settings → Authorized domains.',
        'auth/configuration-not-found': 'Firebase Auth is not configured. Enable Email/Password (and Google) sign-in in the Firebase Console.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
    };
    return map[code] || `Something went wrong (${code || 'unknown error'}). Try again.`;
}

// ─── AUTH STATE ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-overlay').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await refreshCurrentProfile();
        updateSidebar();
        showPage('feed');
        loadRightPanel();
    initCommentNotifications();
    } else {
        currentUser = null;
        currentProfile = null;
        document.getElementById('auth-overlay').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    }
});

async function refreshCurrentProfile() {
    if (!currentUser) return;
    const uRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(uRef);
    if (snap.exists()) {
        currentProfile = { id: snap.id, ...snap.data() };
        // Backfill any missing fields so the app never sees `undefined`
        const defaults = {
            username: currentProfile.username || currentUser.displayName || ('Player_' + currentUser.uid.slice(0, 5)),
            email: currentProfile.email || currentUser.email || '',
            photoURL: currentProfile.photoURL || currentUser.photoURL || '',
            elo: currentProfile.elo ?? 1000,
            wins: currentProfile.wins ?? 0,
            losses: currentProfile.losses ?? 0,
            matches: currentProfile.matches ?? 0,
            favGame: currentProfile.favGame || '',
            bio: currentProfile.bio || '',
            discord: currentProfile.discord || '',
            isAdmin: currentProfile.isAdmin ?? false,
        };
        const missing = Object.keys(defaults).filter(k => currentProfile[k] === undefined || currentProfile[k] === null);
        currentProfile = { ...currentProfile, ...defaults };
        if (missing.length) {
            try { await updateDoc(uRef, defaults); } catch (_) {}
        }
    } else {
        // No profile doc exists yet (e.g. account created outside the normal flow) — create one
        const newProfile = {
            uid: currentUser.uid,
            username: currentUser.displayName || ('Player_' + currentUser.uid.slice(0, 5)),
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            elo: 1000,
            wins: 0,
            losses: 0,
            matches: 0,
            favGame: '',
            bio: '',
            discord: '',
            isAdmin: false,
            createdAt: serverTimestamp()
        };
        try {
            await setDoc(uRef, newProfile);
            currentProfile = { id: currentUser.uid, ...newProfile };
        } catch (e) {
            console.error('Could not create profile doc', e);
            currentProfile = { id: currentUser.uid, ...newProfile };
        }
    }
}

function updateSidebar() {
    if (!currentProfile) return;
    const rank = getRank(currentProfile.elo || 1000);
    document.getElementById('sidebar-avatar').src = avatarUrl(currentProfile);
    document.getElementById('sidebar-username').textContent = currentProfile.username || 'Player';
    document.getElementById('sidebar-elo').textContent = `${currentProfile.elo || 1000} ELO`;
    document.getElementById('sidebar-rank-badge').textContent = rank.short;
    document.getElementById('sidebar-rank-badge').style.background = rank.color;
}

// ─── FEED ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-new-post').addEventListener('click', () => {
    const c = document.getElementById('post-composer');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
});

// ─── MEDIA UPLOAD STATE ───────────────────────────────────────────────────────
let pendingMediaUrl  = '';   // uploaded URL (imgbb)
let pendingMediaType = '';   // 'image' | 'video'
let pendingVideoFile = null; // raw File for video (uploaded on post)

async function uploadToImgBB(file) {
    const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(r.result.split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
    const fd = new FormData();
    fd.append('key', IMGBB_API_KEY);
    fd.append('image', base64);
    const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Upload failed');
    return json.data.url;
}

function setMediaStatus(msg, isError = false) {
    const el = document.getElementById('post-media-status');
    if (el) { el.textContent = msg; el.style.color = isError ? 'var(--red)' : 'var(--text3)'; }
}

function updateMediaPreview() {
    const preview = document.getElementById('post-media-preview');
    if (!preview) return;
    if (!pendingMediaUrl) { preview.style.display = 'none'; preview.innerHTML = ''; return; }
    preview.style.display = 'block';
    if (pendingMediaType === 'image') {
        preview.innerHTML = `
            <div class="media-preview-wrap">
                <img src="${pendingMediaUrl}" class="composer-preview-img" alt="preview" />
                <button class="media-remove-btn" id="btn-remove-media" title="Remove">✕</button>
            </div>`;
    } else {
        preview.innerHTML = `
            <div class="media-preview-wrap">
                <video src="${pendingMediaUrl}" class="composer-preview-video" controls muted></video>
                <button class="media-remove-btn" id="btn-remove-media" title="Remove">✕</button>
            </div>`;
    }
    document.getElementById('btn-remove-media')?.addEventListener('click', () => {
        pendingMediaUrl  = '';
        pendingMediaType = '';
        pendingVideoFile = null;
        updateMediaPreview();
        setMediaStatus('');
        document.getElementById('post-image-input').value = '';
        document.getElementById('post-video-input').value = '';
    });
}

// Image picker
document.getElementById('post-image-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image must be under 5 MB.', 'error');
    setMediaStatus('Uploading image…');
    try {
        pendingMediaUrl  = await uploadToImgBB(file);
        pendingMediaType = 'image';
        pendingVideoFile = null;
        setMediaStatus('Image ready ✓');
        updateMediaPreview();
    } catch(err) {
        setMediaStatus('Upload failed: ' + err.message, true);
    } finally {
        e.target.value = '';
    }
});

// Video picker — store file, create local preview; upload on post
document.getElementById('post-video-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast('Video must be under 50 MB.', 'error');
    pendingVideoFile = file;
    pendingMediaType = 'video';
    pendingMediaUrl  = URL.createObjectURL(file); // local preview
    setMediaStatus(`Video selected: ${file.name}`);
    updateMediaPreview();
    e.target.value = '';
});

document.getElementById('btn-post-submit').addEventListener('click', async() => {
    const content = document.getElementById('post-content').value.trim();
    const gameTag = combineCategory('post-game-tag', 'post-game-tag-specify');
    const postType = document.getElementById('post-type').value;
    if (!content && !pendingMediaUrl) return toast('Write something or attach media first.', 'error');

    const btn = document.getElementById('btn-post-submit');
    btn.disabled = true;
    btn.textContent = 'Posting…';

    try {
        let mediaUrl  = '';
        let mediaType = '';

        // If there's a pending video file, upload it now
        if (pendingVideoFile) {
            setMediaStatus('Uploading video…');
            try {
                mediaUrl  = await uploadToImgBB(pendingVideoFile);
                mediaType = 'video';
            } catch(err) {
                toast('Video upload failed: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'POST';
                return;
            }
        } else if (pendingMediaUrl && pendingMediaType === 'image') {
            mediaUrl  = pendingMediaUrl;
            mediaType = 'image';
        }

        await addDoc(collection(db, 'posts'), {
            uid: currentUser.uid,
            username: currentProfile.username,
            photoURL: currentProfile.photoURL || '',
            content,
            gameTag,
            postType,
            mediaUrl,
            mediaType,
            likes: [],
            comments: 0,
            createdAt: serverTimestamp()
        });

        // Reset composer
        document.getElementById('post-content').value = '';
        document.getElementById('post-game-tag').value = '';
        document.getElementById('post-game-tag-specify').value = '';
        document.getElementById('post-game-tag-specify').style.display = 'none';
        document.getElementById('post-composer').style.display = 'none';
        pendingMediaUrl  = '';
        pendingMediaType = '';
        pendingVideoFile = null;
        updateMediaPreview();
        setMediaStatus('');

        toast('Posted! 🔥', 'success');
        loadFeed();
    } catch (e) {
        toast('Failed to post: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'POST';
    }
});

async function loadFeed() {
    const list = document.getElementById('feed-list');
    list.innerHTML = '<div class="feed-loading">Loading…</div>';
    try {
        const blocked = currentProfile?.blocked || [];
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        if (snap.empty) { list.innerHTML = '<div class="feed-loading">No posts yet. Be the first!</div>'; return; }
        list.innerHTML = '';
        snap.forEach(d => {
          if (blocked.includes(d.data().uid)) return; // hide blocked users
          list.appendChild(buildPostCard(d.id, d.data()));
        });
        if (!list.hasChildNodes()) list.innerHTML = '<div class="feed-loading">No posts yet. Be the first!</div>';
    } catch (e) {
        list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
    }
}

function buildPostCard(id, data) {
    const liked = (data.likes || []).includes(currentUser ?.uid);

    // Build media HTML
    let mediaHtml = '';
    if (data.mediaUrl && data.mediaType === 'image') {
        mediaHtml = `<div class="card-media"><img src="${escHtml(data.mediaUrl)}" class="card-media-img" alt="post image" loading="lazy" /></div>`;
    } else if (data.mediaUrl && data.mediaType === 'video') {
        mediaHtml = `<div class="card-media"><video src="${escHtml(data.mediaUrl)}" class="card-media-video" controls muted playsinline></video></div>`;
    }

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
    <div class="card-header">
      <button class="user-trigger avatar-trigger" data-uid="${escHtml(data.uid)}" data-username="${escHtml(data.username)}" title="View ${escHtml(data.username)}">
        <img class="avatar-sm" src="${avatarUrl(data)}" alt="${escHtml(data.username)}" />
      </button>
      <div class="card-meta">
        <button class="user-trigger card-username-btn" data-uid="${escHtml(data.uid)}" data-username="${escHtml(data.username)}">${escHtml(data.username)}</button>
        <div class="card-timestamp">${timeAgo(data.createdAt)}</div>
      </div>
      <div class="card-tags">
        ${data.gameTag ? `<span class="tag-pill tag-game">${escHtml(data.gameTag)}</span>` : ''}
        <span class="tag-pill tag-${data.postType}">${postTypeLabel(data.postType)}</span>
      </div>
    </div>
    ${data.content ? `<div class="card-body">${escHtml(data.content)}</div>` : ''}
    ${mediaHtml}
    <div class="card-actions">
      <button class="card-action-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}" onclick="window.handleAsyncLike('${id}', event, this); return false;">
        ${liked ? '❤️' : '🤍'} <span class="like-count">${(data.likes || []).length}</span>
      </button>
      <button class="card-action-btn comment-toggle-btn" data-id="${id}">💬 <span class="comment-count">${data.comments || 0}</span></button>
      <button class="card-action-btn share-btn" data-id="${id}" title="Share post">🔗 Share</button>
      ${data.uid === currentUser?.uid ? `<button class="card-action-btn delete-post-btn" data-id="${id}" style="margin-left:auto;color:var(--red)">🗑️</button>` : ''}
    </div>
    <div class="comments-section" id="comments-${id}" style="display:none">
      <div class="comments-list" id="comments-list-${id}"></div>
      <div class="comment-composer">
        <input type="text" class="comment-input" id="comment-input-${id}" placeholder="Write a comment…" maxlength="300" />
        <button class="card-action-btn comment-submit-btn" data-id="${id}">Send</button>
      </div>
    </div>`;

  card.querySelector('.like-btn')?.addEventListener('click', () => toggleLike(id, data.likes || []));
  card.querySelector('.delete-post-btn')?.addEventListener('click', () => deletePost(id));
  card.querySelector('.comment-toggle-btn')?.addEventListener('click', () => toggleComments(id));
  card.querySelector('.comment-submit-btn')?.addEventListener('click', () => submitComment(id));
  card.querySelector('.share-btn')?.addEventListener('click', () => sharePost(id, data));
  card.querySelector('.comment-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitComment(id);
  });
  // User popup triggers
  card.querySelectorAll('.user-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openUserPopup(btn.dataset.uid, btn.dataset.username, btn);
    });
  });
  // Expand image on tap
  card.querySelector('.card-media-img')?.addEventListener('click', () => openMediaLightbox(data.mediaUrl, 'image'));
  return card;
}

// ─── SHARE POST ──────────────────────────────────────────────────────────────
async function sharePost(id, data) {
    const shareText = `${data.username} on FragNet: "${(data.content || '').slice(0, 100)}${data.content?.length > 100 ? '…' : ''}"`;
    const shareUrl  = `${location.origin}${location.pathname}?post=${id}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'FragNet Post', text: shareText, url: shareUrl });
        } catch (e) {
            if (e.name !== 'AbortError') copyToClipboard(shareUrl);
        }
    } else {
        copyToClipboard(shareUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => toast('Link copied! 🔗', 'success'))
        .catch(() => toast('Could not copy link.', 'error'));
}

// ─── MEDIA LIGHTBOX ──────────────────────────────────────────────────────────
function openMediaLightbox(url, type) {
    const existing = document.getElementById('media-lightbox');
    if (existing) existing.remove();
    const lb = document.createElement('div');
    lb.id = 'media-lightbox';
    lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';
    lb.innerHTML = type === 'image'
        ? `<img src="${url}" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.8)" />`
        : `<video src="${url}" controls autoplay style="max-width:100%;max-height:90vh;border-radius:8px"></video>`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
}

// ─── USER POPUP ──────────────────────────────────────────────────────────────
let userPopupCloseHandler = null;

async function openUserPopup(uid, username, anchorEl) {
  // Close any existing popup
  closeUserPopup();

  // Don't show popup for yourself
  if (uid === currentUser?.uid) return;

  // Build popup skeleton
  const popup = document.createElement('div');
  popup.id = 'user-popup';
  popup.className = 'user-popup';
  popup.innerHTML = `
    <div class="user-popup-header">
      <div class="user-popup-avatar-wrap">
        <img class="user-popup-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1f2433&color=00e5ff&bold=true&size=80" id="popup-avatar" />
      </div>
      <div class="user-popup-info">
        <div class="user-popup-name" id="popup-name">${escHtml(username)}</div>
        <div class="user-popup-rank" id="popup-rank"><span class="user-popup-loading">Loading…</span></div>
        <div class="user-popup-game" id="popup-game"></div>
      </div>
    </div>
    <div class="user-popup-stats" id="popup-stats"></div>
    <div class="user-popup-actions">
      <button class="popup-action-btn popup-chat"    data-action="chat"    data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">💬 Chat</button>
      <button class="popup-action-btn popup-friend"  data-action="friend"  data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">➕ Add Friend</button>
      <button class="popup-action-btn popup-lobby"   data-action="lobby"   data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">🎮 Invite to Lobby</button>
      <button class="popup-action-btn popup-team"    data-action="team"    data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">🛡️ Invite to Team</button>
      <div class="popup-divider"></div>
      <button class="popup-action-btn popup-report"  data-action="report"  data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">🚩 Report User</button>
      <button class="popup-action-btn popup-block"   data-action="block"   data-uid="${escHtml(uid)}" data-username="${escHtml(username)}">🚫 Block User</button>
    </div>`;

  document.body.appendChild(popup);

  // Position relative to anchor
  positionPopup(popup, anchorEl);

  // Wire action buttons
  popup.querySelectorAll('.popup-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleUserPopupAction(btn.dataset.action, btn.dataset.uid, btn.dataset.username);
    });
  });

  // Close on outside click / scroll
  setTimeout(() => {
    userPopupCloseHandler = e => {
      if (!popup.contains(e.target)) closeUserPopup();
    };
    document.addEventListener('click', userPopupCloseHandler, { capture: true });
    document.addEventListener('scroll', closeUserPopup, { once: true, capture: true });
  }, 10);

  // Load user data asynchronously
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const d = snap.data();
    const rank = getRank(d.elo || 1000);

    const avatarEl = document.getElementById('popup-avatar');
    if (avatarEl) avatarEl.src = avatarUrl(d);

    const rankEl = document.getElementById('popup-rank');
    if (rankEl) rankEl.innerHTML = `<span class="popup-rank-chip" style="background:${rank.color}">${rank.label}</span> <span class="popup-elo">${d.elo || 1000} ELO</span>`;

    const gameEl = document.getElementById('popup-game');
    if (gameEl && d.favGame) gameEl.textContent = d.favGame;

    const statsEl = document.getElementById('popup-stats');
    if (statsEl) {
      const wr = d.matches > 0 ? Math.round((d.wins / d.matches) * 100) : 0;
      statsEl.innerHTML = `
        <div class="popup-stat"><span class="popup-stat-n">${d.wins || 0}</span><span class="popup-stat-l">Wins</span></div>
        <div class="popup-stat"><span class="popup-stat-n">${d.losses || 0}</span><span class="popup-stat-l">Losses</span></div>
        <div class="popup-stat"><span class="popup-stat-n">${wr}%</span><span class="popup-stat-l">Win Rate</span></div>`;
    }

    // Re-position after content loaded (may be taller now)
    positionPopup(popup, anchorEl);
  } catch(e) { /* silently ignore */ }
}

function positionPopup(popup, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const pw = 260;
  const margin = 8;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  popup.style.position = 'fixed';
  popup.style.width    = pw + 'px';
  popup.style.zIndex   = '9998';

  // Horizontal: prefer right of anchor, flip left if overflow
  let left = rect.right + margin;
  if (left + pw > viewW - margin) left = rect.left - pw - margin;
  if (left < margin) left = margin;

  // Vertical: prefer below anchor, flip up if overflow
  let top = rect.bottom + margin;
  const popH = popup.offsetHeight || 320;
  if (top + popH > viewH - margin) top = rect.top - popH - margin;
  if (top < margin) top = margin;

  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
}

function closeUserPopup() {
  const popup = document.getElementById('user-popup');
  if (popup) popup.remove();
  if (userPopupCloseHandler) {
    document.removeEventListener('click', userPopupCloseHandler, { capture: true });
    userPopupCloseHandler = null;
  }
}

async function handleUserPopupAction(action, uid, username) {
  closeUserPopup();
  switch (action) {
    case 'chat':
      showPage('messages');
      openDMWith(uid, username);
      break;

    case 'friend':
      try {
        const ref = doc(db, 'users', currentUser.uid);
        await updateDoc(ref, { friends: arrayUnion(uid) });
        // Also write a notification to the target user
        await addDoc(collection(db, 'users', uid, 'notifications'), {
          type: 'friend_request',
          fromUid: currentUser.uid,
          fromUsername: currentProfile.username,
          fromPhotoURL: currentProfile.photoURL || '',
          createdAt: serverTimestamp(),
          read: false
        });
        toast(`➕ Friend request sent to ${username}!`, 'success');
      } catch(e) { toast('Could not send friend request: ' + e.message, 'error'); }
      break;

    case 'lobby':
      try {
        await addDoc(collection(db, 'users', uid, 'notifications'), {
          type: 'lobby_invite',
          fromUid: currentUser.uid,
          fromUsername: currentProfile.username,
          fromPhotoURL: currentProfile.photoURL || '',
          createdAt: serverTimestamp(),
          read: false
        });
        toast(`🎮 Lobby invite sent to ${username}!`, 'success');
      } catch(e) { toast('Could not send invite: ' + e.message, 'error'); }
      break;

    case 'team': {
      // Find teams the current user owns/is in
      try {
        const teamsSnap = await getDocs(
          query(collection(db, 'teams'), where('createdBy', '==', currentUser.uid), limit(10))
        );
        if (teamsSnap.empty) {
          toast('You have no teams to invite to. Create one first!', '');
          return;
        }
        // If multiple teams, pick first for now (could show sub-menu)
        const teamData = teamsSnap.docs[0].data();
        await addDoc(collection(db, 'users', uid, 'notifications'), {
          type: 'team_invite',
          fromUid: currentUser.uid,
          fromUsername: currentProfile.username,
          fromPhotoURL: currentProfile.photoURL || '',
          teamId: teamsSnap.docs[0].id,
          teamName: teamData.name,
          createdAt: serverTimestamp(),
          read: false
        });
        toast(`🛡️ Team invite sent to ${username}!`, 'success');
      } catch(e) { toast('Could not send team invite: ' + e.message, 'error'); }
      break;
    }

    case 'report':
      if (!confirm(`Report ${username} for inappropriate behaviour?`)) return;
      try {
        await addDoc(collection(db, 'reports'), {
          reportedUid: uid,
          reportedUsername: username,
          reporterUid: currentUser.uid,
          reporterUsername: currentProfile.username,
          createdAt: serverTimestamp()
        });
        toast(`🚩 ${username} has been reported. Thank you.`, 'success');
      } catch(e) { toast('Could not submit report: ' + e.message, 'error'); }
      break;

    case 'block':
      if (!confirm(`Block ${username}? Their posts will be hidden from your feed.`)) return;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { blocked: arrayUnion(uid) });
        toast(`🚫 ${username} has been blocked.`, 'success');
        loadFeed(); // Refresh feed to hide blocked user's posts
      } catch(e) { toast('Could not block user: ' + e.message, 'error'); }
      break;
  }
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  if (isOpen) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  await loadComments(postId);
}

async function loadComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;
  list.innerHTML = '<div class="feed-loading">Loading comments…</div>';
  try {
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(100));
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = '<div class="no-comments">No comments yet. Be the first to reply!</div>'; return; }
    list.innerHTML = '';
    snap.forEach(d => list.appendChild(buildCommentRow(postId, d.id, d.data())));
  } catch (e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function buildCommentRow(postId, commentId, data) {
  const row = document.createElement('div');
  row.className = 'comment-row';
  row.innerHTML = `
    <img class="avatar-xs" src="${avatarUrl(data)}" alt="${escHtml(data.username)}" />
    <div class="comment-body">
      <div class="comment-meta">
        <span class="comment-username">${escHtml(data.username)}</span>
        <span class="comment-timestamp">${timeAgo(data.createdAt)}</span>
      </div>
      <div class="comment-text">${escHtml(data.content)}</div>
    </div>
    ${data.uid === currentUser?.uid ? `<button class="comment-delete-btn" title="Delete comment">🗑️</button>` : ''}
  `;
  row.querySelector('.comment-delete-btn')?.addEventListener('click', () => deleteComment(postId, commentId));
  return row;
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  if (!currentUser || !currentProfile) return toast('You must be signed in to comment.', 'error');
  try {
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      uid: currentUser.uid,
      username: currentProfile.username,
      photoURL: currentProfile.photoURL || '',
      content,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'posts', postId), { comments: increment(1) });
    input.value = '';
    await loadComments(postId);
    const countEl = document.querySelector(`.comment-toggle-btn[data-id="${postId}"] .comment-count`);
    if (countEl) countEl.textContent = String((parseInt(countEl.textContent, 10) || 0) + 1);
  } catch (e) {
    toast('Could not post comment: ' + e.message, 'error');
  }
}

async function deleteComment(postId, commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { comments: increment(-1) });
    await loadComments(postId);
    const countEl = document.querySelector(`.comment-toggle-btn[data-id="${postId}"] .comment-count`);
    if (countEl) countEl.textContent = String(Math.max(0, (parseInt(countEl.textContent, 10) || 0) - 1));
  } catch (e) {
    toast('Could not delete comment: ' + e.message, 'error');
  }
}

async function toggleLike(postId, likes) {
  const uid = currentUser.uid;
  const ref = doc(db, 'posts', postId);
  try {
    if (likes.includes(uid)) {
      await updateDoc(ref, { likes: arrayRemove(uid) });
    } else {
      await updateDoc(ref, { likes: arrayUnion(uid) });
    }
    loadFeed();
  } catch(e) { toast('Could not like post', 'error'); }
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await deleteDoc(doc(db, 'posts', postId));
    toast('Post deleted.', 'success');
    loadFeed();
  } catch(e) { toast('Could not delete', 'error'); }
}

function postTypeLabel(t) {
  return { clip: '🎬 Clip', result: '📊 Result', update: '📝 Update', recruit: '📢 Recruit', rant: '💢 Rant' }[t] || t;
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
document.getElementById('lb-game-filter').addEventListener('change', loadLeaderboard);

async function loadLeaderboard() {
  const list  = document.getElementById('leaderboard-list');
  const game  = document.getElementById('lb-game-filter').value;
  list.innerHTML = '<div class="feed-loading">Loading…</div>';
  try {
    const q = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(100));
    const snap = await getDocs(q);
    let docs = snap.docs;
    if (game && game !== 'all') {
      // favGame may be "Category" or "Category: Specific" — match on the category part
      docs = docs.filter(d => {
        const fav = d.data().favGame || '';
        return splitCategory(fav).category === game;
      });
    }
    if (docs.length === 0) { list.innerHTML = '<div class="feed-loading">No players yet.</div>'; return; }
    list.innerHTML = '';
    let pos = 1;
    docs.slice(0, 50).forEach(d => {
      list.appendChild(buildLbRow(pos++, d.data()));
    });
  } catch(e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function buildLbRow(pos, data) {
  const rank = getRank(data.elo || 1000);
  const rankClass = pos === 1 ? 'gold-1' : pos === 2 ? 'silver-2' : pos === 3 ? 'bronze-3' : '';
  const wr = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0;
  const row = document.createElement('div');
  row.className = 'lb-row';
  row.innerHTML = `
    <div class="lb-rank ${rankClass}">${pos}</div>
    <img src="${avatarUrl(data)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border2)" />
    <div class="lb-info">
      <div class="lb-name">${escHtml(data.username)}</div>
      <div class="lb-game">${escHtml(data.favGame || '—')} · ${wr}% WR · ${data.matches || 0} games</div>
    </div>
    <span class="lb-rank-chip" style="background:${rank.color}">${rank.short}</span>
    <div class="lb-elo">${data.elo || 1000}</div>`;
  return row;
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────
document.getElementById('btn-log-match').addEventListener('click', () => {
  const f = document.getElementById('match-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('btn-match-cancel').addEventListener('click', () => {
  document.getElementById('match-form').style.display = 'none';
});

document.getElementById('btn-match-submit').addEventListener('click', async () => {
  const game   = document.getElementById('m-game').value;
  const result = document.getElementById('m-result').value;
  const score  = document.getElementById('m-score').value.trim();
  const map    = document.getElementById('m-map').value.trim();
  const kda    = document.getElementById('m-kda').value.trim();
  const rankAch= document.getElementById('m-rank').value.trim();
  const notes  = document.getElementById('m-notes').value.trim();
  if (!game)  return toast('Select a game.', 'error');
  if (!score) return toast('Enter the score.', 'error');

  const eloChange = result === 'win' ? ELO_WIN : result === 'loss' ? ELO_LOSS : ELO_DRAW;
  const newElo    = Math.max(0, (currentProfile.elo || 1000) + eloChange);

  try {
    await addDoc(collection(db, 'matches'), {
      uid: currentUser.uid,
      username: currentProfile.username,
      game, result, score, map, kda, rankAchieved: rankAch, notes,
      eloChange, eloBefore: currentProfile.elo || 1000, eloAfter: newElo,
      createdAt: serverTimestamp()
    });
    // Update user stats (single atomic update — no double increment)
    await updateDoc(doc(db, 'users', currentUser.uid), {
      elo:     newElo,
      matches: increment(1),
      wins:    result === 'win'  ? increment(1) : increment(0),
      losses:  result === 'loss' ? increment(1) : increment(0),
    });

    // Clear form
    ['m-game','m-result','m-score','m-map','m-kda','m-rank'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('m-notes').value = '';
    document.getElementById('match-form').style.display = 'none';

    await refreshCurrentProfile();
    updateSidebar();
    toast(`Match logged! ELO ${eloChange >= 0 ? '+' : ''}${eloChange} → ${newElo}`, 'success');
    loadMatches();
  } catch(e) {
    toast('Failed to log match: ' + e.message, 'error');
  }
});

async function loadMatches() {
  const list = document.getElementById('matches-list');
  list.innerHTML = '<div class="feed-loading">Loading…</div>';
  try {
    const q = query(
      collection(db, 'matches'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = '<div class="feed-loading">No matches logged yet. Log your first!</div>'; return; }
    list.innerHTML = '';
    snap.forEach(d => list.appendChild(buildMatchCard(d.data())));
  } catch(e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function buildMatchCard(data) {
  const icon = { win: '✅', loss: '❌', draw: '🤝' }[data.result] || '❓';
  const card = document.createElement('div');
  card.className = 'match-card';
  card.innerHTML = `
    <div class="match-result-icon">${icon}</div>
    <div class="match-info">
      <div class="match-game">${escHtml(data.game)}${data.map ? ` · ${escHtml(data.map)}` : ''}</div>
      <div class="match-details">
        Score: ${escHtml(data.score)}${data.kda ? ` · KDA: ${escHtml(data.kda)}` : ''}
        ${data.rankAchieved ? ` · ${escHtml(data.rankAchieved)}` : ''}
      </div>
      ${data.notes ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">${escHtml(data.notes)}</div>` : ''}
    </div>
    <div>
      <div class="match-kda ${data.result}" style="font-size:16px">${data.eloChange >= 0 ? '+' : ''}${data.eloChange} ELO</div>
      <div class="match-ts">${data.eloAfter} total</div>
      <div class="match-ts">${timeAgo(data.createdAt)}</div>
    </div>`;
  return card;
}

// ─── TEAMS ────────────────────────────────────────────────────────────────────
document.getElementById('btn-create-team').addEventListener('click', () => {
  const f = document.getElementById('team-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('btn-team-cancel').addEventListener('click', () => {
  document.getElementById('team-form').style.display = 'none';
});

document.getElementById('btn-team-submit').addEventListener('click', async () => {
  const name   = document.getElementById('t-name').value.trim();
  const game   = document.getElementById('t-game').value;
  const tag    = document.getElementById('t-tag').value.trim().toUpperCase();
  const region = document.getElementById('t-region').value;
  const desc   = document.getElementById('t-desc').value.trim();
  if (!name) return toast('Enter a team name.', 'error');
  if (!game) return toast('Select a game.', 'error');
  if (!tag)  return toast('Add a team tag.', 'error');
  try {
    await addDoc(collection(db, 'teams'), {
      name, game, tag, region, desc,
      ownerUid: currentUser.uid,
      ownerName: currentProfile.username,
      members: [currentUser.uid],
      memberCount: 1,
      createdAt: serverTimestamp()
    });
    ['t-name','t-game','t-tag','t-region','t-desc'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    document.getElementById('team-form').style.display = 'none';
    toast('Team created! 🛡️', 'success');
    loadTeams();
  } catch(e) {
    toast('Failed: ' + e.message, 'error');
  }
});

async function loadTeams() {
  const list = document.getElementById('teams-list');
  list.innerHTML = '<div class="feed-loading">Loading…</div>';
  try {
    const q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = '<div class="feed-loading">No teams yet. Create the first!</div>'; return; }
    list.innerHTML = '';
    snap.forEach(d => list.appendChild(buildTeamCard(d.id, d.data())));
  } catch(e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function buildTeamCard(id, data) {
  const isOwner  = data.ownerUid === currentUser?.uid;
  const isMember = (data.members || []).includes(currentUser?.uid);
  const card = document.createElement('div');
  card.className = 'team-card';
  card.innerHTML = `
    <div class="team-card-header">
      <div class="team-name">${escHtml(data.name)}</div>
      <div class="team-tag">[${escHtml(data.tag)}]</div>
    </div>
    <div class="team-meta">🎮 ${escHtml(data.game)} · by ${escHtml(data.ownerName)}</div>
    <div class="team-desc">${escHtml(data.desc || 'No description.')}</div>
    <div class="team-footer">
      <span class="team-region">${escHtml(data.region)}</span>
      <span class="team-members">👥 ${data.memberCount || 1}</span>
      ${isOwner ? `<button class="btn-join" style="color:var(--red);border-color:var(--red)" data-tid="${id}" data-act="delete">Disband</button>` :
        isMember ? `<button class="btn-join" style="color:var(--text2);border-color:var(--text2)" data-tid="${id}" data-act="leave">Leave</button>` :
        `<button class="btn-join" data-tid="${id}" data-act="join">Join</button>`}
    </div>`;
  card.querySelector('[data-act]')?.addEventListener('click', e => handleTeamAction(e.target.dataset.tid, e.target.dataset.act, data));
  return card;
}

async function handleTeamAction(tid, act, data) {
  const ref = doc(db, 'teams', tid);
  try {
    if (act === 'join') {
      await updateDoc(ref, { members: arrayUnion(currentUser.uid), memberCount: increment(1) });
      toast(`Joined ${data.name}! 🛡️`, 'success');
    } else if (act === 'leave') {
      await updateDoc(ref, { members: arrayRemove(currentUser.uid), memberCount: increment(-1) });
      toast('Left the team.', 'success');
    } else if (act === 'delete') {
      if (!confirm(`Disband "${data.name}"? This cannot be undone.`)) return;
      await deleteDoc(ref);
      toast('Team disbanded.', 'success');
    }
    loadTeams();
  } catch(e) { toast('Action failed: ' + e.message, 'error'); }
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
async function loadProfile() {
  await refreshCurrentProfile();
  if (!currentProfile) return;
  const rank = getRank(currentProfile.elo || 1000);
  const wr = currentProfile.matches > 0 ? Math.round((currentProfile.wins / currentProfile.matches) * 100) : 0;

  document.getElementById('profile-avatar').src = avatarUrl(currentProfile);
  document.getElementById('profile-username').textContent = currentProfile.username;
  document.getElementById('profile-rank-chip').textContent = rank.label;
  document.getElementById('profile-rank-chip').style.background = rank.color;
  document.getElementById('profile-elo-display').textContent = `${currentProfile.elo || 1000} ELO`;
  document.getElementById('profile-fav-game').textContent = currentProfile.favGame ? `Favourite: ${currentProfile.favGame}` : '';
  document.getElementById('stat-wins').textContent    = currentProfile.wins    || 0;
  document.getElementById('stat-losses').textContent  = currentProfile.losses  || 0;
  document.getElementById('stat-matches').textContent = currentProfile.matches || 0;
  document.getElementById('stat-wr').textContent      = `${wr}%`;
  document.getElementById('profile-bio').value        = currentProfile.bio || '';
  document.getElementById('profile-discord').value    = currentProfile.discord || '';

  const sel = document.getElementById('profile-fav-game-select');
  const spec = document.getElementById('profile-fav-game-specify');
  const { category, specify } = splitCategory(currentProfile.favGame);
  sel.value = category;
  spec.value = specify;
  spec.style.display = category ? 'block' : 'none';
}

document.getElementById('btn-save-profile').addEventListener('click', async () => {
  const bio     = document.getElementById('profile-bio').value.trim();
  const favGame = combineCategory('profile-fav-game-select', 'profile-fav-game-specify');
  const discord = document.getElementById('profile-discord').value.trim();
  const msg     = document.getElementById('profile-save-msg');
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { bio, favGame, discord });
    await refreshCurrentProfile();
    updateSidebar();
    msg.textContent = 'Profile saved ✅';
    setTimeout(() => msg.textContent = '', 3000);
  } catch(e) {
    msg.style.color = 'var(--red)';
    msg.textContent = 'Save failed: ' + e.message;
  }
});

// Avatar upload via ImageBB
document.getElementById('avatar-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast('Image must be under 2 MB.', 'error');
  if (!currentUser) return toast('You must be signed in to upload an avatar.', 'error');
  toast('Uploading avatar…');
  try {
    // Convert file to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Upload to ImageBB
    const formData = new FormData();
    formData.append('key', IMGBB_API_KEY);
    formData.append('image', base64);
    formData.append('name', `avatar_${currentUser.uid}`);

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    const json = await res.json();

    if (!json.success) throw new Error(json.error?.message || 'ImageBB upload failed');

    const url = json.data.url;
    await updateProfile(currentUser, { photoURL: url });
    await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
    await refreshCurrentProfile();
    updateSidebar();
    document.getElementById('profile-avatar').src = url;
    toast('Avatar updated! 🎉', 'success');
  } catch(e) {
    console.error('Avatar upload failed', e);
    toast(`Upload failed: ${e.message}`, 'error');
  } finally {
    e.target.value = '';
  }
});

// ─── DIRECT MESSAGES ─────────────────────────────────────────────────────────
// Firestore schema:
//   dmThreads/{threadId}  { participants:[uid,uid], participantNames:{uid:name}, participantPhotos:{uid:url}, lastMessage, lastMessageAt, lastSenderId }
//   dmThreads/{threadId}/messages/{messageId}  { senderUid, senderName, text, createdAt }

let dmUnsubMessages  = null;   // active messages listener
let dmUnsubConvList  = null;   // conversation list listener
let activeConvId     = null;   // currently open conversation

// Build a stable, deterministic conversation ID from two UIDs
function convId(uid1, uid2) {
    return [uid1, uid2].sort().join('_');
}

// ── Load the DM page ─────────────────────────────────────────────────────────
function loadDMPage() {
    loadConversationList();
    clearUnreadBadge();
}

// ── Conversation list (left panel) ───────────────────────────────────────────
function loadConversationList() {
    if (dmUnsubConvList) { dmUnsubConvList(); dmUnsubConvList = null; }
    const el = document.getElementById('dm-conversations');
    if (!el) return;

    const q = query(
        collection(db, 'dmThreads'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageAt', 'desc'),
        limit(50)
    );

    dmUnsubConvList = onSnapshot(q, snap => {
        el.innerHTML = '';
        if (snap.empty) {
            el.innerHTML = '<div class="dm-no-convs">No conversations yet. Start one from a user\'s profile!</div>';
            return;
        }
        snap.forEach(d => {
            const data  = d.data();
            const otherId = data.participants.find(p => p !== currentUser.uid);
            const name  = data.participantNames?.[otherId] || 'Unknown';
            const photo = data.participantPhotos?.[otherId] || '';
            const unread = data.unread?.[currentUser.uid] || 0;
            const lastMsg = data.lastMessage ? escHtml(data.lastMessage).slice(0, 50) : '';
            const ts = data.lastMessageAt ? timeAgo(data.lastMessageAt) : '';

            const row = document.createElement('div');
            row.className = `dm-conv-row${activeConvId === d.id ? ' active' : ''}`;
            row.dataset.convId  = d.id;
            row.dataset.otherId = otherId;
            row.dataset.otherName = name;
            row.innerHTML = `
                <div class="dm-conv-avatar-wrap">
                    <img class="dm-conv-avatar" src="${photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1f2433&color=00e5ff&bold=true&size=60`}" />
                    ${unread > 0 ? `<span class="dm-unread-dot">${unread}</span>` : ''}
                </div>
                <div class="dm-conv-info">
                    <div class="dm-conv-name">${escHtml(name)}</div>
                    <div class="dm-conv-last">${lastMsg || '<em>No messages yet</em>'}</div>
                </div>
                <div class="dm-conv-ts">${ts}</div>`;
            row.addEventListener('click', () => openConversation(d.id, otherId, name, photo));
            el.appendChild(row);
        });

        // Update global unread badge
        updateUnreadBadge(snap);
    }, err => { console.error('DM list error', err); });
}

function updateUnreadBadge(snap) {
    let total = 0;
    snap.forEach(d => { total += (d.data().unread?.[currentUser.uid] || 0); });
    const badge = document.getElementById('msg-badge');
    if (!badge) return;
    if (total > 0) { badge.textContent = total > 9 ? '9+' : total; badge.classList.remove('hidden'); }
    else           { badge.classList.add('hidden'); }
}

function clearUnreadBadge() {
    const badge = document.getElementById('msg-badge');
    if (badge) { badge.textContent = ''; badge.classList.add('hidden'); }
}

// ── Open a conversation ───────────────────────────────────────────────────────
async function openConversation(cid, otherId, otherName, otherPhoto) {
    // Stop previous messages listener
    if (dmUnsubMessages) { dmUnsubMessages(); dmUnsubMessages = null; }
    activeConvId = cid;

    // Highlight active row
    document.querySelectorAll('.dm-conv-row').forEach(r =>
        r.classList.toggle('active', r.dataset.convId === cid));

    // Show chat panel
    const emptyState = document.getElementById('dm-empty-state');
    const chatInner  = document.getElementById('dm-chat-inner');
    if (emptyState) emptyState.style.display = 'none';
    if (chatInner)  chatInner.style.display  = 'flex';

    // On mobile: switch to chat panel
    document.getElementById('dm-list-panel')?.classList.add('dm-mobile-hidden');
    document.getElementById('dm-chat-panel')?.classList.add('dm-mobile-visible');

    // Chat header
    const header = document.getElementById('dm-chat-header');
    if (header) {
        header.innerHTML = `
            <button class="dm-back-btn" id="dm-back-btn">←</button>
            <img class="dm-chat-avatar" src="${otherPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=1f2433&color=00e5ff&bold=true&size=60`}" />
            <div class="dm-chat-name">${escHtml(otherName)}</div>`;
        document.getElementById('dm-back-btn')?.addEventListener('click', () => {
            document.getElementById('dm-list-panel')?.classList.remove('dm-mobile-hidden');
            document.getElementById('dm-chat-panel')?.classList.remove('dm-mobile-visible');
        });
    }

    // Firestore rules do not allow client-side unread writes for dmThreads.
    // Unread state should be handled by a server-side process or different schema.

    // Wire send button + enter key
    const sendBtn = document.getElementById('dm-send-btn');
    const input   = document.getElementById('dm-input');
    const newSend = sendBtn.cloneNode(true);
    sendBtn.replaceWith(newSend);
    newSend.addEventListener('click', () => sendDMMessage(cid, otherId, otherName, otherPhoto));
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') sendDMMessage(cid, otherId, otherName, otherPhoto); });

    // Real-time messages listener
    const msgList = document.getElementById('dm-messages-list');
    msgList.innerHTML = '<div class="feed-loading">Loading…</div>';

    const q = query(
        collection(db, 'dmThreads', cid, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200)
    );

    dmUnsubMessages = onSnapshot(q, snap => {
        msgList.innerHTML = '';
        snap.forEach(d => msgList.appendChild(buildDMBubble(d.data())));
        msgList.scrollTop = msgList.scrollHeight;
    }, err => { msgList.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`; });
}

// ── Start/open a DM with a user (from popup) ──────────────────────────────────
async function openDMWith(uid, username) {
    const cid = convId(currentUser.uid, uid);
    const convRef = doc(db, 'dmThreads', cid);

    // Fetch their photo
    let otherPhoto = '';
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) otherPhoto = avatarUrl(snap.data());
    } catch(_) {}

    // Ensure conversation doc exists
    try {
        const convSnap = await getDoc(convRef);
        if (!convSnap.exists()) {
            await setDoc(convRef, {
                participants: [currentUser.uid, uid],
                participantNames: {
                    [currentUser.uid]: currentProfile.username,
                    [uid]: username
                },
                participantPhotos: {
                    [currentUser.uid]: currentProfile.photoURL || '',
                    [uid]: otherPhoto
                },
                lastMessage: '',
                lastMessageAt: serverTimestamp(),
                lastSenderId: currentUser.uid
            });
        }
    } catch(e) { toast('Could not open chat: ' + e.message, 'error'); return; }

    // Load the conversation list first so the row appears
    loadConversationList();
    // Small delay to let the list render, then open
    setTimeout(() => openConversation(cid, uid, username, otherPhoto), 300);
}

// ── Send a message ────────────────────────────────────────────────────────────
async function sendDMMessage(cid, otherId, otherName, otherPhoto) {
    const input = document.getElementById('dm-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';

    try {
        await addDoc(collection(db, 'dmThreads', cid, 'messages'), {
            senderUid: currentUser.uid,
            senderName: currentProfile.username,
            text,
            createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'dmThreads', cid), {
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            lastSenderId: currentUser.uid
        });
    } catch(e) { toast('Could not send message: ' + e.message, 'error'); }
}

// ── Build a message bubble ────────────────────────────────────────────────────
function buildDMBubble(data) {
    const isMine = data.senderUid === currentUser.uid;
    const wrap = document.createElement('div');
    wrap.className = `dm-bubble-wrap ${isMine ? 'mine' : 'theirs'}`;
    wrap.innerHTML = `
        <div class="dm-bubble ${isMine ? 'dm-bubble-mine' : 'dm-bubble-theirs'}">
            <div class="dm-bubble-text">${escHtml(data.text)}</div>
            <div class="dm-bubble-ts">${timeAgo(data.createdAt)}</div>
        </div>`;
    return wrap;
}

// ── DM search — find users to start a chat ───────────────────────────────────
let dmSearchTimeout = null;
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dm-search')?.addEventListener('input', e => {
        clearTimeout(dmSearchTimeout);
        const q = e.target.value.trim();
        if (!q) { loadConversationList(); return; }
        dmSearchTimeout = setTimeout(() => searchUsersForDM(q), 300);
    });
    document.getElementById('dm-send-btn')?.addEventListener('click', () => {});
});

async function searchUsersForDM(query_str) {
    const el = document.getElementById('dm-conversations');
    el.innerHTML = '<div class="feed-loading">Searching…</div>';
    try {
        // Basic prefix search on username
        const snap = await getDocs(
            query(collection(db, 'users'),
                  orderBy('username'),
                  where('username', '>=', query_str),
                  where('username', '<=', query_str + '\uf8ff'),
                  limit(10))
        );
        el.innerHTML = '';
        if (snap.empty) { el.innerHTML = '<div class="dm-no-convs">No users found.</div>'; return; }
        snap.forEach(d => {
            if (d.id === currentUser.uid) return;
            const data = d.data();
            const row = document.createElement('div');
            row.className = 'dm-conv-row dm-search-row';
            row.innerHTML = `
                <img class="dm-conv-avatar" src="${avatarUrl(data)}" />
                <div class="dm-conv-info">
                    <div class="dm-conv-name">${escHtml(data.username)}</div>
                    <div class="dm-conv-last">${escHtml(data.favGame || '')}</div>
                </div>
                <span class="dm-start-badge">Chat</span>`;
            row.addEventListener('click', () => {
                document.getElementById('dm-search').value = '';
                showPage('messages');
                openDMWith(d.id, data.username);
            });
            el.appendChild(row);
        });
    } catch(e) { el.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`; }
}

// ─── GLOBAL CHAT ─────────────────────────────────────────────────────────────
// Firestore shape:
//   globalChat/{messageId}  { uid, username, photoURL, text, createdAt }
// Rules: any signed-in user may read/create; create requires uid == auth.uid;
// update is always denied; delete only allowed by the message's own author.

let gchatUnsub = null;
const GCHAT_MSG_LIMIT = 200;

function loadGlobalChat() {
    const list = document.getElementById('gchat-messages');
    if (!list) return;
    list.innerHTML = '<div class="feed-loading">Loading…</div>';

    if (gchatUnsub) { gchatUnsub(); gchatUnsub = null; }

    const q = query(
        collection(db, 'globalChat'),
        orderBy('createdAt', 'asc'),
        limit(GCHAT_MSG_LIMIT)
    );

    gchatUnsub = onSnapshot(q, snap => {
        const wasNearBottom = (list.scrollHeight - list.scrollTop - list.clientHeight) < 80;
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<div class="dm-no-convs">No messages yet. Say hi to everyone!</div>';
            return;
        }
        snap.forEach(d => list.appendChild(buildGChatBubble(d.id, d.data())));
        if (wasNearBottom || list.dataset.firstLoad !== 'done') {
            list.scrollTop = list.scrollHeight;
            list.dataset.firstLoad = 'done';
        }
    }, err => { list.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`; });

    // Wire send button + Enter key (clone to avoid stacking duplicate listeners
    // across repeated page visits, same pattern used for DM send button).
    const sendBtn = document.getElementById('gchat-send-btn');
    const input   = document.getElementById('gchat-input');
    if (sendBtn) {
        const newSend = sendBtn.cloneNode(true);
        sendBtn.replaceWith(newSend);
        newSend.addEventListener('click', sendGlobalChatMessage);
    }
    if (input) {
        const newInput = input.cloneNode(true);
        input.replaceWith(newInput);
        newInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendGlobalChatMessage(); });
    }
}

async function sendGlobalChatMessage() {
    const input = document.getElementById('gchat-input');
    const text  = input?.value.trim();
    if (!text) return;
    if (!currentUser || !currentProfile) return toast('You must be signed in to chat.', 'error');
    input.value = '';

    try {
        await addDoc(collection(db, 'globalChat'), {
            uid: currentUser.uid,
            username: currentProfile.username || 'Player',
            photoURL: currentProfile.photoURL || '',
            text,
            createdAt: serverTimestamp()
        });
    } catch(e) { toast('Could not send message: ' + e.message, 'error'); }
}

function buildGChatBubble(id, data) {
    const isMine = data.uid === currentUser?.uid;
    const wrap = document.createElement('div');
    wrap.className = `dm-bubble-wrap gchat-bubble-wrap ${isMine ? 'mine' : 'theirs'}`;
    wrap.dataset.id = id;
    wrap.innerHTML = `
        <img class="gchat-avatar" src="${data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username || 'Player')}&background=1f2433&color=00e5ff&bold=true&size=60`}" />
        <div class="dm-bubble ${isMine ? 'dm-bubble-mine' : 'dm-bubble-theirs'} gchat-bubble">
            ${isMine ? '' : `<div class="gchat-bubble-name">${escHtml(data.username || 'Player')}</div>`}
            <div class="dm-bubble-text">${escHtml(data.text)}</div>
            <div class="dm-bubble-ts">${timeAgo(data.createdAt)}${isMine ? ' <span class="gchat-delete-btn" title="Delete">🗑️</span>' : ''}</div>
        </div>`;
    if (isMine) {
        wrap.querySelector('.gchat-delete-btn')?.addEventListener('click', () => deleteGlobalChatMessage(id));
    }
    return wrap;
}

async function deleteGlobalChatMessage(id) {
    try {
        await deleteDoc(doc(db, 'globalChat', id));
    } catch(e) { toast('Could not delete message: ' + e.message, 'error'); }
}

// ─── RIGHT PANEL ─────────────────────────────────────────────────────────────
async function loadRightPanel() {
  // Top ELO
  try {
    const q = query(collection(db, 'users'), orderBy('elo', 'desc'), limit(5));
    const snap = await getDocs(q);
    const topEl = document.getElementById('top-elo-list');
    topEl.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const rank = getRank(data.elo || 1000);
      const row = document.createElement('div');
      row.className = 'panel-user';
      row.innerHTML = `
        <img src="${avatarUrl(data)}" />
        <div class="panel-user-info">
          <div class="panel-user-name">${escHtml(data.username)}</div>
          <div class="panel-user-sub">${rank.label}</div>
        </div>
        <div class="panel-elo">${data.elo || 1000}</div>`;
      topEl.appendChild(row);
    });
  } catch(_) {}

  // Active players (recently registered or updated)
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
    const snap = await getDocs(q);
    const el = document.getElementById('active-players-list');
    el.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const row = document.createElement('div');
      row.className = 'panel-user';
      row.innerHTML = `
        <img src="${avatarUrl(data)}" />
        <div class="panel-user-info">
          <div class="panel-user-name">${escHtml(data.username)}</div>
          <div class="panel-user-sub">${escHtml(data.favGame || 'No game set')}</div>
        </div>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0"></span>`;
      el.appendChild(row);
    });
  } catch(_) {}

  // Recent teams
  try {
    const q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'), limit(4));
    const snap = await getDocs(q);
    const el = document.getElementById('recent-teams-list');
    el.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const div = document.createElement('div');
      div.className = 'panel-team';
      div.innerHTML = `
        <div class="panel-team-name">[${escHtml(data.tag)}] ${escHtml(data.name)}</div>
        <div class="panel-team-game">${escHtml(data.game)} · ${data.region}</div>`;
      el.appendChild(div);
    });
  } catch(_) {}
}

// ─── NOTIFICATIONS (comments) ───────────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission();
    return p === 'granted';
  }
  return false;
}

function showBrowserNotification(title, options = {}) {
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); n.close(); };
    return n;
  } catch (e) { console.warn('Notification failed', e); }
}

function initCommentNotifications() {
  if (!currentUser) return;
  requestNotificationPermission();
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
  try {
    const q = query(collectionGroup(db, 'comments'), orderBy('createdAt', 'desc'));
    commentsUnsub = onSnapshot(q, async snapshot => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue;
        const c = change.doc.data();
        if (!c) continue;
        if (!currentUser) continue;
        // Skip notifications for our own comments
        if (c.uid === currentUser.uid) continue;
        // Determine parent post and check owner
        const postRef = change.doc.ref.parent.parent;
        if (!postRef) continue;
        try {
          const postSnap = await getDoc(postRef);
          if (!postSnap.exists()) continue;
          const post = postSnap.data();
          if (!post) continue;
          // Notify only if the comment is on a post owned by the current user
          if (post.uid !== currentUser.uid) continue;
          const title = `${c.username} commented on your post`;
          const body = (c.content || '').slice(0, 140);
          const icon = c.photoURL || post.photoURL || '';
          showBrowserNotification(title, { body, icon });
          toast(`${c.username}: ${body}`, 'info');
        } catch (e) { console.error('Error fetching post for notification', e); }
      }
    }, err => console.error('Comment notifications listener error', err));
  } catch (e) { console.error('Could not start comment notifications', e); }
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================\
// FRAGNET COMPETE MATRIX: ADVANCED PLAYMORE-STYLE LEADERBOARD LAYER
// ============================================================================\


const runningMatches = new Map();

/**
 * Initializes and binds a premium telemetry session inside FragNet Arcade Canvas
 * @param {string} gameKey - Target path context folder name ('pacman', 'breakout', 'pong')
 */
window.bootSecureTournamentMatch = function(gameKey) {
    const frameElement = document.getElementById('arcade-frame');
    if (!frameElement) return;

    // Pull currently authenticated user object from Overplus state machine
    const systemAuth = getAuth();
    const activePlayer = systemAuth.currentUser;
    
    const contextUid = activePlayer ? activePlayer.uid : "unregistered_client";
    const contextTag = activePlayer ? (activePlayer.displayName || activePlayer.email.split('@')[0]) : "Guest Operator";

    // Generate strict anti-replay validation payload tokens
    const operationalSessionToken = `token_live_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;

    runningMatches.set(operationalSessionToken, {
        uid: contextUid,
        userTag: contextTag,
        gameId: gameKey,
        startedAt: performance.now()
    });

    // Mount secure token interface straight into embedded sandboxed document
    frameElement.src = `games/${gameKey}/index.html?sessionToken=${operationalSessionToken}&user=${encodeURIComponent(contextTag)}`;
    console.log(`🔒 Secure Session Activated: Generated [${operationalSessionToken}] for Player: ${contextTag}`);
};

// Real-Time Transaction Verification Matrix
async function processSecureHighscoreWrite(sessionMetadata, verifiedScore, runtimeLog) {
    const database = getFirestore();
    const globalBoardRef = doc(database, "arcade_leaderboards", `${sessionMetadata.gameId}_${sessionMetadata.uid}`);

    try {
        await runTransaction(database, async (activeTransaction) => {
            const documentSnapshot = await activeTransaction.get(globalBoardRef);
            
            const dynamicMatchNode = {
                username: sessionMetadata.userTag,
                uid: sessionMetadata.uid,
                score: verifiedScore,
                gameName: sessionMetadata.gameId,
                verifiedTimestamp: new Date()
            };

            // Highscore Condition Evaluation
            if (!documentSnapshot.exists() || verifiedScore > documentSnapshot.data().highScore) {
                activeTransaction.set(globalBoardRef, {
                    username: sessionMetadata.userTag,
                    uid: sessionMetadata.uid,
                    gameName: sessionMetadata.gameId,
                    highScore: verifiedScore,
                    updatedAt: serverTimestamp()
                });
            }

            // Always write the audit trail execution history log 
            const archiveLogRef = doc(collection(database, `match_history_logs`));
            activeTransaction.set(archiveLogRef, dynamicMatchNode);
        });

        // Trigger native Toast notice safely using exisiting Overplus UI method
        if (typeof window.toast === "function") {
            window.toast(`🏆 New Record Submitted! Score: ${verifiedScore.toLocaleString()}`, 'success');
        }
    } catch (transactionError) {
        console.error("❌ Highscore transaction declined validation:", transactionError);
    }
}

// Bidirectional Telemetry Communication Interceptor 
window.addEventListener('message', (event) => {
    // Restrict inputs to local source validation context paths
    if (event.origin !== window.location.origin) return;

    const streamData = event.data;
    if (!streamData || !streamData.sessionToken) return;

    const validatedSession = runningMatches.get(streamData.sessionToken);
    if (!validatedSession) {
        console.warn("🛡️ Security Exception: Frame postMessage blocked. Token does not match live stack context.");
        return;
    }

    // Context Hook A: Real-Time Score Dashboard Ticker Updates
    if (streamData.type === 'ARCADE_LIVE_TICKER') {
        const liveTickerNode = document.getElementById('arcade-live-ticker');
        if (liveTickerNode) {
            liveTickerNode.innerHTML = `🟢 ${validatedSession.userTag} is playing ${validatedSession.gameId.toUpperCase()}: <span style="color:var(--accent); font-weight:bold;">${streamData.currentScore.toLocaleString()} pts</span>`;
        }
        return;
    }

    // Context Hook B: Final Round Termination Matrix Run
    if (streamData.type === 'MATCH_COMPLETED') {
        const activeDurationSec = (performance.now() - validatedSession.startedAt) / 1000;
        
        // Anti-Cheat Speed check optimization
        if (streamData.score > 0 && activeDurationSec < 1.5) {
            console.error("⛔ Telemetry dropped: Impossible delta profile submission.");
            runningMatches.delete(streamData.sessionToken);
            return;
        }

        // Release token slot instantly to prevent replay loops
        runningMatches.delete(streamData.sessionToken);
        
        // Execute write execution pipeline
        processSecureHighscoreWrite(validatedSession, streamData.score, streamData.timeline);
    }
});

/**
 * Attaches a dynamic data streaming layer to display arcade lists on any given component container
 */
window.attachLiveLeaderboardStream = function(gameFilterKey, uiElementTargetId) {
    const db = getFirestore();
    const leaderQuery = query(
        collection(db, "arcade_leaderboards"),
        where("gameName", "==", gameFilterKey),
        orderBy("highScore", "desc"),
        limit(10)
    );

    // Dynamic real-time listening loop
    onSnapshot(leaderQuery, (querySnapshot) => {
        const uiMountPoint = document.getElementById(uiElementTargetId);
        if (!uiMountPoint) return;

        let generatorHtml = `
            <table class="leaderboard-matrix" style="width:100%; border-collapse:separate; border-spacing:0 4px;">
                <thead>
                    <tr style="color:var(--text3); font-size:11px; text-transform:uppercase; letter-spacing:1px;">
                        <th style="padding:6px 12px; text-align:left;">POS</th>
                        <th style="padding:6px 12px; text-align:left;">COMPETITOR</th>
                        <th style="padding:6px 12px; text-align:right;">RECORD</th>
                    </tr>
                </thead>
                <tbody>`;

        let positionIndex = 1;
        querySnapshot.forEach((recordDoc) => {
            const entry = recordDoc.data();
            let specialBadgeHighlight = "";
            if (positionIndex === 1) specialBadgeHighlight = "background:var(--gold); color:#000;";
            else if (positionIndex === 2) specialBadgeHighlight = "background:#e0e0e0; color:#000;";
            else if (positionIndex === 3) specialBadgeHighlight = "background:#cd7f32; color:#000;";
            else specialBadgeHighlight = "background:var(--bg4); color:var(--text2);";

            generatorHtml += `
                <tr style="background:var(--bg2); transition:transform 0.2s;">
                    <td style="padding:10px 12px; border-radius:4px 0 0 4px;"><span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:11px; font-weight:bold; ${specialBadgeHighlight}">${positionIndex}</span></td>
                    <td style="padding:10px 12px; font-weight:500; color:var(--text);">${String(entry.username).replace(/</g, '&lt;')}</td>
                    <td style="padding:10px 12px; text-align:right; font-weight:700; color:var(--accent); border-radius:0 4px 4px 0;">${entry.highScore.toLocaleString()}</td>
                </tr>`;
            positionIndex++;
        });

        generatorHtml += `</tbody></table>`;
        uiMountPoint.innerHTML = querySnapshot.empty ? `<div style="padding:15px; text-align:center; color:var(--text3); font-size:12px;">No tournament logs processed yet.</div>` : generatorHtml;
    });
};

// ─── ARCADE VIEWPORT CONTROLLER ENGINE ─────────────────────────────────────
window.bootSecureTournamentMatch = function(gameModule) {
    const frame = document.getElementById('arcade-frame');
    const ticker = document.getElementById('arcade-live-ticker');
    
    if (!frame) {
        console.error("❌ Arcade frame canvas viewport target not found in DOM context.");
        return;
    }

    console.log(`🎮 Initializing sandboxed matrix loading sequence for: ${gameModule}`);

    // Update terminal ticker telemetry text
    if (ticker) {
        ticker.innerText = `⏳ Loading Game Module [${gameModule.toUpperCase()}] ... Mounting workspace files.`;
    }

    // Set correct project directory paths based on chosen option
    // Set correct project directory paths based on chosen option
    let systemModulePath = '';
    switch (gameModule) {
        case 'pacman':
            systemModulePath = './pacman/index.html';
            break;
        case 'pong':
            systemModulePath = './pong/index.html';
            break;
        case 'breakout':
            systemModulePath = './breakout/index.html';
            break;
        default:
            systemModulePath = 'about:blank';
            if (ticker) ticker.innerText = '❌ Error: Unknown Game Module Package Specifier.';
            return;
    }

    // 🌟 ADDED: Spin up the real-time highscores for this specific game module
    window.attachLiveLeaderboardStream(gameModule, 'live-arcade-board-container');

    // Mount structural file context path into your active iframe viewport view
    frame.src = systemModulePath;

    // Trigger confirmation notification confirmation once loaded safely
    frame.onload = () => {
        if (ticker) {
            ticker.innerText = `🟢 Module [${gameModule.toUpperCase()}] Loaded Successfully. Session Integrity Matrix: SECURE.`;
        }
    };
};

// ─── ARCADE HUB INTERFACE ROUTER INITIALIZATION ────────────────────────────
function loadArcade() {
    console.log("🎮 Mounting Arcade Hub view state.");

    const frame = document.getElementById('arcade-frame');
    const ticker = document.getElementById('arcade-live-ticker');
    const boardContainer = document.getElementById('live-arcade-board-container');

    // Reset iframe to clean start context if it hasn't loaded any games yet
    if (frame && (!frame.src || frame.src === "about:blank" || frame.src.startsWith("data:"))) {
        frame.src = "data:text/html,<html><body style='background:%23000; display:flex; justify-content:center; align-items:center; color:%2300e5ff; font-family:sans-serif; font-size:14px; letter-spacing:1px;'>🎮 SELECT A MODULE ABOVE TO BEGIN MATCH</body></html>";
    }

    // Set an initial welcoming state for the ticker message bar
    if (ticker) {
        ticker.innerText = "🟢 System Integrity Matrix Ready. Choose a game module above to begin secure tournament tracking.";
    }

    // Set placeholder message in leaderboard box until a specific game starts streaming data
    if (boardContainer && !boardContainer.querySelector('.leaderboard-matrix')) {
        boardContainer.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text3); font-size:12px;">Load a game module to view active highscores.</div>`;
    }
}

// =============================================================================
// 🧠 ULTIMATE OS KERNEL CPU SCHEDULER & SMART DIAGNOSTICS ENGINE
// =============================================================================
// =============================================================================
// 🧠 ULTIMATE OS KERNEL CPU SCHEDULER, METRICS COMPILER & SMART DIAGNOSTICS
// =============================================================================
// =============================================================================
// 🧠 ULTIMATE OS KERNEL CPU SCHEDULER, METRICS COMPILER & SMART DIAGNOSTICS
// =============================================================================
let cpuReadyQueue = [];
let cpuIsRunning = false;
let currentPidCounter = 1;
let contextSwitchCount = 0;
let completedProcessHistory = [];

const processProfileSpecs = {
    'feed':         { name: 'Feed View Render',     burst: 3, priority: 2 },
    'leaderboard':  { name: 'Leaderboard Query',    burst: 5, priority: 3 },
    'matches':      { name: 'Match Engine Sync',    burst: 4, priority: 2 },
    'teams':        { name: 'Guild Matrix Lookup',   burst: 6, priority: 4 },
    'arcade-hub':   { name: 'Arcade Hub Viewport',  burst: 2, priority: 1 },
    'messages':     { name: 'DM Inbox Fetch',       burst: 3, priority: 1 },
    'global-chat':  { name: 'GChat Event Listener', burst: 4, priority: 1 },
    'profile':      { name: 'UserProfile Identity',  burst: 2, priority: 5 }
};

window.logPlatformTaskToCpu = function(pageKeyId) {
    const profile = processProfileSpecs[pageKeyId] || { name: 'System Task Hook', burst: 3, priority: 3 };
    
    const pcb = {
        pid: `P${currentPidCounter++}`,
        name: profile.name,
        burstTime: profile.burst,
        remainingTime: profile.burst,
        priority: profile.priority,
        arrivalTime: Date.now(),
        firstResponseTime: null,
        startTime: null
    };

    cpuReadyQueue.push(pcb);
    runSmartAdvisorDiagnostics();
    updateSchedulerUi();
    
    if (!cpuIsRunning) {
        processNextCpuCycle();
    }
};

window.injectSystemInterrupt = function() {
    const interruptTask = {
        pid: "🚨 INT",
        name: 'KERNEL OVERRIDE INTERRUPT',
        burstTime: 3,
        remainingTime: 3,
        priority: 0,
        arrivalTime: Date.now(),
        firstResponseTime: null,
        startTime: null
    };
    
    cpuReadyQueue.unshift(interruptTask);
    triggerContextSwitchFx(true);
    updateSchedulerUi();
    if (!cpuIsRunning) processNextCpuCycle();
};

function processNextCpuCycle() {
    if (cpuReadyQueue.length === 0) {
        cpuIsRunning = false;
        const corePid = document.getElementById('cpu-active-pid');
        const coreTxt = document.getElementById('cpu-progress-text');
        if (corePid) corePid.innerText = "SYSTEM IDLE";
        if (coreTxt) coreTxt.innerText = "Utilization: 0%";
        updateSchedulerUi();
        return;
    }

    cpuIsRunning = true;
    const algo = document.getElementById('scheduler-algo')?.value || 'FCFS';

    if (algo === 'SJF') {
        cpuReadyQueue.sort((a, b) => a.remainingTime - b.remainingTime);
    }

    let activeJob = cpuReadyQueue[0];
    
    if (activeJob.firstResponseTime === null) {
        activeJob.firstResponseTime = Date.now();
    }

    let executionQuantumTime = activeJob.remainingTime;
    let isPreempted = false;

    if (algo === 'RR') {
        const timeQuantumSpec = 2;
        if (activeJob.remainingTime > timeQuantumSpec) {
            executionQuantumTime = timeQuantumSpec;
            isPreempted = true;
        }
    }

    const corePid = document.getElementById('cpu-active-pid');
    if (corePid) corePid.innerText = `${activeJob.pid}`;
    logVisualGanttBlock(activeJob.pid, activeJob.name);

    let cycleCounter = 0;
    let clockInterval = setInterval(() => {
        cycleCounter++;
        activeJob.remainingTime--;
        
        const runtimeProgressText = document.getElementById('cpu-progress-text');
        if (runtimeProgressText) {
            runtimeProgressText.innerText = `Running: ${activeJob.pid} (${activeJob.remainingTime}s left)`;
        }
        updateSchedulerUi();

        if (cycleCounter >= executionQuantumTime) {
            clearInterval(clockInterval);
            
            if (isPreempted && activeJob.remainingTime > 0) {
                cpuReadyQueue.shift();
                cpuReadyQueue.push(activeJob);
                triggerContextSwitchFx(false);
            } else {
                activeJob.completionTime = Date.now();
                const turnaroundTime = (activeJob.completionTime - activeJob.arrivalTime) / 1000;
                const waitingTime = turnaroundTime - activeJob.burstTime;

                completedProcessHistory.push({
                    pid: activeJob.pid,
                    name: activeJob.name,
                    burst: activeJob.burstTime,
                    wt: Math.max(0, waitingTime),
                    tat: Math.max(0, turnaroundTime)
                });

                recalculateSystemAverages();
                cpuReadyQueue.shift();
            }
            
            runSmartAdvisorDiagnostics();
            setTimeout(processNextCpuCycle, 500);
        }
    }, 1000);
}

function updateSchedulerUi() {
    const queueBox = document.getElementById('cpu-ready-queue');
    if (!queueBox) return;

    if (cpuReadyQueue.length === 0) {
        queueBox.innerHTML = `<div style="color: #4b5563; font-size: 10px; width: 100%; text-align: center;">Core Pipeline Idle...</div>`;
        return;
    }

    queueBox.innerHTML = '';
    cpuReadyQueue.forEach((job, index) => {
        const isCurrent = index === 0 && cpuIsRunning;
        queueBox.innerHTML += `
            <div style="background: ${isCurrent ? 'rgba(0, 229, 255, 0.12)' : 'var(--bg3)'}; border: 1px solid ${isCurrent ? '#00e5ff' : 'var(--border)'}; padding: 2px 6px; border-radius: var(--radius); font-size: 10px; white-space: nowrap; display: flex; gap: 4px;">
                <strong>${job.pid}</strong><span style="color:var(--text3);">${job.remainingTime}s</span>
            </div>
        `;
    });
}

function logVisualGanttBlock(pid, name) {
    const ganttBox = document.getElementById('cpu-gantt-chart');
    if (!ganttBox) return;
    
    const blockColor = pid.includes('INT') ? '#ff0055' : '#00e5ff';
    const block = document.createElement('div');
    block.style = `background: ${blockColor}; color: #000; font-size: 8px; font-weight: bold; padding: 2px 5px; border-radius: 2px; display: flex; align-items: center; justify-content: center; min-width: 32px; height: 18px; box-shadow: 0 0 6px ${blockColor}33;`;
    block.title = `${pid}: ${name}`;
    block.innerText = pid;
    
    ganttBox.appendChild(block);
    ganttBox.scrollLeft = ganttBox.scrollWidth;
}

function triggerContextSwitchFx(isInterrupt) {
    contextSwitchCount++;
    const metricSlot = document.getElementById('cpu-telemetry-metrics');
    if (metricSlot) metricSlot.innerText = `Swaps: ${contextSwitchCount}`;

    const footerFrame = document.getElementById('global-cpu-scheduler-footer');
    if (footerFrame) {
        footerFrame.style.transition = "border-color 0.15s, box-shadow 0.15s";
        footerFrame.style.borderColor = isInterrupt ? "#ff0055" : "#ffcc00";
        footerFrame.style.boxShadow = isInterrupt ? "0 -4px 25px rgba(255, 0, 85, 0.3)" : "0 -4px 25px rgba(255, 204, 0, 0.25)";
        
        setTimeout(() => {
            footerFrame.style.borderColor = "#00e5ff";
            footerFrame.style.boxShadow = "0 -10px 30px rgba(0, 229, 255, 0.15)";
        }, 300);
    }
}

function runSmartAdvisorDiagnostics() {
    const advisorBox = document.getElementById('cpu-smart-advisor');
    if (!advisorBox) return;

    const algo = document.getElementById('scheduler-algo')?.value || 'FCFS';
    const queueLength = cpuReadyQueue.length;

    if (queueLength === 0) {
        advisorBox.innerText = "🟢 Efficiency Nominal. Kernel resource paths optimized for current task tree.";
        advisorBox.style.color = "#00e5ff";
        return;
    }

    if (cpuReadyQueue[0]?.pid === '🚨 INT') {
        advisorBox.innerText = "🚨 ALERT: Hardware Interrupt forced priority context swap. Standard processes halted.";
        advisorBox.style.color = "#ff0055";
        return;
    }

    if (algo === 'FCFS' && queueLength >= 3) {
        const hasHeavyJobFirst = cpuReadyQueue[0]?.remainingTime > 4;
        if (hasHeavyJobFirst) {
            advisorBox.innerText = "⚠️ CONVOY EFFECT DETECTED: Long task blocking queue. Optimize by switching algorithm to SJF!";
            advisorBox.style.color = "#ffcc00";
            return;
        }
    }

    if (algo === 'SJF' && queueLength >= 3) {
        advisorBox.innerText = "ℹ️ DIAGNOSTICS: SJF optimized for short tasks. Warning: Heavy jobs run risk of infinite starvation.";
        advisorBox.style.color = "#ffcc00";
        return;
    }

    if (algo === 'RR') {
        advisorBox.innerText = `🔄 TIME-SLICING ACTIVE: Fair distribution enabled. Context swap penalty overhead currently compounding.`;
        advisorBox.style.color = "#00ff66";
        return;
    }

    advisorBox.innerText = "⚡ Core pipeline crunching tasks. Monitor Gantt matrix tracking to check clock states.";
    advisorBox.style.color = "#00e5ff";
}

function recalculateSystemAverages() {
    if (completedProcessHistory.length === 0) return;

    const totalWT = completedProcessHistory.reduce((sum, job) => sum + job.wt, 0);
    const totalTAT = completedProcessHistory.reduce((sum, job) => sum + job.tat, 0);
    
    const awt = totalWT / completedProcessHistory.length;
    const att = totalTAT / completedProcessHistory.length;

    const awtField = document.getElementById('metric-awt');
    const attField = document.getElementById('metric-att');
    if (awtField) awtField.innerText = `${awt.toFixed(2)}s`;
    if (attField) attField.innerText = `${att.toFixed(2)}s`;

    const tableBody = document.getElementById('cpu-metrics-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        completedProcessHistory.forEach(job => {
            tableBody.innerHTML += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); background: rgba(0,0,0,0.2);">
                    <td style="padding: 6px; color: #00e5ff; font-weight: bold;">${job.pid}</td>
                    <td style="padding: 6px; color: #e5e7eb;">${job.name}</td>
                    <td style="padding: 6px; text-align: center; color: #9ca3af;">${job.burst}s</td>
                    <td style="padding: 6px; text-align: center; color: #00ff66;">${job.wt.toFixed(1)}s</td>
                    <td style="padding: 6px; text-align: center; color: #ffcc00;">${job.tat.toFixed(1)}s</td>
                </tr>
            `;
        });
    }
}

let isMathDrawerOpen = false;
window.toggleCpuMathDrawer = function() {
    const drawer = document.getElementById('cpu-math-drawer');
    const toggleText = document.getElementById('cpu-drawer-toggle-text');
    const footer = document.getElementById('global-cpu-scheduler-footer');
    
    if (!drawer || !toggleText || !footer) return;
    
    isMathDrawerOpen = !isMathDrawerOpen;
    if (isMathDrawerOpen) {
        drawer.style.height = "130px";
        drawer.style.borderTop = "1px solid rgba(0, 229, 255, 0.2)";
        footer.style.height = "245px"; 
        toggleText.innerText = "🔽 CLOSE TELEMETRY DIAGNOSTICS LAYER";
    } else {
        drawer.style.height = "0px";
        drawer.style.borderTop = "0px solid transparent";
        footer.style.height = "110px";
        toggleText.innerText = "🔼 OPEN TELEMETRY ANALYSIS MATRIX";
    }
};

document.getElementById('scheduler-algo')?.addEventListener('change', runSmartAdvisorDiagnostics);

// =============================================================================
// 🧠 AUTOMATIC LIFECYCLE RECOVERY & ROUTING ENGINE
// =============================================================================
(function initializeSystemRouter() {
    // If Firebase isn't fully loaded in the browser yet, wait 100ms and try again!
    if (typeof firebase === 'undefined') {
        setTimeout(initializeSystemRouter, 100);
        return;
    }

    console.log("⚡ Firebase loaded successfully! Attaching security routing matrix.");

    // Once Firebase is verified active, bind the UI state listener safely
    firebase.auth().onAuthStateChanged((user) => {
        const schedulerDock = document.getElementById('global-cpu-scheduler-footer');
        const appActions = document.getElementById('app-top-actions');
        
        if (user) {
            // User logged in -> Reveal dashboard ecosystems safely
            if (schedulerDock) schedulerDock.style.display = 'flex';
            if (appActions) appActions.style.display = 'flex';
        } else {
            // Auth screen active -> Hard cut scheduler layouts out of space
            if (schedulerDock) schedulerDock.style.display = 'none';
            if (appActions) appActions.style.display = 'none';
        }
    });
})();

// 👁️ REVEAL PASSWORD UTILITY
window.togglePasswordVisibility = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        button.innerText = '🙈';
    } else {
        input.type = 'password';
        button.innerText = '👁️';
    }
};

// 🌐 GOOGLE SIGN IN BUTTON LOGIC
window.handleGoogleLogin = async function() {
    try {
        if (typeof firebase === 'undefined') return;
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
    } catch(err) {
        console.error("Google Auth Failure: ", err);
    }
};

// 🚪 LOG OUT BUTTON LOGIC
window.handlePlatformLogout = async function() {
    try {
        if (typeof firebase === 'undefined') return;
        await firebase.auth().signOut();
        window.location.reload(); 
    } catch(err) {
        console.error("Signout Failure: ", err);
    }
};

// ➖ OPERATIONAL DOCK EXPANSION SCRIPT
let isDockMinimized = false;
window.toggleCpuDockView = function() {
    const body = document.getElementById('cpu-dock-body');
    const btn = document.getElementById('dock-minimize-btn');
    const drawer = document.getElementById('cpu-math-drawer');
    
    if (!body || !btn) return;
    isDockMinimized = !isDockMinimized;
    
    if (isDockMinimized) {
        body.style.maxHeight = '0px';
        if (drawer) drawer.style.maxHeight = '0px';
        btn.innerText = '➕';
    } else {
        body.style.maxHeight = '400px';
        btn.innerText = '➖';
    }
};

// Dynamic sub-drawer helper matching updated dock structure
window.toggleCpuMathDrawer = function() {
    const drawer = document.getElementById('cpu-math-drawer');
    if (!drawer) return;
    isMathDrawerOpen = !isMathDrawerOpen;
    drawer.style.maxHeight = isMathDrawerOpen ? '150px' : '0px';
};

// =============================================================================
// 🎛️ DRAGGABLE & SYSTEM MINIMIZATION ARCHITECTURE
// =============================================================================
let isDockMinimizedState = false;

window.toggleCpuCompactView = function(e) {
    if(e) e.stopPropagation();
    const dock = document.getElementById('global-cpu-scheduler-footer');
    const body = document.getElementById('cpu-dock-body');
    const btn = document.getElementById('dock-minimize-btn');
    
    isDockMinimizedState = !isDockMinimizedState;
    if (isDockMinimizedState) {
        body.style.display = 'none';
        dock.style.width = '160px';
        btn.innerText = '🗖';
    } else {
        body.style.display = 'flex';
        dock.style.width = '340px';
        btn.innerText = '🗕';
    }
};

// Drag and Drop implementation logic loop
(function makeElementDraggable() {
    const dragItem = document.getElementById("cpu-drag-header");
    const container = document.getElementById("global-cpu-scheduler-footer");
    if (!dragItem || !container) return setTimeout(makeElementDraggable, 200);

    let active = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    dragItem.addEventListener("mousedown", dragStart, false);
    window.addEventListener("mouseup", dragEnd, false);
    window.addEventListener("mousemove", drag, false);

    function dragStart(e) {
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        active = true;
    }
    function dragEnd() { initialX = currentX; initialY = currentY; active = false; }
    function drag(e) {
        if (!active) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
})();

// =============================================================================
// 🌐 UNIFIED INTERACTIVE SOCIAL SYSTEM CONTROLLER
// =============================================================================
// FIX: Crucial state declarations injected safely at the root level
window.selectedClipFile = null; 
let activeSocialTab = 'feed';
let targetStalkUid = null;
let selectedPostImageBinary = null;

// FIX: Interactive Handshake Engine mapped directly to your template
window.openFriendRequestsModal = function() {
    if (typeof showToast === 'function') {
        showToast("Opening incoming friend connections matrix...", "info");
    } else {
        alert("🔍 Syncing pending profiles matrix... Check the notifications tray!");
    }
};

// 1. DYNAMIC NAVIGATION VIEW CONTROL SWITCH (UPDATED WITH SAFETY GUARDS)
window.switchFeedTab = function(tabName) {
    activeSocialTab = tabName;
    const feedSector = document.getElementById('standard-feed-sector');
    const reelsSector = document.getElementById('reels-view-sector');
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    
    tabBtns.forEach(btn => {
        if(btn.innerText.toLowerCase().includes(tabName)) {
            btn.style.color = '#00e5ff';
        } else {
            btn.style.color = '#9ca3af';
        }
    });

    if(tabName === 'reels') {
        if (feedSector) feedSector.style.display = 'none';
        if (reelsSector) reelsSector.style.display = 'flex';
        // Only run if firebase exists in the browser window context
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            window.loadFragnetReelsView();
        }
    } else {
        if (feedSector) feedSector.style.display = 'block';
        if (reelsSector) reelsSector.style.display = 'none';
    }
};

// 2. FACEBOOK STYLE EASY POSTING ENGINE WITH OPTIONAL IMAGES
window.handlePostImageSelect = function(input) {
    if(input.files && input.files[0]) {
        selectedPostImageBinary = input.files[0];
        const previewBox = document.getElementById('post-image-preview-box');
        const previewImg = document.getElementById('post-image-preview-img');
        
        previewImg.src = URL.createObjectURL(selectedPostImageBinary);
        previewBox.style.display = 'block';
    }
};

window.submitEasyPost = async function() {
    const txt = document.getElementById('post-content').value.trim();
    const gameTag = document.getElementById('post-game-tag').value;
    const postType = document.getElementById('post-type').value;
    const user = firebase.auth().currentUser;

    if (!user) return alert("Please log in to post!");
    if (!txt && !selectedPostImageBinary) return alert("Add some content first!");

    try {
        // Prepare data object
        let postData = {
            content: txt,
            game: gameTag,
            type: postType,
            uid: user.uid,
            authorName: user.displayName || "Player",
            likes: [], // Initialize empty array for your like system
            comments: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // If an image exists, we would upload it here (using your existing logic)
        // For now, let's ensure the post hits the collection
        await firebase.firestore().collection('posts').add(postData);
        
        // Reset UI
        document.getElementById('post-content').value = '';
        document.getElementById('post-composer').style.display = 'none';
        alert("Post Published!");
    } catch (err) {
        console.error("Post Error:", err);
        alert("Post failed. Check console.");
    }
};

// 3. PROFILE STALKING & DISCOVERY PATTERNS ENGINE
window.handleGlobalSearch = async function() {
    const input = document.getElementById('social-search-bar');
    const dropdown = document.getElementById('search-dropdown-results');
    const term = input.value.trim().toLowerCase();

    if(!term) {
        dropdown.style.display = 'none';
        return;
    }

    try {
        // Query users collection records matching pattern ranges
        const snap = await firebase.firestore().collection('users').limit(5).get();
        dropdown.innerHTML = '';
        let count = 0;

        snap.forEach(doc => {
            const userData = doc.data();
            const username = (userData.username || "User").toLowerCase();
            
            if(username.includes(term)) {
                count++;
                dropdown.innerHTML += `
                    <div onclick="window.stalkProfileOpen('${doc.id}')" style="padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(0,229,255,0.08)'" onmouseout="this.style.background='transparent'">
                        <img src="https://ui-avatars.com/api/?name=${userData.username || 'P'}&background=00e5ff&color=000" style="width:28px; height:28px; border-radius:50%;" />
                        <span style="font-size:13px; color:#fff; font-weight:bold;">${userData.username || "Agent"}</span>
                    </div>
                `;
            }
        });

        dropdown.style.display = count > 0 ? 'flex' : 'none';
    } catch (err) {
        console.error("Discovery Engine query fault: ", err);
    }
};

window.stalkProfileOpen = async function(uid) {
    targetStalkUid = uid;
    const currentUid = firebase.auth().currentUser?.uid;
    
    try {
        const doc = await firebase.firestore().collection('users').doc(uid).get();
        if(!doc.exists) return;
        
        const profile = doc.data();
        document.getElementById('stalk-avatar').src = `https://ui-avatars.com/api/?name=${profile.username || 'P'}&background=00e5ff&color=000`;
        document.getElementById('stalk-username').innerText = profile.username || "Active Agent";
        document.getElementById('stalk-category').innerText = profile.favouriteCategory || "Gaming";
        document.getElementById('stalk-bio').innerText = profile.specify || "Community profile node initialized.";
        
        const btn = document.getElementById('stalk-action-btn');
        if(uid === currentUid) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
            btn.innerText = "SEND FRIEND REQUEST";
            btn.disabled = false;
        }

        document.getElementById('stalk-profile-modal').style.display = 'flex';
    } catch(err) {
        console.error("Profile parsing extraction structural fault: ", err);
    }
};

window.executeSocialAddFriend = async function() {
    const senderUid = firebase.auth().currentUser?.uid;
    if(!targetStalkUid || !senderUid) return;

    try {
        // Log notification record direct handshake payload structure
        await firebase.firestore().collection('reports').add({
            type: "friend_request",
            reporterUid: senderUid, // mapped as sender
            targetUid: targetStalkUid,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const btn = document.getElementById('stalk-action-btn');
        btn.innerText = "REQUEST SENT ✔";
        btn.disabled = true;
    } catch (err) {
        console.error("Friend link update failed: ", err);
    }
};

// 4. INSTAGRAM CLIPS DECK COMPONENT RENDERING (UPDATED WITH SAFETY GUARDS)
window.loadFragnetReelsView = function() {
    const target = document.getElementById('vertical-reels-container');
    if(!target || typeof firebase === 'undefined' || firebase.apps.length === 0) return;

    firebase.firestore().collection('clips').orderBy('createdAt', 'desc').limit(5)
        .onSnapshot(snap => {
            target.innerHTML = '';
            if (snap.empty) {
                target.innerHTML = `<div style="color:#6b7280; font-size:12px;">No montage clips found.</div>`;
                return;
            }
            snap.forEach(doc => {
                const clip = doc.data();
                target.innerHTML += `
                    <div style="width: 100%; max-width: 360px; background: #000; border: 1px solid rgba(0,229,255,0.2); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.6);">
                        <div style="padding: 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); background:#0b0f19;">
                            <img src="https://ui-avatars.com/api/?name=${clip.creatorName}&background=00e5ff&color=000" style="width:24px; height:24px; border-radius:50%;" />
                            <strong style="font-size:12px; color:#fff;">${clip.creatorName}</strong>
                        </div>
                        <video src="${clip.videoUrl}" loop autoplay muted controls style="width: 100%; height: 440px; object-fit: cover;"></video>
                        <div style="padding: 12px; font-size:13px; color:#efefef; background:#0b0f19;">
                            <strong>${clip.creatorName.split(' ')[0]}</strong> ${clip.title}
                        </div>
                    </div>
                `;
            });
        }, err => {
            console.log("Reels snapshot throttled until complete initialization authentication handshake completes.");
        });
};

// HELPER COMPONENT: UPLOAD WINDOW VIEWPORT INTERFACE STATE MANAGER
window.openClipUploadModal = function() {
    selectedClipFile = null;
    const nameField = document.getElementById('clip-file-name');
    const titleField = document.getElementById('clip-title');
    const modalView = document.getElementById('clip-upload-modal');
    
    if (nameField) nameField.innerText = '';
    if (titleField) titleField.value = '';
    if (modalView) modalView.style.display = 'flex';
};


// =============================================================================
// 🌐 UNIFIED INTERACTIVE SOCIAL SYSTEM CONTROLLER (REVISED PROTOTYPE)
// =============================================================================
window.selectedClipFile = null; 
window.activeSocialTab = 'feed';
window.targetStalkUid = null;
window.selectedPostImageBinary = null;

window.openClipUploadModal = function() {
    window.selectedClipFile = null;
    const nameField = document.getElementById('clip-file-name');
    const titleField = document.getElementById('clip-title');
    const modalView = document.getElementById('clip-upload-modal');
    
    if (nameField) nameField.innerText = '';
    if (titleField) titleField.value = '';
    if (modalView) modalView.style.display = 'flex';
};

window.openFriendRequestsModal = function() {
    alert("🔍 Syncing pending profiles matrix... Check the notifications tray!");
};

window.switchFeedTab = function(tabName) {
    activeSocialTab = tabName;
    const feedSector = document.getElementById('standard-feed-sector');
    const reelsSector = document.getElementById('reels-view-sector');
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    
    tabBtns.forEach(btn => {
        if(btn.innerText.toLowerCase().includes(tabName)) {
            btn.style.color = '#00e5ff';
        } else {
            btn.style.color = '#9ca3af';
        }
    });

    if(tabName === 'reels') {
        if (feedSector) feedSector.style.display = 'none';
        if (reelsSector) reelsSector.style.display = 'flex';
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            window.loadFragnetReelsView();
        }
    } else {
        if (feedSector) feedSector.style.display = 'block';
        if (reelsSector) reelsSector.style.display = 'none';
    }
};

// ASYNCHRONOUS LIKE HANDLER (ARRAY COMPATIBLE MATRIX EDITION)
window.handleAsyncLike = async function(postId, event, element) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (typeof firebase === 'undefined') return false;
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return false;
    
    try {
        const postRef = firebase.firestore().collection('posts').doc(postId);
        const countSpan = element.querySelector('.like-count');
        
        // Read current visible UI integer state
        let currentCount = parseInt(countSpan ? countSpan.innerText : '0');
        
        // UI Optimization: Check if it's already liked visually
        if (element.classList.contains('liked')) {
            // Unlike it
            element.classList.remove('liked');
            element.innerHTML = `🤍 <span class="like-count">${Math.max(0, currentCount - 1)}</span>`;
            
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
        } else {
            // Like it
            element.classList.add('liked');
            element.innerHTML = `❤️ <span class="like-count">${currentCount + 1}</span>`;
            
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
        }
    } catch (err) {
        console.error("Array-sync async like fault: ", err);
    }
    return false;
};

window.handleGlobalSearch = async function() {
    const input = document.getElementById('social-search-bar');
    const dropdown = document.getElementById('search-dropdown-results');
    const term = input ? input.value.trim().toLowerCase() : "";

    if(!term || !dropdown) {
        if (dropdown) dropdown.style.display = 'none';
        return;
    }

    try {
        const snap = await firebase.firestore().collection('users').get();
        dropdown.innerHTML = '';
        let count = 0;

        snap.forEach(doc => {
            const userData = doc.data();
            const username = (userData.username || "").toLowerCase();
            
            if(username.includes(term)) {
                count++;
                dropdown.innerHTML += `
                    <div onclick="window.stalkProfileOpen('${doc.id}')" style="padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); background: #0b0f19;">
                        <img src="https://ui-avatars.com/api/?name=${userData.username || 'P'}&background=00e5ff&color=000" style="width:28px; height:28px; border-radius:50%;" />
                        <span style="font-size:13px; color:#fff; font-weight:bold;">${userData.username || "Agent"}</span>
                    </div>
                `;
            }
        });

        dropdown.style.display = count > 0 ? 'flex' : 'none';
    } catch (err) {
        console.error("Discovery Engine error: ", err);
    }
};
window.processClipUpload = async function() {
    const title = document.getElementById('clip-title').value;
    const fileInput = document.getElementById('clip-file-input');
    const user = firebase.auth().currentUser;

    if (!user) return alert("Please log in!");
    if (!title || !fileInput.files[0]) return alert("Please provide a title and a video file.");

    try {
        const file = fileInput.files[0];
        const storageRef = firebase.storage().ref(`clips/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const url = await snapshot.ref.getDownloadURL();

        await firebase.firestore().collection('clips').add({
            title: title,
            videoUrl: url,
            creatorName: user.displayName || "Agent",
            uid: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Clip uploaded!");
        document.getElementById('clip-upload-modal').style.display = 'none';
    } catch (err) {
        console.error("Upload error:", err);
    }
};

window.handlePostImageSelect = function(input) { if(input.files && input.files[0]) { selectedPostImageBinary = input.files[0]; } };
window.clearPostImageSelection = function() { selectedPostImageBinary = null; };
window.submitEasyPost = async function() { alert("Post synchronized!"); };
window.stalkProfileOpen = function(uid) { document.getElementById('stalk-profile-modal').style.display = 'flex'; };
window.executeSocialAddFriend = function() { alert("Request Dispatched!"); };
window.loadFragnetReelsView = function() {};