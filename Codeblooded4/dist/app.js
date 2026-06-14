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
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

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
const storage = getStorage(app);
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

// ─── PRESENCE / ONLINE STATUS ─────────────────────────────────────────────
// A user is considered "online" if their `lastSeen` timestamp is within this
// window. We refresh `lastSeen` on a heartbeat while the tab is active, and
// mark the user offline on unload/visibility change (best-effort).
const PRESENCE_INTERVAL_MS = 30000;       // heartbeat every 30s
const PRESENCE_ONLINE_WINDOW_MS = 75000;  // considered online if seen in last 75s
let presenceTimer = null;

function isUserOnline(data) {
    if (!data) return false;
    if (data.isOnline === false) return false;
    const ts = data.lastSeen;
    if (!ts) return false;
    const millis = ts.toMillis ? ts.toMillis() : ts;
    return (Date.now() - millis) < PRESENCE_ONLINE_WINDOW_MS;
}

// Returns the inline HTML for a status dot, given a user data object.
function statusDot(data, extraClass = '') {
    const online = isUserOnline(data);
    return `<span class="status-dot ${online ? 'online' : 'offline'} ${extraClass}" title="${online ? 'Online' : 'Offline'}"></span>`;
}

// Returns a username + status dot. If the user is someone other than the
// current user, the username is wrapped in a clickable ".user-chip" span
// (data-uid/data-username) that opens the user action menu (Add Friend,
// Chat, Invite to Team Chat, Report, Block).
function userChip(uid, username, statusData) {
    const name = escHtml(username || 'Player');
    if (!uid || uid === currentUser?.uid) {
        return `${name} ${statusDot(statusData)}`;
    }
    return `<span class="user-chip" data-uid="${uid}" data-username="${name}">${name}</span> ${statusDot(statusData)}`;
}

async function setPresence(online) {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            isOnline: online,
            lastSeen: serverTimestamp()
        });
    } catch (_) { /* ignore — user doc may not exist yet */ }
}

function startPresenceHeartbeat() {
    stopPresenceHeartbeat();
    setPresence(true);
    presenceTimer = setInterval(() => setPresence(true), PRESENCE_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function stopPresenceHeartbeat() {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = null;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
}

function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        setPresence(true);
    } else {
        setPresence(false);
    }
}

function handleBeforeUnload() {
    setPresence(false);
}


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

// Cache of { [uid]: userData } used to render online/offline dots next to
// usernames across feed, comments, leaderboard, and chat without refetching.
const usersCache = new Map();

async function getUserData(uid, { fresh = false } = {}) {
    if (!uid) return null;
    if (!fresh && usersCache.has(uid)) return usersCache.get(uid);
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.exists() ? snap.data() : null;
        usersCache.set(uid, data);
        return data;
    } catch (_) {
        return usersCache.get(uid) || null;
    }
}

