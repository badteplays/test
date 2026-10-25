import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// --- 1. CONFIGURATION ---
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

document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('edit');
    const logoutBtn = document.getElementById('logoutBtn');
    const itemsContainer = document.querySelector('.items-container');
    const menuButton = document.getElementById('menu-button');
    const feedbackEl = document.getElementById('save-feedback');

    function showFeedback(msg, isError = false) {
        if (!feedbackEl) return;
        feedbackEl.textContent = msg;
        feedbackEl.className = 'save-feedback ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            if (feedbackEl.textContent === msg) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'save-feedback';
            }
        }, 3500);
    }

    // --- 1.5. INPUT LENGTH CONSTRAINT (MAX 10 DIGITS, WHOLE NUMBERS) ---
    const inputs = document.querySelectorAll('.price-input');
    inputs.forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                e.preventDefault();
                return;
            }
            const isControlKey = e.key === 'Backspace' || e.key === 'Delete' ||
                                 e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                                 e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                                 e.key === 'Tab';
            if (!isControlKey && input.value.length >= 10) {
                e.preventDefault();
            }
        });

        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        });
    });

    // --- 2. LOAD DATA FROM FIREBASE ---
    const pricesRef = ref(db, 'bottlevalue/');

    onValue(pricesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateUI('1000ML', data.ml1000);
            updateUI('500ML', data.ml500);
            updateUI('350ML', data.ml350);
        }
    }, (error) => {
        console.error("Error fetching data:", error);
    });

    function updateUI(itemName, value) {
        document.querySelectorAll('.item-card').forEach((card) => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            if (nameOnPage === itemName) {
                const parsed = parseInt(value, 10) || 0;
                card.querySelector('.price-input').value = parsed;
                updateArrowVisuals(card, parsed);
            }
        });
    }

    if (menuButton) {
        menuButton.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    // --- 3. EDIT / DONE TOGGLE & SAVE ---
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const isEditing = editBtn.textContent === 'EDIT';
            const allInputs = document.querySelectorAll('.price-input');

            if (!isEditing) {
                const ml1000 = findPriceInHTML('1000ML');
                const ml500 = findPriceInHTML('500ML');
                const ml350 = findPriceInHTML('350ML');

                set(ref(db, 'bottlevalue/'), {
                    ml1000: ml1000,
                    ml500: ml500,
                    ml350: ml350,
                }).then(() => {
                    showFeedback("✓ Bottle point values saved to Firebase!", false);
                }).catch((err) => {
                    showFeedback("Failed to save: " + err.message, true);
                });
            }

            allInputs.forEach((input) => {
                input.disabled = !isEditing;
            });

            document.querySelectorAll('.arrow-btn').forEach((arrow) => {
                arrow.classList.toggle('green', isEditing);
            });

            editBtn.textContent = isEditing ? 'DONE' : 'EDIT';
        });
    }

    function findPriceInHTML(itemName) {
        let price = 0;
        document.querySelectorAll('.item-card').forEach((card) => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            if (nameOnPage === itemName.toUpperCase()) {
                price = card.querySelector('.price-input').value;
            }
        });
        return parseInt(price, 10) || 0;
    }

    // --- 4. ARROW CLICK LOGIC ---
    if (itemsContainer) {
        itemsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.arrow-btn');
            if (!button) return;
            if (editBtn && editBtn.textContent === 'EDIT') return;

            const card = button.closest('.item-card');
            const priceInput = card.querySelector('.price-input');
            let currentPrice = parseInt(priceInput.value, 10) || 0;

            const direction = button.getAttribute('data-dir');
            if (direction === 'up') {
                currentPrice++;
            } else if (direction === 'down') {
                if (currentPrice > 0) currentPrice--;
            }

            priceInput.value = currentPrice;
            updateArrowVisuals(card, currentPrice);
        });
    }

    function updateArrowVisuals(card, price) {
        const leftArrow = card.querySelector('.arrow-btn:first-of-type');
        if (!leftArrow) return;
        if (price <= 0) {
            leftArrow.style.opacity = "0.5";
            leftArrow.style.cursor = "not-allowed";
        } else {
            leftArrow.style.opacity = "1";
            leftArrow.style.cursor = "pointer";
        }
    }

    // --- 5. LOGOUT ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('supplify_admin_session');
            signOut(auth).then(() => {
                window.location.replace("login.html");
            }).catch(() => {
                window.location.replace("login.html");
            });
        });
    }
});

// --- 6. SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin logged in as:", user.email);
    }
});
