/**
 * CoC Stats Worker
 * - Serves the static dashboard from ./public (via the ASSETS binding)
 * - Serves JSON from D1 under /api/*
 * - Collects fresh data from the Clash of Clans API on a cron schedule
 */
import { collect } from './collect.js';
import { storeClan, storeWar, storeRaid, getMeta, setMeta } from './store.js';
import * as api from './api.js';

const json = (body, status = 200, maxAge = 60) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` }
});

const isAdmin = (req, env) => env.ADMIN_TOKEN && req.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;

/**
 * Lets a visitor pull fresh data, at most once per REFRESH_MIN_MINUTES across
 * all visitors, so the dashboard is current whenever someone is looking.
 */
async function refresh(env) {
    const minMs = Number(env.REFRESH_MIN_MINUTES || 10) * 60_000;
    const last = await getMeta(env.DB, 'last_refresh_attempt');
    if (last && Date.now() - Date.parse(last) < minMs) {
        return json({ refreshed: false, lastAttempt: last }, 200, 0);
    }
    await setMeta(env.DB, 'last_refresh_attempt', new Date().toISOString());
    const report = await collect(env);
    return json({ refreshed: true, report }, 200, 0);
}

async function adminImport(req, env) {
    const { type, data, date } = await req.json();
    if (type === 'clan') await storeClan(env.DB, data, date);
    else if (type === 'war') await storeWar(env.DB, data, { kind: 'regular', clanTag: env.CLAN_TAG });
    else if (type === 'raid') await storeRaid(env.DB, data);
    else return json({ error: `unknown type ${type}` }, 400, 0);
    return json({ ok: true }, 200, 0);
}

async function handleApi(req, env, url) {
    const db = env.DB;
    const path = url.pathname.replace(/^\/api\/?/, '');

    if (req.method === 'POST') {
        if (path === 'refresh') return refresh(env);
        if (path.startsWith('admin/')) {
            if (!isAdmin(req, env)) return json({ error: 'unauthorized' }, 401, 0);
            if (path === 'admin/collect') return json(await collect(env), 200, 0);
            if (path === 'admin/import') return adminImport(req, env);
        }
        return json({ error: 'not found' }, 404, 0);
    }

    switch (path) {
        case 'clan': return json(await api.getClan(db));
        case 'members': return json(await api.getMembers(db, url.searchParams.get('date')));
        case 'members/dates': return json(await api.getMemberDates(db));
        case 'wars': return json(await api.getWars(db));
        case 'raids': return json(await api.getRaids(db));
        case 'cwl': return json(await api.getCwl(db));
        case 'history': return json(await api.getHistory(db));
        case 'status': return json(await api.getStatus(db), 200, 0);
    }
    if (path.startsWith('players/')) {
        return json(await api.getPlayer(db, decodeURIComponent(path.slice('players/'.length))));
    }
    return json({ error: 'not found' }, 404, 0);
}

export default {
    async fetch(req, env) {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/')) {
            try { return await handleApi(req, env, url); }
            catch (e) { console.error(e); return json({ error: e.message }, 500, 0); }
        }
        return env.ASSETS.fetch(req);
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(collect(env).then(r => console.log('collect', JSON.stringify(r.steps))));
    }
};
