import { auth, onAuthStateChanged, requireAdminSession, logoutAdmin } from "./common.js";

// --- 1. REQUIRE LOGIN BEFORE ACCESSING MENU ---
requireAdminSession();

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
if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutAdmin);
}

if (accounts) {
    accounts.addEventListener('click', () => {
        window.location.href = "accounts.html";
    });
}

if (loginhistory) {
    loginhistory.addEventListener('click', () => {
        window.location.href = "loginhistory.html";
    });
}

if (itemprices) {
    itemprices.addEventListener('click', () => {
        window.location.href = "itemprices.html";
    });
}

if (transactionhistory) {
    transactionhistory.addEventListener('click', () => {
        window.location.href = "transactionhistory.html";
    });
}

if (pointshistory) {
    pointshistory.addEventListener('click', () => {
        window.location.href = "pointshistory.html";
    });
}

if (bottlevalue) {
    bottlevalue.addEventListener('click', () => {
        window.location.href = "bottlevalue.html";
    });
}

if (admin) {
    admin.addEventListener('click', () => {
        window.location.href = "admin.html";
    });
}
