import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// Your Firebase configuration
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
const auth = getAuth();

// --- 1. ROUTE GUARD & SESSION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Welcome, Admin:", user.email);
    }
});

// --- 2. ELEMENT REFERENCES ---
const logoutBtn = document.getElementById('logoutBtn');
const menuButton = document.getElementById('menu-button');

// --- 3. CLICK EVENTS ---

// Logout Functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
            // .replace() prevents using the 'Back' button to return to this menu
            window.location.replace("login.html");
        }).catch((error) => {
            console.error("Logout Error:", error);
        });
    });
}

// Menu Buttons
if (menuButton) {
    menuButton.addEventListener('click', function () {
        // 3. Change the window location to your menu page
        window.location.href = 'menu.html';
    });
}