// Pre-warm the cache for a batch of uids (deduped, parallel).
async function preloadUsers(uids) {
    const unique = [...new Set(uids.filter(Boolean))];
    await Promise.all(unique.map(uid => getUserData(uid, { fresh: true })));
}

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
    if (id === 'profile') loadProfile();
    if (id === 'chat') initChatPage();
    if (id === 'leaderboard') loadRightPanel();
}

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', e => {
            e.preventDefault();
            showPage(n.dataset.page);
        });
    });

    // ─── CATEGORY "SPECIFY" FIELDS ─────────────────────────────────────────────────
    wireCategorySpecify('reg-game', 'reg-game-specify');
    wireCategorySpecify('post-game-tag', 'post-game-tag-specify');
    wireCategorySpecify('profile-fav-game-select', 'profile-fav-game-specify');

    // ─── USER ACTION MENU (delegated clicks) ───────────────────────────────────────
    document.addEventListener('click', e => {
        const chip = e.target.closest('.user-chip');
        if (chip) {
            e.stopPropagation();
            if (menuUid === chip.dataset.uid && !document.getElementById('user-menu').classList.contains('hidden')) {
                closeUserMenu();
            } else {
                openUserMenu(chip.dataset.uid, chip.dataset.username, chip);
            }
            return;
        }
        const menu = document.getElementById('user-menu');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
            closeUserMenu();
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeUserMenu();
    });
    window.addEventListener('scroll', e => {
        const menu = document.getElementById('user-menu');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
            closeUserMenu();
        }
    }, true);

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
                    friends: [],
                    blocked: [],
                    isAdmin: false, // ← regular user by default
                    isOnline: true,
                    lastSeen: serverTimestamp(),
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
                friends: [],
                blocked: [],
                isAdmin: false, // ← regular user by default
                isOnline: true,
                lastSeen: serverTimestamp(),
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

    document.getElementById('btn-logout') ?.addEventListener('click', async () => {
        if (currentUser) {
            try { await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }); } catch(_) {}
        }
        stopPresenceHeartbeat();
        signOut(auth);
    });
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
        startPresenceHeartbeat();
        showPage('feed');
        loadRightPanel();
    } else {
        if (currentUser) {
            // Best-effort: mark offline before clearing user (won't await on sign-out)
            updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
        }
        stopPresenceHeartbeat();
        currentUser = null;
        currentProfile = null;
        document.getElementById('auth-overlay').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
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
            friends: currentProfile.friends || [],
            blocked: currentProfile.blocked || [],
            isAdmin: currentProfile.isAdmin ?? false,
            isOnline: currentProfile.isOnline ?? true,
            lastSeen: currentProfile.lastSeen ?? serverTimestamp(),
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
            friends: [],
            blocked: [],
            isAdmin: false,
            isOnline: true,
            lastSeen: serverTimestamp(),
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
    document.getElementById('sidebar-username').innerHTML = `${escHtml(currentProfile.username || 'Player')} <span class="status-dot online" id="sidebar-status-dot" title="Online"></span>`;
    document.getElementById('sidebar-elo').textContent = `${currentProfile.elo || 1000} ELO`;
    document.getElementById('sidebar-rank-badge').textContent = rank.short;
    document.getElementById('sidebar-rank-badge').style.background = rank.color;
}

// ─── FEED ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-new-post').addEventListener('click', () => {
    const c = document.getElementById('post-composer');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-post-submit').addEventListener('click', async() => {
    const content = document.getElementById('post-content').value.trim();
    const gameTag = combineCategory('post-game-tag', 'post-game-tag-specify');
    const postType = document.getElementById('post-type').value;
    if (!content) return toast('Write something first.', 'error');
    try {
        await addDoc(collection(db, 'posts'), {
            uid: currentUser.uid,
            username: currentProfile.username,
            photoURL: currentProfile.photoURL || '',
            content,
            gameTag,
            postType,
            likes: [],
            comments: 0,
            createdAt: serverTimestamp()
        });
        document.getElementById('post-content').value = '';
        document.getElementById('post-game-tag').value = '';
        document.getElementById('post-game-tag-specify').value = '';
        document.getElementById('post-game-tag-specify').style.display = 'none';
        document.getElementById('post-composer').style.display = 'none';
        toast('Posted! 🔥', 'success');
        loadFeed();
    } catch (e) {
        toast('Failed to post: ' + e.message, 'error');
    }
});

async function loadFeed() {
    const list = document.getElementById('feed-list');
    list.innerHTML = '<div class="feed-loading">Loading…</div>';
    try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        if (snap.empty) { list.innerHTML = '<div class="feed-loading">No posts yet. Be the first!</div>'; return; }
        await preloadUsers(snap.docs.map(d => d.data().uid));
        list.innerHTML = '';
        const blocked = currentProfile?.blocked || [];
        let shown = 0;
        snap.forEach(d => {
            const data = d.data();
            if (blocked.includes(data.uid)) return;
            list.appendChild(buildPostCard(d.id, data));
            shown++;
        });
        if (shown === 0) list.innerHTML = '<div class="feed-loading">No posts to show.</div>';
    } catch (e) {
        list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
    }
}

