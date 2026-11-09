import {
    auth, db, MAX_POINTS,
    onAuthStateChanged, signOut, ref, update, onValue, parseWholeNumber
} from "./common.js";

document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('edit');
    const logoutBtn = document.getElementById('logoutBtn');
    const itemsContainer = document.querySelector('.items-container');
    const menuButton = document.getElementById('menu-button');
    const feedbackEl = document.getElementById('save-feedback');

    let dataLoaded = false;
    if (editBtn) {
        editBtn.disabled = true;
    }

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
        dataLoaded = true;
        if (editBtn) editBtn.disabled = false;

        // Do not clobber unsaved edits while the admin is actively editing
        const currentlyEditing = editBtn && editBtn.textContent === 'DONE';
        if (currentlyEditing) return;

        if (data) {
            updateUI('1000ML', data.ml1000);
            updateUI('500ML', data.ml500);
            updateUI('350ML', data.ml350);
        }
    }, (error) => {
        console.error("Error fetching data:", error);
        showFeedback("Error loading bottle values from Firebase.", true);
    });

    function updateUI(itemName, value) {
        document.querySelectorAll('.item-card').forEach((card) => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            if (nameOnPage === itemName) {
                const parsed = parseInt(value, 10);
                const safeVal = Number.isNaN(parsed) ? 0 : parsed;
                card.querySelector('.price-input').value = safeVal;
                updateArrowVisuals(card, safeVal);
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
            if (!dataLoaded) {
                showFeedback("Please wait for current bottle values to finish loading.", true);
                return;
            }

            const isStartingEdit = editBtn.textContent === 'EDIT';
            const allInputs = document.querySelectorAll('.price-input');

            if (!isStartingEdit) {
                const ml1000 = readValidatedPrice('1000ML');
                const ml500 = readValidatedPrice('500ML');
                const ml350 = readValidatedPrice('350ML');

                if (ml1000 === null || ml500 === null || ml350 === null) {
                    showFeedback(`Please enter a valid whole number (0 to ${MAX_POINTS.toLocaleString()}) for every bottle size.`, true);
                    return;
                }

                update(ref(db, 'bottlevalue'), {
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
                input.disabled = !isStartingEdit;
            });

            document.querySelectorAll('.arrow-btn').forEach((arrow) => {
                arrow.classList.toggle('green', isStartingEdit);
            });

            editBtn.textContent = isStartingEdit ? 'DONE' : 'EDIT';
        });
    }

    function readValidatedPrice(itemName) {
        let rawVal = '';
        document.querySelectorAll('.item-card').forEach((card) => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            if (nameOnPage === itemName.toUpperCase()) {
                rawVal = card.querySelector('.price-input').value;
            }
        });
        return parseWholeNumber(rawVal, MAX_POINTS);
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
                if (currentPrice < MAX_POINTS) currentPrice++;
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
