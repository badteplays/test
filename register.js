import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { auth, db, ref, get, set, normalizeUsername, isValidEmail, nowStamp } from "./common.js";

const registerForm = document.getElementById('register-form');
const submitBtn = document.getElementById('submit') || document.getElementById('login');
const usernameInput = document.getElementById('username');
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

    const rawUsername = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!rawUsername || !email || !password) {
        showFeedback("Please enter a username, email address, and password.", true);
        return;
    }

    if (!isValidEmail(email)) {
        showFeedback("Please enter a valid email address.", true);
        return;
    }

    if (password.length < 6) {
        showFeedback("Password must be at least 6 characters long.", true);
        return;
    }

    const key = normalizeUsername(rawUsername);
    if (!key) {
        showFeedback("Username must contain letters or numbers.", true);
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "CREATING ACCOUNT...";
    }
    showFeedback("Checking existing accounts...", false);

    try {
        // Prevent overwriting an existing admin with the same username or email
        const snap = await get(ref(db, 'webAdmins'));
        const existingAdmins = snap.val() || {};

        const lowerUser = rawUsername.toLowerCase();
        const lowerEmail = email.toLowerCase();
        const duplicate = Object.keys(existingAdmins).find((k) => {
            const adm = existingAdmins[k] || {};
            return (
                k.toLowerCase() === key ||
                String(adm.username || '').toLowerCase() === lowerUser ||
                String(adm.email || '').toLowerCase() === lowerEmail
            );
        });

        if (duplicate) {
            showFeedback("An admin account with that username or email already exists.", true);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "CREATE ACCOUNT";
            }
            return;
        }

        const { date: createdAt } = nowStamp();
        await set(ref(db, 'webAdmins/' + key), {
            username: rawUsername,
            email,
            password,
            createdAt
        });

        // Best-effort Firebase Auth registration
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
