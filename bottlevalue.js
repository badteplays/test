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
const auth = getAuth();
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('edit');
    const logoutBtn = document.getElementById('logoutBtn');
    const itemsContainer = document.querySelector('.items-container');

    // --- 2. LOAD DATA FROM FIREBASE (The "Pull") ---
    const pricesRef = ref(db, 'bottlevalue/');

    onValue(pricesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log("Data received from Firebase:", data);
            updateUI('1000ML', data.ml1000);
            updateUI('500ML', data.ml500);
            updateUI('350ML', data.ml350);
        }
    }, (error) => {
        console.error("Error fetching data:", error);
    });

    // Updates the number on the screen (as a whole number)
    function updateUI(itemName, value) {
        document.querySelectorAll('.item-card').forEach(card => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            if (nameOnPage === itemName) {
                // CHANGED: Used parseInt to force a whole number
                card.querySelector('.price-input').value = parseInt(value, 10) || 0;
            }
        });
    }

    const menuButton = document.getElementById('menu-button');
    menuButton.addEventListener('click', function () {
        window.location.href = 'menu.html';
    });

    // --- 3. EDIT / DONE TOGGLE & SAVE ---
    editBtn.addEventListener('click', () => {
        const isEditing = editBtn.textContent === 'EDIT';
        const inputs = document.querySelectorAll('.price-input');

        if (!isEditing) {
            // Saving data
            // CHANGED: Reading values as strict integers
            const ml1000 = parseInt(findPriceInHTML('1000ml'), 10);
            const ml500 = parseInt(findPriceInHTML('500ml'), 10);
            const ml350 = parseInt(findPriceInHTML('350ml'), 10);

            set(ref(db, 'bottlevalue/'), {
                ml1000: ml1000,
                ml500: ml500,
                ml350: ml350,
            }).then(() => {
                console.log("Success: Prices synced!");
            });
        }

        // Toggle input disabled state
        inputs.forEach(input => {
            input.disabled = !isEditing; 
        });

        editBtn.textContent = isEditing ? 'DONE' : 'EDIT';
    });

    // Helper to scrape the current number from the HTML elements
    function findPriceInHTML(itemName) {
        let price = 0; 
        document.querySelectorAll('.item-card').forEach(card => {
            const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
            
            if (nameOnPage === itemName.toUpperCase()) { 
                price = card.querySelector('.price-input').value;
            }
        });
        // CHANGED: Parsing returning value as Integer
        return parseInt(price, 10) || 0;
    }

    // --- 4. ARROW CLICK LOGIC ---
    itemsContainer.addEventListener('click', (e) => {
        const button = e.target;
        if (!button.classList.contains('arrow-btn')) return;

        // Block clicks if user hasn't clicked "EDIT"
        if (editBtn.textContent === 'EDIT') return;

        const card = button.closest('.item-card');
        
        // CHANGED: Target '.price-input' instead of '.price-value' so it updates the correct field
        const priceInput = card.querySelector('.price-input');
        let currentPrice = parseInt(priceInput.value, 10) || 0;

        const direction = button.getAttribute('data-dir'); 

        if (direction === 'up') {
            currentPrice++;
        } else if (direction === 'down') {
            if (currentPrice > 0) currentPrice--;
        }

        // CHANGED: Writing directly back to the input field `.value`
        priceInput.value = currentPrice;
        updateArrowVisuals(card, currentPrice);
    });

    // Handles the grayed-out look for the left arrow at minimum value
    function updateArrowVisuals(card, price) {
        const leftArrow = card.querySelector('.arrow-btn:first-of-type');
        if (!leftArrow) return;
        if (price <= 1) {
            leftArrow.style.opacity = "0.5";
            leftArrow.style.cursor = "not-allowed";
        } else {
            leftArrow.style.opacity = "1";
            leftArrow.style.cursor = "pointer";
        }
    }

    // --- 5. LOGOUT ---
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.replace("login.html");
        });
    });
});

// --- 6. ROUTE GUARD ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("login.html");
    } else {
        console.log("Admin logged in as:", user.email);
    }
});