/**
 * API Service Module
 * Thin wrappers over the Worker's /api endpoints (backed by D1).
 */

export async function fetchData(path) {
    // no-cache: always revalidate so the reload buttons show the newest collected data.
    const res = await fetch(path, { cache: 'no-cache' });
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
