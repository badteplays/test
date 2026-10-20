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
const accounts = document.getElementById('accounts');
const loginhistory = document.getElementById('loginhistory');
const itemprices = document.getElementById('itemprices');
const transactionhistory = document.getElementById('transactionhistory');
const pointshistory = document.getElementById('pointshistory');
const bottlevalue = document.getElementById('bottlevalue');
const admin = document.getElementById('admin');

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
if (accounts) {
    accounts.addEventListener('click', () => {
        console.log("Opening Accounts...");
        window.location.href = "accounts.html";
    });
}

if (loginhistory) {
    loginhistory.addEventListener('click', () => {
        console.log("Viewing Login History...");
        window.location.href = "loginhistory.html";
    });
}

if (itemprices) {
    itemprices.addEventListener('click', () => {
        console.log("Viewing Item Prices...");
        window.location.href = "itemprices.html";
    });
}

if (transactionhistory) {
    transactionhistory.addEventListener('click', () => {
        console.log("Viewing Transactions...");
        window.location.href = "transactionhistory.html";
    });
}

if (pointshistory) {
    pointshistory.addEventListener('click', () => {
        console.log("Viewing Transactions...");
        window.location.href = "pointshistory.html";
    });
}

if (bottlevalue) {
    bottlevalue.addEventListener('click', () => {
        console.log("Viewing Transactions...");
        window.location.href = "bottlevalue.html";
    });
}

if (admin) {
    admin.addEventListener('click', () => {
        console.log("Viewing Admin Page...");
        window.location.href = "admin.html";
    });
}