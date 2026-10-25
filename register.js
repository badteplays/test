// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDD3uJlu_rT4DA4jnjyzixRRYc_69r8SL0",
    authDomain: "stationery-dispenser.firebaseapp.com",
    projectId: "stationery-dispenser",
    storageBucket: "stationery-dispenser.firebasestorage.app",
    messagingSenderId: "57000519693",
    appId: "1:57000519693:web:748481665644e9c5124d44",
    databaseURL: "https://stationery-dispenser-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const registerForm = document.getElementById('register-form');
const submitBtn = document.getElementById('submit');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('new-password') || document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const feedbackEl = document.getElementById('register-feedback');

function showFeedback(message, isError = true) {
    if (!feedbackEl) {
        alert(message);
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

async function handleRegister(event) {
    if (event) event.preventDefault();

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
        showFeedback("Please enter both an email address and a password.", true);
        return;
    }

    if (password.length < 6) {
        showFeedback("Password must be at least 6 characters long.", true);
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "CREATING ACCOUNT...";
    }
    showFeedback("Creating admin account...", false);

    try {
        const username = email.includes('@') ? email.split('@')[0] : email;
        const key = username.replace(/[.#$/[\]\s]/g, '_').toLowerCase() || ('admin_' + Date.now());
        const now = new Date();
        const createdAt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        // Save in Firebase Realtime Database so it appears in accounts.html and can be edited/deleted
        await set(ref(db, 'webAdmins/' + key), {
            username,
            email,
            password,
            createdAt
        });

        // Also register in Firebase Auth in the background if not already registered
        await createUserWithEmailAndPassword(auth, email, password).catch(() => {});

        showFeedback("Account created! Redirecting to sign in...", false);
        setTimeout(() => {
            window.location.href = "login.html";
        }, 900);
    } catch (error) {
        console.error("Registration error:", error.code, error.message);
        showFeedback(error.message || "Registration failed.", true);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "CREATE ACCOUNT";
        }
    }
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
} else if (submitBtn) {
    submitBtn.addEventListener('click', handleRegister);
}
