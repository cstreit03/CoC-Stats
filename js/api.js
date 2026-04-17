/**
 * API Service Module
 * Handles all data fetching with cache-busting and index-aware fallback logic.
 */

/**
 * Fetches the latest available clan data by scanning the index.
 * It will try each file in the index (newest first) until one loads successfully.
 */
export async function fetchClanData() {
    // We add a timestamp query param to prevent browser caching of the index file
    const indexRes = await fetch(`data/clan_stats_index.json?t=${Date.now()}`);
    if (!indexRes.ok) throw new Error("Failed to fetch clan index");
    const index = await indexRes.json();
    if (!index || index.length === 0) throw new Error("Clan index is empty");
    
    // Iterate through the index and try to load the latest file
    for (const filename of index) {
        try {
            const res = await fetch(`data/clan_stats/${filename}?t=${Date.now()}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.warn(`Could not load indexed file: ${filename}, trying next...`);
        }
    }
    
    throw new Error("No available clan data files found in index.");
}

/**
 * Fetches the raw list of daily member snapshots.
 */
export async function fetchMembersIndex() {
    const res = await fetch(`data/clan_stats_index.json?t=${Date.now()}`);
    if (!res.ok) return [];
    return await res.json();
}

/**
 * Fetches a specific historical snapshot.
 */
export async function fetchHistoricalMembers(filename) {
    const res = await fetch(`data/clan_stats/${filename}?t=${Date.now()}`);
    if (!res.ok) throw new Error("Failed to fetch historical member data");
    return await res.json();
}

/**
 * Fetches the list of war history files.
 */
export async function fetchWarIndex() {
    const res = await fetch(`data/war_stats_index.json?t=${Date.now()}`);
    if (!res.ok) return [];
    return await res.json();
}

/**
 * Fetches data for a specific war.
 */
export async function fetchWarData(filename) {
    const res = await fetch(`data/war_stats/${filename}?t=${Date.now()}`);
    if (!res.ok) throw new Error("Failed to fetch war data");
    return await res.json();
}