function buildPostCard(id, data) {
    const rank = getRank(0); // we'd need to fetch per user; keep lean here
    const liked = (data.likes || []).includes(currentUser ?.uid);
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
    <div class="card-header">
      <img class="avatar-sm" src="${avatarUrl(data)}" alt="${data.username}" />
      <div class="card-meta">
        <div class="card-username">${userChip(data.uid, data.username, usersCache.get(data.uid))}</div>
        <div class="card-timestamp">${timeAgo(data.createdAt)}</div>
      </div>
      <div class="card-tags">
        ${data.gameTag ? `<span class="tag-pill tag-game">${escHtml(data.gameTag)}</span>` : ''}
        <span class="tag-pill tag-${data.postType}">${postTypeLabel(data.postType)}</span>
      </div>
    </div>
    <div class="card-body">${escHtml(data.content)}</div>
    <div class="card-actions">
      <button class="card-action-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}">
        ${liked ? '❤️' : '🤍'} ${(data.likes || []).length}
      </button>
      <button class="card-action-btn comment-toggle-btn" data-id="${id}">💬 <span class="comment-count">${data.comments || 0}</span></button>
      ${data.uid === currentUser?.uid ? `<button class="card-action-btn delete-post-btn" data-id="${id}" style="margin-left:auto;color:var(--red)">🗑️ Delete</button>` : ''}
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
  card.querySelector('.comment-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitComment(id);
  });
  return card;
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
    await preloadUsers(snap.docs.map(d => d.data().uid));
    list.innerHTML = '';
    const blocked = currentProfile?.blocked || [];
    let shown = 0;
    snap.forEach(d => {
      const data = d.data();
      if (blocked.includes(data.uid)) return;
      list.appendChild(buildCommentRow(postId, d.id, data));
      shown++;
    });
    if (shown === 0) list.innerHTML = '<div class="no-comments">No comments to show.</div>';
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
        <span class="comment-username">${userChip(data.uid, data.username, usersCache.get(data.uid))}</span>
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
      list.appendChild(buildLbRow(pos++, d.data(), d.id));
    });
  } catch(e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function buildLbRow(pos, data, uid) {
  const rank = getRank(data.elo || 1000);
  const rankClass = pos === 1 ? 'gold-1' : pos === 2 ? 'silver-2' : pos === 3 ? 'bronze-3' : '';
  const wr = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0;
  const row = document.createElement('div');
  row.className = 'lb-row';
  row.innerHTML = `
    <div class="lb-rank ${rankClass}">${pos}</div>
    <img src="${avatarUrl(data)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border2)" />
    <div class="lb-info">
      <div class="lb-name">${userChip(uid, data.username, data)}</div>
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

// Avatar upload
document.getElementById('avatar-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return toast('Image must be under 2 MB.', 'error');
  if (!currentUser) return toast('You must be signed in to upload an avatar.', 'error');
  toast('Uploading avatar…');
  try {
    const ref = storageRef(storage, `avatars/${currentUser.uid}`);
    await uploadBytes(ref, file, { contentType: file.type });
    const url = await getDownloadURL(ref);
    await updateProfile(currentUser, { photoURL: url });
    await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
    await refreshCurrentProfile();
    updateSidebar();
    document.getElementById('profile-avatar').src = url;
    toast('Avatar updated! 🎉', 'success');
  } catch(e) {
    console.error('Avatar upload failed', e);
    const code = e.code || e.message || 'unknown error';
    toast(`Upload failed (${code}). Check Storage rules in Firebase Console.`, 'error');
  } finally {
    e.target.value = '';
  }
});

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
          <div class="panel-user-name">${userChip(d.id, data.username, data)}</div>
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
          <div class="panel-user-name">${userChip(d.id, data.username, data)}</div>
          <div class="panel-user-sub">${escHtml(data.favGame || 'No game set')}</div>
        </div>`;
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

// ─── CHAT ─────────────────────────────────────────────────────────────────────
// Three chat surfaces, all built on the same rendering helpers:
//   - Global Chat:  /globalChat/{messageId}
//   - Direct Msgs:  /dmThreads/{threadId}/messages/{messageId}  (threadId = sorted "uidA_uidB")
//   - Team Chat:    /teams/{teamId}/messages/{messageId}

let chatInitDone = false;
let globalChatUnsub = null;
let dmMessagesUnsub = null;
let dmThreadsUnsub = null;
let teamChatMessagesUnsub = null;
let activeDmThreadId = null;
let activeDmOtherUser = null; // { uid, username, photoURL }
let activeTeamId = null;

function dmThreadId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function formatChatTime(ts) {
  if (!ts) return '';
  const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderChatMessage(data, container) {
  const own = data.uid === currentUser?.uid;
  if (!own && (currentProfile?.blocked || []).includes(data.uid)) return; // hide messages from blocked users
  const userData = own ? currentProfile : usersCache.get(data.uid);
  const row = document.createElement('div');
  row.className = `chat-msg ${own ? 'own' : ''}`;
  row.innerHTML = `
    <img class="avatar-xs" src="${avatarUrl(data)}" alt="${escHtml(data.username)}" />
    <div class="chat-msg-bubble">
      <div class="chat-msg-meta">
        ${userChip(data.uid, data.username, userData)}
        <span class="chat-msg-time">${formatChatTime(data.createdAt)}</span>
      </div>
      <div class="chat-msg-text">${escHtml(data.text)}</div>
    </div>`;
  container.appendChild(row);
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage(collectionPath, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!currentUser || !currentProfile) return toast('You must be signed in to chat.', 'error');
  await addDoc(collection(db, ...collectionPath), {
    uid: currentUser.uid,
    username: currentProfile.username,
    photoURL: currentProfile.photoURL || '',
    text: trimmed,
    createdAt: serverTimestamp()
  });
}

// ─── CHAT TABS ──────────────────────────────────────────────────────────────
function initChatTabs() {
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.chatTab;
      document.querySelectorAll('.chat-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.chat-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`chat-panel-${target}`).classList.add('active');

      if (target === 'global') initGlobalChat();
      if (target === 'dms') initDmChat();
      if (target === 'team') initTeamChat();
    });
  });
}

