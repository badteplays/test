import { auth, db, ref, get, signInWithEmailAndPassword } from "./common.js";

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('current-password') || document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const feedbackEl = document.getElementById('login-feedback');

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

    try {
        // Authenticate strictly against Web Admin accounts (students/RFID users are blocked from admin login)
        const webAdminsSnap = await get(ref(db, 'webAdmins'));
        const webAdmins = webAdminsSnap.val();

        if (!webAdmins || typeof webAdmins !== 'object') {
            throw new Error("No web admin accounts configured.");
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
        localStorage.setItem('supplify_admin_session', sessionUser);

        // Complete Firebase Auth sign-in before navigating so the request is not aborted
        const authEmail = matchedAdmin.email || `${matchedAdminKey}@supplify.local`;
        await signInWithEmailAndPassword(auth, authEmail, password).catch(() => {});

        showFeedback("Login successful! Redirecting...", false);
        window.location.href = "menu.html";
    } catch (error) {
        console.error("Access denied:", error.message || error);
        showFeedback("Access denied. Only authorized Web Admin accounts can sign in.", true);
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
