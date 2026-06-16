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
    if (id === 'profile') loadProfile();
    if (id === 'messages') loadDMPage();
    if (id === 'global-chat') loadGlobalChat();
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
      <button class="card-action-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}">
        ${liked ? '❤️' : '🤍'} ${(data.likes || []).length}
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