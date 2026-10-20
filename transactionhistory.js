import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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
    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');

    // --- NAVIGATION ---
    if (menuButton) {
        menuButton.addEventListener('click', () => {
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

    // --- 2. LOAD TRANSACTION HISTORY (MERGED REAL-TIME) ---
    const historyRef = ref(db, 'transactions/');
    const offTransRef = ref(db, 'offTrans/');

    let normalData = {};
    let offlineData = {};

    // Unified function to merge datasets and refresh the UI
    const updateTable = () => {
        tableBody.innerHTML = ''; 
        let transactionMap = new Map();

        // 1. Process Online/Normal Transactions
        if (normalData) {
            Object.keys(normalData).forEach(key => {
                const entry = normalData[key];
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                transactionMap.set(fingerprint, { id: key, ...entry, isOffline: false });
            });
        }

        // 2. Process Offline Transactions (with Red Styling)
        if (offlineData) {
            Object.keys(offlineData).forEach(key => {
                const entry = offlineData[key];
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                
                // If it doesn't already exist in the normal list, add it
                if (!transactionMap.has(fingerprint)) {
                    transactionMap.set(fingerprint, { id: key, ...entry, isOffline: true });
                }
            });
        }

        const historyEntries = Array.from(transactionMap.values());

        // Sort by Date and Time (Latest First)
        historyEntries.sort((a, b) => {
            return parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time);
        });

        if (historyEntries.length > 0) {
            historyEntries.forEach(entry => {
                const tr = document.createElement('tr');
                
                // Styling logic
                const isOffline = entry.isOffline === true;
                // If offline, apply red color to the text
                const rowStyle = isOffline ? 'style="color: #ff0000; font-style: italic;"' : '';
                
                const pointsValue = entry.pointsDeducted || 0;
                const pointsStyle = pointsValue > 0 ? 'style="color: #dd0000; font-weight: bold;"' : '';
                const displayPrefix = pointsValue > 0 ? '-' : '';

                tr.innerHTML = `
                    <td ${rowStyle}>${entry.name || 'Unknown'} ${isOffline ? '(Offline)' : ''}</td>
                    <td ${rowStyle}>${entry.uid || 'N/A'}</td>
                    <td ${rowStyle}>${entry.date || '-'}</td>
                    <td ${rowStyle}>${entry.time || '-'}</td>
                    <td ${rowStyle}>${entry.item || '-'}</td>
                    <td ${pointsStyle}>${displayPrefix}${pointsValue}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No transaction history found.</td></tr>';
        }
    };

    // Listeners for both paths
    onValue(historyRef, (snapshot) => {
        normalData = snapshot.val();
        updateTable();
    });

    onValue(offTransRef, (snapshot) => {
        offlineData = snapshot.val();
        updateTable();
    });

    // --- HELPER: Parse strings for sorting ---
    function parseDateTime(dateStr, timeStr) {
        if (!dateStr || !timeStr) return 0;
        const [day, month, year] = dateStr.split('/').map(Number);
        const timeParts = timeStr.split(':').map(Number);
        const hours = timeParts[0] || 0;
        const minutes = timeParts[1] || 0;
        const seconds = timeParts[2] || 0;
        return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
    }
});

// --- 3. ROUTE GUARD ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("login.html");
    } else {
        console.log("Admin Session Active");
    }
});