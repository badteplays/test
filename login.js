// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDD3uJlu_rT4DA4jnjyzixRRYc_69r8SL0",
    authDomain: "stationery-dispenser.firebaseapp.com",
    projectId: "stationery-dispenser",
    storageBucket: "stationery-dispenser.firebasestorage.app",
    messagingSenderId: "57000519693",
    appId: "1:57000519693:web:748481665644e9c5124d44"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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

    // Support direct "admin" / "password" credentials as well as full email addresses
    const isAdminShortcut = rawUsername.toLowerCase() === 'admin' && password === 'password';
    const emailToUse = rawUsername.includes('@')
        ? rawUsername
        : (rawUsername.toLowerCase() === 'admin' ? 'admin@supplify.local' : `${rawUsername}@supplify.local`);

    try {
        await signInWithEmailAndPassword(auth, emailToUse, password);
        localStorage.setItem('supplify_admin_session', 'admin');
        showFeedback("Login successful! Redirecting...", false);
        window.location.href = "menu.html";
    } catch (error) {
        if (isAdminShortcut) {
            // Fallback session in case Firebase Auth is offline or blocked
            localStorage.setItem('supplify_admin_session', 'admin');
            showFeedback("Admin login successful! Redirecting...", false);
            window.location.href = "menu.html";
            return;
        }
        console.error("Access denied:", error.code, error.message);
        showFeedback("Access denied. Wrong username/email or password.", true);
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
