// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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

const registerForm = document.getElementById('register-form');
const registerBtn = document.getElementById('login');
const usernameInput = document.getElementById('username');
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

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        showFeedback("Please enter a valid email and password.", true);
        return;
    }

    if (password.length < 6) {
        showFeedback("Password must be at least 6 characters.", true);
        return;
    }

    if (registerBtn) {
        registerBtn.disabled = true;
        registerBtn.textContent = "REGISTERING...";
    }

    try {
        await createUserWithEmailAndPassword(auth, username, password);
        localStorage.setItem('supplify_admin_session', username);
        showFeedback("Admin account created! Redirecting to menu...", false);
        setTimeout(() => {
            window.location.href = "menu.html";
        }, 900);
    } catch (error) {
        console.error("Registration error:", error.code, error.message);
        showFeedback(`Registration failed: ${error.message}`, true);
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.textContent = "REGISTER";
        }
    }
}

if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
} else if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister);
}
