/**
 * Clash of Clans API client + small helpers for the API's data formats.
 */

export class CocApi {
    constructor(env) {
        if (!env.COC_API_TOKEN) {
            // Name-only hint for near-miss names (wrong case, stray spaces); values are never exposed.
            const similar = Object.keys(env).filter(k => /token|coc|api/i.test(k) && !['COC_API_BASE'].includes(k));
            throw new Error(`COC_API_TOKEN secret is not set` +
                (similar.length ? ` (the Worker does see: ${similar.map(k => JSON.stringify(k)).join(', ')})` : ' (no similarly named variable found)'));
        }
        this.base = env.COC_API_BASE || 'https://cocproxy.royaleapi.dev/v1';
        this.token = env.COC_API_TOKEN;
    }

    /**
     * GET a path; returns parsed JSON, or null for "not found" statuses
     * (404 by default; the CWL group endpoint also answers 500 outside league week).
     */
    async get(path, { nullOn = [404] } = {}) {
        const res = await fetch(`${this.base}${path}`, {
            headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }
        });
        if (nullOn.includes(res.status)) return null;
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`CoC API ${res.status} for ${path}: ${body.slice(0, 200)}`);
        }
        return res.json();
    }
}

export const encodeTag = (tag) => encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);

/** "20260415T020302.000Z" -> Date */
export function parseCocDate(s) {
    if (!s) return null;
    return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15)));
}

/** Date -> "YYYY-MM-DD" (UTC) */
export const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** Puts `clanTag` on the `clan` side of a war (CWL wars can list us as opponent). */
export function normalizeWar(war, clanTag) {
    if (war?.opponent?.tag === clanTag) {
        return { ...war, clan: war.opponent, opponent: war.clan };
    }
    return war;
}

/** 'victory' | 'loss' | 'draw' from the clan's perspective. */
export function warResult(war) {
    const cs = war.clan?.stars || 0, os = war.opponent?.stars || 0;
    if (cs !== os) return cs > os ? 'victory' : 'loss';
    const cd = war.clan?.destructionPercentage || 0, od = war.opponent?.destructionPercentage || 0;
    if (cd !== od) return cd > od ? 'victory' : 'loss';
    return 'draw';
}
