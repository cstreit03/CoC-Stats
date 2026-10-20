/**
 * CoC Stats Worker
 * - Serves the static dashboard from ./public (via the ASSETS binding)
 * - Serves JSON from D1 under /api/*
 * - Collects fresh data from the Clash of Clans API on the hourly cron
 */
import { collect } from './collect.js';
import { ensureSchema } from './schema.js';
import { getMeta, setMeta } from './store.js';
import * as api from './api.js';

const json = (body, status = 200, maxAge = 60) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` }
});

async function handleApi(req, env, url) {
    const db = env.DB;
    const path = url.pathname.replace(/^\/api\/?/, '');

    if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405, 0);

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

/**
 * Until the first successful collection (new deployment, or a token that was
 * just added), requests retry a collection at most every 5 minutes so data
 * shows up without waiting for the top of the hour. After that only the cron collects.
 */
async function bootstrap(env, ctx) {
    if (await getMeta(env.DB, 'last_success')) return;
    const last = await getMeta(env.DB, 'last_collect');
    if (last && Date.now() - Date.parse(last.startedAt) < 5 * 60_000) return;
    await setMeta(env.DB, 'last_collect', { startedAt: new Date().toISOString(), steps: {}, bootstrap: true });
    ctx.waitUntil(collect(env));
}

export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/api/')) {
            try {
                await ensureSchema(env.DB);
                await bootstrap(env, ctx);
                return await handleApi(req, env, url);
            }
            catch (e) { console.error(e); return json({ error: e.message }, 500, 0); }
        }
        return env.ASSETS.fetch(req);
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(ensureSchema(env.DB)
            .then(() => collect(env))
            .then(r => console.log('collect', JSON.stringify(r.steps))));
    }
};
