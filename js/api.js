/**
 * API Service Module
 * Handles all data fetching with cache-busting and index-aware fallback logic.
 */

/**
 * Generic fetcher with cache-busting
 */
export async function fetchData(path) {
    const res = await fetch(`${path}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return await res.json();
}

/**
 * Fetches the latest available clan data by scanning the index.
 */
export async function fetchClanData() {
    const index = await fetchData('data/clan_stats_index.json');
    if (!index || index.length === 0) throw new Error("Clan index is empty");
    
    for (const filename of index) {
        try {
            return await fetchData(`data/clan_stats/${filename}`);
        } catch (e) {
            console.warn(`Could not load indexed file: ${filename}, trying next...`);
        }
    }
    throw new Error("No available clan data files found in index.");
}

export async function fetchMembersIndex() {
    return await fetchData('data/clan_stats_index.json');
}

export async function fetchHistoricalMembers(filename) {
    return await fetchData(`data/clan_stats/${filename}`);
}

export async function fetchWarIndex() {
    return await fetchData('data/war_stats_index.json');
}

export async function fetchWarData(filename) {
    return await fetchData(`data/war_stats/${filename}`);
}

/**
 * Global Sync Trigger
 * Notifies the scrapers to update data (via Github Actions typically, but here simulated)
 */
export async function syncData() {
    // In this environment, we just wait a bit and re-fetch the index
    return new Promise(resolve => setTimeout(resolve, 1000));
}
