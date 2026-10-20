/**
 * Player profile: tenure, war record, raids, donations over time and every attack.
 */
import { store, members, fetchPlayer } from '../store.js';
import { esc, num, pct, thImg, roleNames, fmtDate, fmtDay, parseCoc, starsHtml, icons } from '../util.js';
import { kpi, mountTable, exportButtons, tableData } from '../ui.js';
import { memberWarStats } from '../stats.js';
import { chart, lineConfig, cssVar } from '../charts.js';
import { exportExcel, exportPdf, bindExports } from '../export.js';

export function render(root, { tag }) {
    const current = members().find(m => m.tag === tag);
    root.innerHTML = `<a class="back-link" href="#/members">${icons.back}Members</a><p class="empty">Loading player…</p>`;
    let cancelled = false;

    fetchPlayer(tag).then(({ daily }) => {
        if (cancelled) return;
        const last = daily[daily.length - 1];
        const name = current?.name || last?.name || tag;
        const th = current?.townHallLevel || last?.town_hall;
        const role = current?.role || last?.role;
        const joined = store.history?.joinedAt?.[tag];
        const stats = memberWarStats(store.wars).find(s => s.tag === tag);

        // Every attack this member made, newest first.
        const attacks = [];
        for (const w of store.wars) {
            const m = w.clan.members?.find(x => x.tag === tag);
            if (!m) continue;
            const opp = new Map((w.opponent.members || []).map(o => [o.tag, o]));
            for (const a of m.attacks || []) {
                const d = opp.get(a.defenderTag);
                attacks.push({ war: w, date: parseCoc(w.startTime), opponent: w.opponent.name, kind: w.kind, defPos: d?.mapPosition, defTh: d?.townhallLevel, myTh: m.townhallLevel, stars: a.stars, dest: a.destructionPercentage, order: a.order });
            }
        }
        attacks.sort((a, b) => b.date - a.date || b.order - a.order);

        const raids = store.raids.map(r => ({ raid: r, m: (r.members || []).find(x => x.tag === tag) })).filter(x => x.m);
        const raidGold = raids.reduce((s, x) => s + (x.m.capitalResourcesLooted || 0), 0);

        const tenure = current
            ? (joined ? (joined.beforeTracking ? `In the clan since before ${fmtDate(joined.date)}` : `Joined ${fmtDate(joined.date)}`) : '')
            : (last ? `Left the clan · last seen ${fmtDate(last.date)}` : 'Not in any recorded roster');

        root.innerHTML = `
            <a class="back-link" href="#/members">${icons.back}Members</a>
            <div class="page-head">
                <div class="row" style="gap:14px">
                    <img src="${thImg(th)}" alt="Town Hall ${th}" style="width:56px;height:56px">
                    <div><h1 class="page-title">${esc(name)}</h1>
                    <p class="page-sub">${esc(tag)} · TH${th ?? '?'} · ${roleNames[role] || 'Former member'}${current ? ` · XP ${current.expLevel}` : ''}</p>
                    <p class="page-sub ${current ? '' : 'down'}">${tenure}</p></div>
                </div>
                ${exportButtons()}
            </div>
            <div class="stack">
                <div class="kpis">
                    ${kpi('War attacks', stats ? `${stats.used}<span class="muted" style="font-size:16px"> / ${stats.available}</span>` : '—', stats ? `${stats.wars} wars · ${stats.missed} missed` : 'No tracked wars', stats?.missed ? 'down' : '')}
                    ${kpi('Avg stars', stats?.avgStars != null ? stats.avgStars.toFixed(2) : '—', stats?.used ? `${pct(stats.triples, stats.used)} three-stars` : '')}
                    ${kpi('Capital gold', num(raidGold), `${raids.length} raid weekends`)}
                    ${kpi('Donations', num(current?.donations ?? last?.donations), `${num(current?.donationsReceived ?? last?.donations_received)} received this season`)}
                </div>
                ${daily.length > 1 ? `<section class="card" aria-labelledby="don-h"><div class="card-head"><div><h2 class="card-title" id="don-h">Donations by day</h2><p class="card-sub">Season totals reset monthly.</p></div></div>
                    <div class="chart-box sm"><canvas id="plDonations" aria-label="Donations by day"></canvas></div></section>` : ''}
                <section class="card" aria-labelledby="atk-h"><div class="card-head"><div><h2 class="card-title" id="atk-h">War attacks</h2><p class="card-sub">${attacks.length} attacks in tracked wars</p></div></div><div id="plAttacks"></div></section>
                ${raids.length ? `<section class="card" aria-labelledby="raid-h"><div class="card-head"><div><h2 class="card-title" id="raid-h">Raid Weekends</h2></div></div><div id="plRaids"></div></section>` : ''}
            </div>`;

        const atkCols = [
            { key: 'date', label: 'Date', value: r => r.date.getTime(), render: r => `${fmtDay(r.date)}${r.kind === 'cwl' ? ' <span class="badge gold">CWL</span>' : ''}`, exportValue: r => r.date.toISOString().slice(0, 10) },
            { key: 'opp', label: 'Opponent', value: r => r.opponent, render: r => `<a class="player-link" href="#/wars/${encodeURIComponent(r.war.id)}">${esc(r.opponent)}</a>` },
            { key: 'target', label: 'Target', value: r => r.defPos, render: r => `#${r.defPos ?? '?'} · TH${r.defTh ?? '?'}`, exportValue: r => `#${r.defPos} TH${r.defTh}` },
            { key: 'diff', label: 'TH diff', num: true, value: r => r.defTh != null ? r.defTh - r.myTh : null, render: r => r.defTh != null ? (r.defTh - r.myTh > 0 ? `+${r.defTh - r.myTh}` : `${r.defTh - r.myTh}`) : '—' },
            { key: 'stars', label: 'Stars', num: true, value: r => r.stars, render: r => starsHtml(r.stars) },
            { key: 'dest', label: 'Destruction', num: true, value: r => r.dest, render: r => `${r.dest}%` }
        ];
        mountTable(root.querySelector('#plAttacks'), { columns: atkCols, rows: attacks, caption: 'War attacks', noun: 'attacks' });

        const raidCols = [
            { key: 'date', label: 'Weekend', value: r => r.raid.startTime, render: r => fmtDate(parseCoc(r.raid.startTime)), exportValue: r => parseCoc(r.raid.startTime).toISOString().slice(0, 10) },
            { key: 'attacks', label: 'Attacks', num: true, value: r => r.m.attacks, render: r => `${r.m.attacks}/${r.m.attackLimit + r.m.bonusAttackLimit}` },
            { key: 'gold', label: 'Capital gold', num: true, value: r => r.m.capitalResourcesLooted, render: r => num(r.m.capitalResourcesLooted) }
        ];
        if (raids.length) mountTable(root.querySelector('#plRaids'), { columns: raidCols, rows: raids, caption: 'Raid Weekends', noun: 'weekends' });

        if (daily.length > 1) {
            chart(root.querySelector('#plDonations'), lineConfig(daily.map(d => fmtDay(d.date)), daily.map(d => d.donations), { label: 'Donated', color: cssVar('--series-1') }));
        }

        const title = `${name} player report`;
        bindExports(root, {
            xlsx: () => exportExcel(title, [
                { name: 'Attacks', ...tableData(atkCols, attacks) },
                { name: 'Raids', ...tableData(raidCols, raids) },
                { name: 'Donations by day', header: ['Date', 'Donated', 'Received', 'Trophies'], body: daily.map(d => [d.date, d.donations, d.donations_received, d.trophies]) }
            ]),
            pdf: () => exportPdf(title, `${tag} · TH${th}`, [
                { title: 'War attacks', ...tableData(atkCols, attacks) },
                { title: 'Raid Weekends', ...tableData(raidCols, raids) }
            ])
        });
        document.title = `${name} · Clan Stats`;
    });

    return () => { cancelled = true; };
}

