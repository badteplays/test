// Shared Firebase setup + helpers used across the Supplify Stationery Dispenser web app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDD3uJlu_rT4DA4jnjyzixRRYc_69r8SL0",
    authDomain: "stationery-dispenser.firebaseapp.com",
    projectId: "stationery-dispenser",
    storageBucket: "stationery-dispenser.firebasestorage.app",
    messagingSenderId: "57000519693",
    appId: "1:57000519693:web:748481665644e9c5124d44",
    databaseURL: "https://stationery-dispenser-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Largest value a 32-bit signed `long` on the Arduino Mega can hold safely.
export const MAX_POINTS = 2147483647;

// ---------- Validation ----------
export function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/[.#$/[\]\s]/g, '_');
}

export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

// Dispenser keypad only has digits 0-9 (plus A-D, *, #); PINs must be 4 to 10 digits.
export function isValidPin(value) {
    return /^\d{4,10}$/.test(String(value || '').trim());
}

export function normalizeUid(value) {
    return String(value || '').trim().toLowerCase();
}

export function isValidUid(value) {
    return /^[0-9a-z_-]{3,24}$/i.test(String(value || '').trim());
}

// Parses a non-negative whole number in [0, max]. Returns null when invalid or empty.
export function parseWholeNumber(value, max = MAX_POINTS) {
    const str = String(value ?? '').trim();
    if (!/^\d+$/.test(str)) return null;
    const n = Number(str);
    if (!Number.isSafeInteger(n) || n < 0 || n > max) return null;
    return n;
}

// ---------- Dates ----------
// Firebase stores dates as DD/MM/YYYY (or YYYY-MM-DD) and times as HH:mm:ss.
export function parseDateTime(dateStr, timeStr) {
    const d = String(dateStr ?? '').trim();
    if (!d) return 0;
    let day = 1, month = 1, year = 1970;
    if (d.includes('/')) {
        const parts = d.split('/').map(Number);
        if (parts.length === 3) [day, month, year] = parts;
    } else if (d.includes('-')) {
        const parts = d.split('-').map(Number);
        if (parts.length === 3) [year, month, day] = parts;
    }
    const t = String(timeStr ?? '00:00:00').trim().split(':').map(Number);
    const ms = new Date(year, (month || 1) - 1, day || 1, t[0] || 0, t[1] || 0, t[2] || 0).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

// Standardized date display (MM/DD/YYYY) across all pages.
export function formatDateDisplay(dateStr) {
    const d = String(dateStr ?? '').trim();
    if (!d) return 'N/A';
    if (d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) {
            return `${String(parts[1]).padStart(2, '0')}/${String(parts[0]).padStart(2, '0')}/${parts[2]}`;
        }
    } else if (d.includes('-')) {
        const parts = d.split('-');
        if (parts.length === 3) {
            return `${String(parts[1]).padStart(2, '0')}/${String(parts[2]).padStart(2, '0')}/${parts[0]}`;
        }
    }
    return d;
}

export function nowStamp() {
    const now = new Date();
    return {
        date: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
        time: now.toTimeString().slice(0, 8)
    };
}

// ---------- CSV ----------
// Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) and quotes fields.
export function csvCell(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    let s = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
    }
    return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename, headers, rows) {
    const lines = [
        headers.map(csvCell).join(','),
        ...rows.map((row) => row.map(csvCell).join(','))
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Delay revoking object URL so Firefox and Safari finish starting the download.
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- Sync status (consistent across Admin and Accounts pages) ----------
function getLatestEntry(node) {
    if (!node || typeof node !== 'object') return null;
    let latest = null;
    let latestTs = -1;
    Object.values(node).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const ts = parseDateTime(entry.date, entry.time);
        if (ts >= latestTs) {
            latestTs = ts;
            latest = entry;
        }
    });
    return latest;
}

export function getSyncState(commandsData) {
    const lastFail = getLatestEntry(commandsData?.syncfail);
    const lastSuccess = getLatestEntry(commandsData?.syncsuccess);
    const failTime = lastFail ? parseDateTime(lastFail.date, lastFail.time) : 0;
    const successTime = lastSuccess ? parseDateTime(lastSuccess.date, lastSuccess.time) : 0;

    let status = 'gray';
    if (commandsData?.syncStatus === 'sync_fail' || (failTime > successTime && failTime > 0)) {
        status = 'red';
    } else if (commandsData?.syncStatus === 'sync_success' || (successTime >= failTime && successTime > 0)) {
        status = 'green';
    }
    return { status, lastFail, lastSuccess, failTime, successTime };
}

// ---------- Admin Session Guard ----------
const ALLOWED_PAGES = new Set([
    'admin.html',
    'menu.html',
    'accounts.html',
    'itemprices.html',
    'bottlevalue.html',
    'loginhistory.html',
    'pointshistory.html',
    'transactionhistory.html'
]);

export function getActiveAdminSession() {
    return sessionStorage.getItem('supplify_admin_session') || localStorage.getItem('supplify_admin_session') || '';
}

export function setActiveAdminSession(username) {
    sessionStorage.setItem('supplify_admin_session', username);
    localStorage.setItem('supplify_admin_session', username);
}

export function clearActiveAdminSession() {
    sessionStorage.removeItem('supplify_admin_session');
    localStorage.removeItem('supplify_admin_session');
}

export function requireAdminSession() {
    const sessionUser = getActiveAdminSession();
    if (!sessionUser) {
        const currentFile = (window.location.pathname.split('/').pop() || 'admin.html').toLowerCase();
        const target = ALLOWED_PAGES.has(currentFile) ? currentFile : 'admin.html';
        window.location.replace(`login.html?redirect=${encodeURIComponent(target)}`);
        return false;
    }
    return true;
}

export function logoutAdmin() {
    clearActiveAdminSession();
    signOut(auth).then(() => {
        window.location.replace("login.html");
    }).catch(() => {
        window.location.replace("login.html");
    });
}

export {
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    ref,
    get,
    set,
    update,
    push,
    onValue,
    runTransaction
};
