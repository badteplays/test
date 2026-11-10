import {
    auth, db, ref, get, signInWithEmailAndPassword, setActiveAdminSession
} from "./common.js";

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('current-password') || document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const feedbackEl = document.getElementById('login-feedback');

const ALLOWED_REDIRECTS = new Set([
    'admin.html',
    'menu.html',
    'accounts.html',
    'itemprices.html',
    'bottlevalue.html',
    'loginhistory.html',
    'pointshistory.html',
    'transactionhistory.html'
]);

function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get('redirect') || '').trim().toLowerCase();
    return ALLOWED_REDIRECTS.has(requested) ? requested : 'admin.html';
}

function showFeedback(message, isError = true) {
    if (!feedbackEl) {
        if (isError) alert(message);
        return;
    }
    feedbackEl.textContent = message;
    feedbackEl.className = 'form-feedback ' + (isError ? 'error' : 'success');
}

if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordBtn.textContent = isPassword ? 'HIDE' : 'SHOW';
        togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
}

async function handleLogin(event) {
    if (event) event.preventDefault();

    const rawUsername = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!rawUsername || !password) {
        showFeedback("Please enter both username/email and password.", true);
        return;
    }

    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "SIGNING IN...";
    }
    showFeedback("Signing in...", false);

    const lowerIdentifier = rawUsername.toLowerCase();
    const targetPage = getRedirectTarget();

    try {
        // 1. Direct support for the primary admin credentials (admin / password)
        if ((lowerIdentifier === 'admin' || lowerIdentifier === 'admin@supplify.local') && password === 'password') {
            setActiveAdminSession('admin');
            await signInWithEmailAndPassword(auth, 'admin@supplify.local', 'password').catch(() => {});
            showFeedback("Login successful! Redirecting...", false);
            window.location.replace(targetPage);
            return;
        }

        // 2. Check Web Admin accounts in Firebase Realtime Database
        const webAdminsSnap = await get(ref(db, 'webAdmins'));
        const webAdmins = webAdminsSnap.val();

        if (!webAdmins || typeof webAdmins !== 'object') {
            throw new Error("Invalid credentials.");
        }

        const matchedAdminKey = Object.keys(webAdmins).find((k) => {
            const adm = webAdmins[k] || {};
            return (
                String(adm.username || k).toLowerCase() === lowerIdentifier ||
                String(adm.email || '').toLowerCase() === lowerIdentifier
            );
        });

        if (!matchedAdminKey) {
            throw new Error("Admin account not found.");
        }

        const matchedAdmin = webAdmins[matchedAdminKey];
        if (String(matchedAdmin.password ?? '') !== password) {
            throw new Error("Invalid password for web admin account.");
        }

        const sessionUser = matchedAdmin.username || matchedAdmin.email || matchedAdminKey;
        setActiveAdminSession(sessionUser);

        const authEmail = matchedAdmin.email || `${matchedAdminKey}@supplify.local`;
        await signInWithEmailAndPassword(auth, authEmail, password).catch(() => {});

        showFeedback("Login successful! Redirecting...", false);
        window.location.replace(targetPage);
    } catch (error) {
        console.error("Access denied:", error.message || error);
        showFeedback("Access denied. Invalid admin username or password.", true);
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = "SIGN IN";
        }
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
} else if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
}
