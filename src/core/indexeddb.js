/**
 * indexeddb.js - High-capacity browser-native storage wrapper for Plot data.
 * Stores backstage histories, variable values, goals, and storylines under a unified store.
 */

const DB_NAME = 'PlotExtensionDB';
const DB_VERSION = 2;
const STORE_NAME = 'plotData';

let dbInstance = null;

function getDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (db.objectStoreNames.contains('backstageHistory')) {
                db.deleteObjectStore('backstageHistory');
            }
        };
        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        request.onerror = (e) => {
            reject(e.target.error);
        };
    });
}

/**
 * Retrieve a value from the database.
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getPlotValue(key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`[Plot DB] Failed to get value for key "${key}":`, err);
        return null;
    }
}

/**
 * Save a value to the database.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function savePlotValue(key, value) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`[Plot DB] Failed to save value for key "${key}":`, err);
    }
}

/**
 * Delete a value from the database.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deletePlotValue(key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error(`[Plot DB] Failed to delete value for key "${key}":`, err);
    }
}

/**
 * Clear all data stored in the Plot IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearAllPlotDB() {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('[Plot DB] Failed to clear database:', err);
    }
}