// Called whenever the Chat nav page is opened.
function initChatPage() {
  if (!chatInitDone) {
    initChatTabs();
    chatInitDone = true;
  }
  // Always (re)load whichever tab is currently active.
  const activeTab = document.querySelector('.chat-tab.active')?.dataset.chatTab || 'global';
  if (activeTab === 'global') initGlobalChat();
  if (activeTab === 'dms') initDmChat();
  if (activeTab === 'team') initTeamChat();
}

// ─── GLOBAL CHAT ────────────────────────────────────────────────────────────
function initGlobalChat() {
  const container = document.getElementById('global-chat-messages');
  const form = document.getElementById('global-chat-form');
  const input = document.getElementById('global-chat-input');

  if (globalChatUnsub) return; // already listening

  container.innerHTML = '<div class="feed-loading">Loading chat…</div>';
  const q = query(collection(db, 'globalChat'), orderBy('createdAt', 'asc'), limit(100));
  globalChatUnsub = onSnapshot(q, async snap => {
    const docs = snap.docs.map(d => d.data());
    await preloadUsers(docs.map(d => d.uid));
    container.innerHTML = '';
    if (docs.length === 0) {
      container.innerHTML = '<div class="feed-loading">No messages yet. Say hi! 👋</div>';
    } else {
      docs.forEach(data => renderChatMessage(data, container));
    }
    scrollToBottom(container);
  }, err => {
    container.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`;
  });

  if (!form.dataset.wired) {
    form.dataset.wired = '1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      try {
        await sendChatMessage(['globalChat'], text);
      } catch (err) {
        toast('Failed to send: ' + err.message, 'error');
      }
    });
  }
}

// ─── DIRECT MESSAGES ────────────────────────────────────────────────────────
function initDmChat() {
  loadDmThreads();
  wireDmSearch();
  wireDmForm();
}

async function loadDmThreads() {
  const list = document.getElementById('dm-thread-list');
  if (!currentUser) return;

  if (dmThreadsUnsub) dmThreadsUnsub();

  // NOTE: we intentionally do NOT add orderBy('lastMessageAt') to this query.
  // Combining `array-contains` with `orderBy` on a different field requires a
  // Firestore composite index (this was the "query requires an index" error).
  // Sorting client-side avoids that requirement entirely.
  const q = query(
    collection(db, 'dmThreads'),
    where('participants', 'array-contains', currentUser.uid),
    limit(30)
  );

  dmThreadsUnsub = onSnapshot(q, async snap => {
    if (snap.empty) {
      list.innerHTML = '<div class="feed-loading">No conversations yet. Search for a player to start one.</div>';
      return;
    }
    let threads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    threads.sort((a, b) => {
      const at = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
      const bt = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
      return bt - at;
    });
    threads = threads.slice(0, 30);

    const otherUids = threads.map(t => t.participants.find(p => p !== currentUser.uid));
    await preloadUsers(otherUids);

    const blocked = currentProfile?.blocked || [];
    list.innerHTML = '';
    threads.forEach(t => {
      const otherUid = t.participants.find(p => p !== currentUser.uid);
      if (blocked.includes(otherUid)) return; // hide threads with blocked users
      const otherData = usersCache.get(otherUid);
      const row = document.createElement('div');
      row.className = `dm-thread ${activeDmThreadId === t.id ? 'active' : ''}`;
      row.innerHTML = `
        <img src="${avatarUrl(otherData)}" />
        <div class="dm-thread-info">
          <div class="dm-thread-name">${userChip(otherUid, otherData?.username || 'Player', otherData)}</div>
          <div class="dm-thread-preview">${escHtml(t.lastMessage || 'No messages yet')}</div>
        </div>`;
      row.addEventListener('click', () => openDmThread(otherUid, otherData?.username || 'Player', otherData));
      list.appendChild(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<div class="feed-loading">No conversations yet. Search for a player to start one.</div>';
    }
  }, err => {
    list.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`;
  });
}

