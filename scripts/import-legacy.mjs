#!/usr/bin/env node
/**
 * One-time import of the JSON history the old GitHub Actions scrapers committed
 * under ./data into the Worker's D1 database.
 *
 *   node scripts/import-legacy.mjs https://your-worker.example.com <ADMIN_TOKEN>
 *   node scripts/import-legacy.mjs http://localhost:8787 <ADMIN_TOKEN>   # wrangler dev
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [base, token] = process.argv.slice(2);
if (!base || !token) {
    console.error('usage: node scripts/import-legacy.mjs <worker-url> <ADMIN_TOKEN>');
    process.exit(1);
}

async function post(body) {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function importDir(dir, type, toBody) {
    let files = [];
    try { files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort(); } catch { return; }
    for (const file of files) {
        const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
        await post({ type, data, ...toBody(file) });
        process.stdout.write('.');
    }
    console.log(` ${files.length} ${type} files`);
}

// members_YYYYMMDD.json -> YYYY-MM-DD
await importDir('data/clan_stats', 'clan', f => {
    const d = f.match(/(\d{8})/)[1];
    return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` };
});
await importDir('data/war_stats', 'war', () => ({}));
await importDir('data/raid_stats', 'raid', () => ({}));
console.log('Done.');
