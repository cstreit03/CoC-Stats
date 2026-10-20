/**
 * Loads everything the dashboard shows from the Worker's /api (data collected hourly).
 */

async function getJSON(path) {
    // no-cache: revalidate so the reload button shows the newest collected data.
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
}

export const store = {
    clan: null,
    wars: [],          // tracked wars (regular + CWL), newest first
    raids: [],         // newest first
    cwl: [],           // seasons, newest first
    history: null,     // { clanDaily, events, joinedAt, warlog, trackingSince }
    status: null,
    memberDates: [],
    loaded: false
};

export async function loadAll() {
    const keys = ['clan', 'wars', 'raids', 'cwl', 'history', 'status', 'memberDates'];
    const paths = ['api/clan', 'api/wars', 'api/raids', 'api/cwl', 'api/history', 'api/status', 'api/members/dates'];
    const results = await Promise.allSettled(paths.map(getJSON));
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') store[keys[i]] = r.value;
        else console.error(`Could not load ${paths[i]}`, r.reason);
    });
    store.wars = [...(store.wars || [])].reverse();
    store.raids = store.raids || [];
    store.cwl = store.cwl || [];
    store.loaded = true;
    return store;
}

export const fetchMembersOn = (date) => getJSON(`api/members?date=${encodeURIComponent(date)}`);
export const fetchPlayer = (tag) => getJSON(`api/players/${encodeURIComponent(tag)}`);

/** First error of the last collection run when it failed to fetch the clan. */
export function collectError() {
    const r = store.status?.lastCollect;
    if (!r) return null;
    if (r.error) return r.error;
    const clan = r.steps?.clan;
    return typeof clan === 'string' && clan.startsWith('error') ? clan.replace(/^error: /, '') : null;
}

export const members = () => store.clan?.memberList || [];
export const ourTag = () => store.clan?.tag;
