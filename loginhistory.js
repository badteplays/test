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

// --- 2. INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const tableBody = document.getElementById('table-body');
    const menuButton = document.getElementById('menu-button');

    // Navigation logic
    if (menuButton) {
        menuButton.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    // Logout logic
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.replace("login.html");
            });
        });
    }

    // --- 3. LOAD, MERGE & DE-DUPLICATE ---
    const dbRef = ref(db);

    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        
        if (!data) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No data available.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';

        // Using a Map to handle merging and duplicate prevention
        let logsMap = new Map();

        // Helper to process log groups
        const processLogs = (logGroup, isOffline) => {
            if (!logGroup) return;
            Object.keys(logGroup).forEach(key => {
                const entry = logGroup[key];
                const fingerprint = `${entry.uid}-${entry.date}-${entry.time}`;
                logsMap.set(fingerprint, { ...entry, isOffline });
            });
        };

        // Process both standard and offline logs into the same Map
        processLogs(data.loginHistory, false);
        processLogs(data.offlineLogs, true);

        // Convert Map values to an array for sorting and display
        let combinedLogs = Array.from(logsMap.values());

        if (combinedLogs.length > 0) {
            // --- 4. FIXED SORTING LOGIC (Latest on Top) ---
            combinedLogs.sort((a, b) => {
                const normalizeForSort = (dateStr, timeStr) => {
                    if (!dateStr) return "0000-00-00T00:00:00";
                    const parts = dateStr.split('/');
                    if (parts.length < 3) return "0000-00-00T00:00:00";
                    
                    const day = parts[0].padStart(2, '0');   
                    const month = parts[1].padStart(2, '0'); 
                    const year = parts[2];
                    const time = timeStr || '00:00:00';
                    
                    // Returns standard string format: "YYYY-MM-DDTHH:mm:ss"
                    return `${year}-${month}-${day}T${time}`;
                };

                const isoA = normalizeForSort(a.date, a.time);
                const isoB = normalizeForSort(b.date, b.time);
                
                // Direct chronological string comparison (Z to A order for newest first)
                return isoB.localeCompare(isoA);
            });

            // --- 5. RENDER TABLE ---
            combinedLogs.forEach(entry => {
                const tr = document.createElement('tr');
                const textStyle = entry.isOffline ? 'color: #ff0000; font-weight: bold;' : 'color: inherit;';

                // Date Formatting (DD/MM/YYYY to MM/DD/YYYY for display)
                let dateDisplay = 'N/A';
                if (entry.date) {
                    const dateParts = entry.date.split('/');
                    if (dateParts.length === 3) {
                        dateDisplay = `${dateParts[1].padStart(2, '0')}/${dateParts[0].padStart(2, '0')}/${dateParts[2]}`;
                    }
                }

                const timeDisplay = entry.time ? entry.time : '-';

                tr.innerHTML = `
                    <td style="${textStyle}">${entry.name || 'Unknown'} ${entry.isOffline ? '(Offline)' : ''}</td>
                    <td style="${textStyle}">${entry.uid || 'N/A'}</td>
                    <td style="${textStyle}">${dateDisplay}</td>
                    <td style="${textStyle}">${timeDisplay}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No login history found.</td></tr>';
        }
    });
});

// Auth Guard
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.replace("login.html");
});