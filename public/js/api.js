/**
 * API Service Module
 * Thin wrappers over the Worker's /api endpoints (backed by D1).
 */

export async function fetchData(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return await res.json();
}

export const fetchClanData = () => fetchData('api/clan');
export const fetchMemberDates = () => fetchData('api/members/dates');
export const fetchMembersOn = (date) => fetchData(`api/members?date=${encodeURIComponent(date)}`);
export const fetchWars = () => fetchData('api/wars');
export const fetchRaids = () => fetchData('api/raids');
export const fetchCwl = () => fetchData('api/cwl');
export const fetchHistory = () => fetchData('api/history');
export const fetchPlayer = (tag) => fetchData(`api/players/${encodeURIComponent(tag)}`);
export const fetchStatus = () => fetchData('api/status');

/**
 * Asks the Worker to pull fresh data from Clash of Clans. The Worker
 * rate-limits this across all visitors, so it is safe to call on every load.
 * Resolves to true when new data was collected.
 */
export async function requestRefresh() {
    try {
        const res = await fetch('api/refresh', { method: 'POST' });
        if (!res.ok) return false;
        return (await res.json()).refreshed === true;
    } catch {
        return false;
    }
}
