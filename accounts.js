import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
 // --- ELEMENT SELECTORS ---
 const editBtn = document.getElementById('edit');
 const logoutBtn = document.getElementById('logoutBtn');
 const itemsContainer = document.querySelector('.items-container');
 const tableBody = document.getElementById('table-body');
 const menuButton = document.getElementById('menu-button');

 if (menuButton) {
 menuButton.addEventListener('click', function () {
 window.location.href = 'menu.html';
 });
 }

 if (logoutBtn) {
 logoutBtn.addEventListener('click', () => {
 signOut(auth).then(() => {
 window.location.replace("login.html");
 });
 });
 }

 // --- 2. LOAD INVENTORY DATA ---
 const inventoryRef = ref(db, 'inventory/');
 onValue(inventoryRef, (snapshot) => {
 const data = snapshot.val();
 if (data) {
 updateUI('PEN', data.pen);
 updateUI('MARKER', data.marker);
 updateUI('YELLOW PAPER', data.yellowpaper);
 }
 });

 // --- 3. LOAD ACCOUNTS DATA (REAL-TIME TABLE - ONLY UID & POINTS) ---
 const accountsRef = ref(db, 'accounts/');
 onValue(accountsRef, (snapshot) => {
 if (!tableBody) return;
 const data = snapshot.val();
 tableBody.innerHTML = '';

 if (data) {
 const uids = Object.keys(data);

 // Loop through the UIDs and display UID and Points
 uids.forEach(uid => {
 const user = data[uid];
 const tr = document.createElement('tr');
 tr.innerHTML = `
 <td>${uid}</td>
 <td><strong>${user.points || 0}</strong></td>
 `;
 tableBody.appendChild(tr);
 });
 } else {
 tableBody.innerHTML = '<tr><td colspan="2">No accounts found.</td></tr>';
 }
 });

 // --- 4. INVENTORY EDITING LOGIC ---
 if (editBtn) {
 editBtn.addEventListener('click', () => {
 const isEditing = editBtn.textContent === 'EDIT';

 if (!isEditing) {
 const penPrice = parseInt(findPriceInHTML('PEN'));
 const markerPrice = parseInt(findPriceInHTML('MARKER'));
 const paperPrice = parseInt(findPriceInHTML('YELLOW PAPER'));

 set(ref(db, 'inventory/'), {
 pen: penPrice,
 marker: markerPrice,
 yellowpaper: paperPrice
 }).then(() => console.log("Inventory Saved!"));
 }

 editBtn.textContent = isEditing ? 'DONE' : 'EDIT';
 document.querySelectorAll('.arrow-btn').forEach(arrow => arrow.classList.toggle('green', isEditing));
 });
 }

 function updateUI(itemName, value) {
 document.querySelectorAll('.item-card').forEach(card => {
 const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
 if (nameOnPage === itemName) {
 card.querySelector('.price-value').textContent = value;
 updateArrowVisuals(card, value);
 }
 });
 }

 function findPriceInHTML(itemName) {
 let price = 10;
 document.querySelectorAll('.item-card').forEach(card => {
 const nameOnPage = card.querySelector('.item-name').innerText.trim().toUpperCase().replace(/\n/g, ' ');
 if (nameOnPage === itemName) price = card.querySelector('.price-value').textContent;
 });
 return price;
 }

 if (itemsContainer) {
 itemsContainer.addEventListener('click', (e) => {
 const button = e.target;
 if (!button.classList.contains('arrow-btn') || (editBtn && editBtn.textContent === 'EDIT')) return;

 const card = button.closest('.item-card');
 const priceDisplay = card.querySelector('.price-value');
 let currentPrice = parseInt(priceDisplay.textContent);

 if (button.textContent === '▶' && currentPrice < 100) currentPrice++;
 else if (button.textContent === '◀' && currentPrice > 1) currentPrice--;

 priceDisplay.textContent = currentPrice;
 updateArrowVisuals(card, currentPrice);
 });
 }

 function updateArrowVisuals(card, price) {
 const leftArrow = card.querySelector('.arrow-btn:first-of-type');
 if (leftArrow) {
 leftArrow.style.opacity = price <= 1 ? "0.5" : "1";
 leftArrow.style.cursor = price <= 1 ? "not-allowed" : "pointer";
 }
 }

});

// --- 5. SYNC TRIGGER ACTION ---
const syncBtn = document.getElementById('syncBtn');

if (syncBtn) {
 syncBtn.addEventListener('click', () => {
 const syncRef = ref(db, 'commands/syncTrigger');

 // Set to gray immediately when button is pressed to indicate "processing"
 if (document.getElementById('syncStatus')) {
 document.getElementById('syncStatus').className = 'status-circle gray';
 }

 set(syncRef, 1).then(() => {
 console.log("Sync trigger sent.");
 setTimeout(() => {
 set(syncRef, 0)
 .then(() => console.log("Sync trigger reset to 0"))
 .catch((err) => console.error("Reset failed:", err));
 }, 2000);
 }).catch((error) => {
 console.error("Sync Error:", error);
 });
 });
}

// --- 6. SYNC STATUS CIRCLE LISTENER ---
const statusCircle = document.getElementById('syncStatus');
const statusRef = ref(db, 'commands/syncStatus');

if (statusCircle) {
 onValue(statusRef, (snapshot) => {
 const status = snapshot.val();
 statusCircle.classList.remove('gray', 'green', 'red');

 if (status === "sync_success") {
 statusCircle.classList.add('green');
 } else if (status === "sync_fail") {
 statusCircle.classList.add('red');
 } else {
 statusCircle.classList.add('gray');
 }
 });
}

// --- 7. SYNC STATUS DISPLAY BOX LISTENER ---
const syncDisplayBox = document.getElementById('sync-display-box');
const commandsRef = ref(db, 'commands/');

onValue(commandsRef, (snapshot) => {
 const data = snapshot.val();
 if (!data || !syncDisplayBox) return;

 const getLatestFromNode = (nodeData) => {
 if (!nodeData) return null;
 const keys = Object.keys(nodeData);
 const lastKey = keys[keys.length - 1]; 
 return nodeData[lastKey];
 };

 const lastFail = getLatestFromNode(data.syncfail);
 const lastSuccess = getLatestFromNode(data.syncsuccess);

 const failStamp = lastFail ? new Date(`${lastFail.date} ${lastFail.time}`).getTime() : 0;
 const successStamp = lastSuccess ? new Date(`${lastSuccess.date} ${lastSuccess.time}`).getTime() : 0;

 if (failStamp > successStamp) {
 syncDisplayBox.style.color = "#ff4d4d"; 
 syncDisplayBox.innerHTML = `
 <strong>FAILED:</strong> ${lastFail.reason}<br>
 USER: ${lastFail.firstName || 'Unknown'} (${lastFail.uid})<br>
 ${lastFail.date} | ${lastFail.time}
 `;
 } else if (lastSuccess) {
 syncDisplayBox.style.color = "#00ff88"; 
 syncDisplayBox.innerHTML = `
 <strong>${lastSuccess.status}</strong><br>
 DATE: ${lastSuccess.date}<br>
 TIME: ${lastSuccess.time}
 `;
 }
});

// --- 8. ROUTE GUARD ---
onAuthStateChanged(auth, (user) => {
 if (!user) {
 window.location.replace("login.html");
 } else {
 console.log("Admin Session Active");
 }
});