function wireDmSearch() {
  const input = document.getElementById('dm-user-search');
  const results = document.getElementById('dm-search-results');
  if (input.dataset.wired) return;
  input.dataset.wired = '1';

  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const term = input.value.trim();
    if (!term) { results.innerHTML = ''; return; }
    debounceTimer = setTimeout(() => searchDmUsers(term), 300);
  });
}

async function searchDmUsers(term) {
  const results = document.getElementById('dm-search-results');
  results.innerHTML = '<div class="feed-loading">Searching…</div>';
  try {
    // Firestore prefix search using range query on username
    const q = query(
      collection(db, 'users'),
      orderBy('username'),
      where('username', '>=', term),
      where('username', '<=', term + '\uf8ff'),
      limit(8)
    );
    const snap = await getDocs(q);
    results.innerHTML = '';
    let found = 0;
    const blocked = currentProfile?.blocked || [];
    snap.forEach(d => {
      const data = d.data();
      if (d.id === currentUser.uid) return; // skip self
      if (blocked.includes(d.id)) return; // skip blocked users
      found++;
      usersCache.set(d.id, data);
      const row = document.createElement('div');
      row.className = 'dm-thread';
      row.innerHTML = `
        <img src="${avatarUrl(data)}" />
        <div class="dm-thread-info">
          <div class="dm-thread-name">${userChip(d.id, data.username, data)}</div>
          <div class="dm-thread-preview">Click to message</div>
        </div>`;
      row.addEventListener('click', () => {
        openDmThread(d.id, data.username, data);
        document.getElementById('dm-user-search').value = '';
        results.innerHTML = '';
      });
      results.appendChild(row);
    });
    if (found === 0) results.innerHTML = '<div class="feed-loading">No players found.</div>';
  } catch (e) {
    results.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

async function openDmThread(otherUid, otherUsername, otherData) {
  activeDmThreadId = dmThreadId(currentUser.uid, otherUid);
  activeDmOtherUser = { uid: otherUid, username: otherUsername, ...otherData };

  // Ensure thread doc exists
  const threadRef = doc(db, 'dmThreads', activeDmThreadId);
  try {
    const snap = await getDoc(threadRef);
    if (!snap.exists()) {
      await setDoc(threadRef, {
        participants: [currentUser.uid, otherUid],
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        lastSenderId: ''
      });
    }
  } catch (e) {
    toast('Could not open conversation: ' + e.message, 'error');
    return;
  }

  // Header
  const header = document.getElementById('dm-header');
  header.innerHTML = `
    <img src="${avatarUrl(otherData)}" />
    <span>${userChip(otherUid, otherUsername, otherData)}</span>`;

  document.getElementById('dm-chat-form').style.display = 'flex';

  // Highlight active thread in sidebar
  document.querySelectorAll('#dm-thread-list .dm-thread').forEach(el => el.classList.remove('active'));

  // Messages listener
  const container = document.getElementById('dm-chat-messages');
  container.innerHTML = '<div class="feed-loading">Loading messages…</div>';
  if (dmMessagesUnsub) dmMessagesUnsub();

  const q = query(
    collection(db, 'dmThreads', activeDmThreadId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  dmMessagesUnsub = onSnapshot(q, async snap => {
    const docs = snap.docs.map(d => d.data());
    await preloadUsers(docs.map(d => d.uid));
    container.innerHTML = '';
    if (docs.length === 0) {
      container.innerHTML = '<div class="feed-loading">No messages yet. Say hi! 👋</div>';
    } else {
      docs.forEach(data => renderChatMessage(data, container));
    }
    scrollToBottom(container);
  }, err => {
    container.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`;
  });
}

function wireDmForm() {
  const form = document.getElementById('dm-chat-form');
  const input = document.getElementById('dm-chat-input');
  if (form.dataset.wired) return;
  form.dataset.wired = '1';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!activeDmThreadId) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await sendChatMessage(['dmThreads', activeDmThreadId, 'messages'], text);
      await updateDoc(doc(db, 'dmThreads', activeDmThreadId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastSenderId: currentUser.uid
      });
    } catch (err) {
      toast('Failed to send: ' + err.message, 'error');
    }
  });
}

// ─── TEAM CHAT ──────────────────────────────────────────────────────────────
async function initTeamChat() {
  const list = document.getElementById('team-chat-list');
  list.innerHTML = '<div class="feed-loading">Loading your teams…</div>';
  try {
    const q = query(
      collection(db, 'teams'),
      where('members', 'array-contains', currentUser.uid),
      limit(20)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = '<div class="feed-loading">Join or create a team to chat with teammates.</div>';
      return;
    }
    list.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const row = document.createElement('div');
      row.className = `dm-thread ${activeTeamId === d.id ? 'active' : ''}`;
      row.innerHTML = `
        <div class="avatar-placeholder" style="display:flex;align-items:center;justify-content:center;background:var(--bg4);font-family:var(--font-display);font-weight:700;color:var(--accent)">${escHtml((data.tag || '?').slice(0,3))}</div>
        <div class="dm-thread-info">
          <div class="dm-thread-name">[${escHtml(data.tag)}] ${escHtml(data.name)}</div>
          <div class="dm-thread-preview">${data.memberCount || 1} members</div>
        </div>`;
      row.addEventListener('click', () => openTeamChat(d.id, data));
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = `<div class="feed-loading">Error: ${e.message}</div>`;
  }
}

function openTeamChat(teamId, teamData) {
  activeTeamId = teamId;

  const header = document.getElementById('team-chat-header');
  header.innerHTML = `<span>🛡️ [${escHtml(teamData.tag)}] ${escHtml(teamData.name)} — Team Chat</span>`;

  document.getElementById('team-chat-form').style.display = 'flex';
  document.querySelectorAll('#team-chat-list .dm-thread').forEach(el => el.classList.remove('active'));

  const container = document.getElementById('team-chat-messages');
  container.innerHTML = '<div class="feed-loading">Loading messages…</div>';
  if (teamChatMessagesUnsub) teamChatMessagesUnsub();

  const q = query(
    collection(db, 'teams', teamId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  teamChatMessagesUnsub = onSnapshot(q, async snap => {
    const docs = snap.docs.map(d => d.data());
    await preloadUsers(docs.map(d => d.uid));
    container.innerHTML = '';
    if (docs.length === 0) {
      container.innerHTML = '<div class="feed-loading">No messages yet. Say hi to your team! 👋</div>';
    } else {
      docs.forEach(data => renderChatMessage(data, container));
    }
    scrollToBottom(container);
  }, err => {
    container.innerHTML = `<div class="feed-loading">Error: ${err.message}</div>`;
  });

  wireTeamChatForm();
}

function wireTeamChatForm() {
  const form = document.getElementById('team-chat-form');
  const input = document.getElementById('team-chat-input');
  if (form.dataset.wired) return;
  form.dataset.wired = '1';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!activeTeamId) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await sendChatMessage(['teams', activeTeamId, 'messages'], text);
    } catch (err) {
      toast('Failed to send: ' + err.message, 'error');
    }
  });
}


// ─── USER ACTION MENU (Add Friend / Chat / Invite to Team / Report / Block) ──
// Triggered by clicking any ".user-chip" rendered via userChip(). Shows a
// small popover anchored under the chip with social/moderation actions.

let menuUid = null;
let menuUsername = null;
let menuAnchor = null;

function closeUserMenu() {
  document.getElementById('user-menu')?.classList.add('hidden');
  menuUid = null;
  menuUsername = null;
  menuAnchor = null;
}

// Positions the (already-rendered) menu under the anchor element, flipping
// above/left if it would overflow the viewport.
function positionUserMenu(anchorEl) {
  const menu = document.getElementById('user-menu');
  menu.classList.remove('hidden');
  menu.style.visibility = 'hidden';

  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();

  let top = rect.bottom + window.scrollY + 6;
  let left = rect.left + window.scrollX;

  const maxLeft = window.scrollX + window.innerWidth - menuRect.width - 8;
  const maxTop = window.scrollY + window.innerHeight - menuRect.height - 8;

  if (left > maxLeft) left = Math.max(8, maxLeft);
  if (top > maxTop) top = Math.max(8, rect.top + window.scrollY - menuRect.height - 6);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

async function openUserMenu(uid, username, anchorEl) {
  if (!currentUser || !uid || uid === currentUser.uid) return;
  menuUid = uid;
  menuUsername = username;
  menuAnchor = anchorEl;

  const data = await getUserData(uid, { fresh: true });

  document.getElementById('um-avatar').src = avatarUrl(data || { username });
  document.getElementById('um-username').textContent = username;
  document.getElementById('um-elo').textContent = data ? `${data.elo || 1000} ELO · ${getRank(data.elo || 1000).label}` : '';

  renderMainMenuItems();
  positionUserMenu(anchorEl);
}

// Draws the main "Add Friend / Chat / Invite to Team Chat / Report / Block" list.
function renderMainMenuItems() {
  const itemsEl = document.getElementById('user-menu-items');
  const isFriend = (currentProfile?.friends || []).includes(menuUid);
  const isBlocked = (currentProfile?.blocked || []).includes(menuUid);

  itemsEl.innerHTML = `
    <button class="user-menu-item" data-act="friend">${isFriend ? '✅ Friends — Remove' : '➕ Add Friend'}</button>
    <button class="user-menu-item" data-act="chat">💬 Chat</button>
    <button class="user-menu-item" data-act="invite">🛡️ Invite to Team Chat</button>
    <div class="user-menu-divider"></div>
    <button class="user-menu-item danger" data-act="report">🚩 Report</button>
    <button class="user-menu-item danger" data-act="block">${isBlocked ? '✅ Unblock User' : '⛔ Block User'}</button>
  `;

  itemsEl.querySelector('[data-act="friend"]').addEventListener('click', toggleFriend);
  itemsEl.querySelector('[data-act="chat"]').addEventListener('click', startChatWithMenuUser);
  itemsEl.querySelector('[data-act="invite"]').addEventListener('click', showTeamInviteSubmenu);
  itemsEl.querySelector('[data-act="report"]').addEventListener('click', reportMenuUser);
  itemsEl.querySelector('[data-act="block"]').addEventListener('click', toggleBlock);

  if (menuAnchor) positionUserMenu(menuAnchor);
}

async function toggleFriend() {
  const uid = menuUid, username = menuUsername;
  const isFriend = (currentProfile.friends || []).includes(uid);
  closeUserMenu();
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friends: isFriend ? arrayRemove(uid) : arrayUnion(uid)
    });
    await refreshCurrentProfile();
    toast(isFriend ? `Removed ${username} from friends.` : `${username} added as a friend! 🎉`, 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function toggleBlock() {
  const uid = menuUid, username = menuUsername;
  const isBlocked = (currentProfile.blocked || []).includes(uid);
  if (!isBlocked && !confirm(`Block ${username}? You won't see their posts or messages, and they won't be able to message you.`)) {
    closeUserMenu();
    return;
  }
  closeUserMenu();
  try {
    const updates = { blocked: isBlocked ? arrayRemove(uid) : arrayUnion(uid) };
    if (!isBlocked && (currentProfile.friends || []).includes(uid)) {
      updates.friends = arrayRemove(uid);
    }
    await updateDoc(doc(db, 'users', currentUser.uid), updates);
    await refreshCurrentProfile();
    toast(isBlocked ? `Unblocked ${username}.` : `Blocked ${username}.`, 'success');
    loadFeed();
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function reportMenuUser() {
  const uid = menuUid, username = menuUsername;
  closeUserMenu();
  const reason = prompt(`Report ${username} — briefly describe the issue:`);
  if (reason === null) return;
  if (!reason.trim()) return toast('Report cancelled — no reason given.', 'error');
  try {
    await addDoc(collection(db, 'reports'), {
      reportedUid: uid,
      reportedUsername: username,
      reporterUid: currentUser.uid,
      reporterUsername: currentProfile.username,
      reason: reason.trim(),
      status: 'open',
      createdAt: serverTimestamp()
    });
    toast(`${username} has been reported. Our team will review it.`, 'success');
  } catch (e) {
    toast('Failed to submit report: ' + e.message, 'error');
  }
}

function startChatWithMenuUser() {
  const uid = menuUid, username = menuUsername;
  const data = usersCache.get(uid);
  closeUserMenu();
  showPage('chat');
  const dmTab = document.querySelector('.chat-tab[data-chat-tab="dms"]');
  if (dmTab && !dmTab.classList.contains('active')) dmTab.click();
  openDmThread(uid, username, data);
}

// Replaces the menu body with a list of the current user's teams so they can
// add `menuUid` as a member (giving them access to that team's chat).
async function showTeamInviteSubmenu() {
  const uid = menuUid, username = menuUsername;
  const itemsEl = document.getElementById('user-menu-items');
  itemsEl.innerHTML = '<div class="user-menu-empty">Loading your teams…</div>';
  positionUserMenu(menuAnchor);

  try {
    const q = query(collection(db, 'teams'), where('members', 'array-contains', currentUser.uid), limit(20));
    const snap = await getDocs(q);

    if (snap.empty) {
      itemsEl.innerHTML = `<div class="user-menu-empty">You're not in any teams yet.</div><button class="user-menu-item" data-act="back">← Back</button>`;
    } else {
      const rows = snap.docs.map(d => ({ id: d.id, t: d.data() }));
      itemsEl.innerHTML = rows.map(({ id, t }) => {
        const already = (t.members || []).includes(uid);
        return `<button class="user-menu-item" data-tid="${id}" ${already ? 'disabled' : ''}>${already ? '✅' : '🛡️'} [${escHtml(t.tag)}] ${escHtml(t.name)}${already ? ' (already in)' : ''}</button>`;
      }).join('') + `<div class="user-menu-divider"></div><button class="user-menu-item" data-act="back">← Back</button>`;

      rows.forEach(({ id, t }) => {
        if (!(t.members || []).includes(uid)) {
          itemsEl.querySelector(`[data-tid="${id}"]`).addEventListener('click', () => inviteUserToTeam(id, t, uid, username));
        }
      });
    }
    itemsEl.querySelector('[data-act="back"]')?.addEventListener('click', renderMainMenuItems);
  } catch (e) {
    itemsEl.innerHTML = `<div class="user-menu-empty">Error: ${e.message}</div><button class="user-menu-item" data-act="back">← Back</button>`;
    itemsEl.querySelector('[data-act="back"]')?.addEventListener('click', renderMainMenuItems);
  }
  positionUserMenu(menuAnchor);
}

async function inviteUserToTeam(teamId, teamData, uid, username) {
  try {
    await updateDoc(doc(db, 'teams', teamId), {
      members: arrayUnion(uid),
      memberCount: increment(1)
    });
    toast(`Added ${username} to [${teamData.tag}] ${teamData.name}! 🛡️`, 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
  closeUserMenu();
}


function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}