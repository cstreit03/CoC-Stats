/**
 * Raid weekends: per-player summary, our raids on other capitals, and defenses.
 * Route: #/raids or #/raids/<startTime>
 */
import { store, members } from '../store.js';
import { esc, num, thImg, parseCoc, fmtDate } from '../util.js';
import { seg, bindToggle, select, bindSelect, kpi, mountTable, tableData, exportButtons, noDataMessage } from '../ui.js';
import { exportExcel, exportPdf, bindExports } from '../export.js';

const state = { tab: 'summary' };

export function playerRows(raid) {
    const th = new Map(members().map(m => [m.tag, m.townHallLevel]));
    const extra = new Map();
    for (const clan of raid.attackLog || []) for (const d of clan.districts || []) for (const a of d.attacks || []) {
        const x = extra.get(a.attacker.tag) || { stars: 0, damage: 0, hits: 0 };
        x.stars += a.stars; x.damage += a.destructionPercent; x.hits++;
        extra.set(a.attacker.tag, x);
    }
    return (raid.members || []).map(m => {
        const x = extra.get(m.tag) || { stars: 0, damage: 0, hits: 0 };
        return { ...m, th: th.get(m.tag), limit: m.attackLimit + m.bonusAttackLimit, stars: x.stars, damage: x.damage, avgStars: x.hits ? x.stars / x.hits : null };
    });
}

const logRows = (log, key) => (log || []).map((c, i) => ({
    n: i + 1, clan: c[key]?.name, badge: c[key]?.badgeUrls?.small, level: c[key]?.level,
    attacks: c.attackCount, destroyed: c.districtsDestroyed, districts: c.districtCount,
    done: c.districtsDestroyed >= c.districtCount
}));

export function render(root, { start }) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">Raids</h1>${noDataMessage()}`; return; }
    const raids = store.raids;
    if (!raids.length) { root.innerHTML = '<div class="page-head"><h1 class="page-title">Raid Weekends</h1></div><div class="card empty"><strong>No raid weekends recorded yet</strong></div>'; return; }
    const raid = raids.find(r => r.startTime === start) || raids[0];
    const players = playerRows(raid);
    const label = (r) => `${fmtDate(parseCoc(r.startTime))}${r.state === 'ongoing' ? ' (ongoing)' : ''}`;

    root.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Raid Weekends</h1><p class="page-sub">${label(raid)}</p></div>
            <div class="controls">
                ${select('weekend', 'Weekend', raids.map(r => ({ value: r.startTime, label: label(r) })), raid.startTime, { hideLabel: true })}
                ${exportButtons()}
            </div>
        </div>
        <div class="stack">
            <div class="kpis">
                ${kpi('Capital gold', num(raid.capitalTotalLoot), `${players.length} raiders`)}
                ${kpi('Attacks', num(raid.totalAttacks), `${num(raid.raidsCompleted)} raids completed`)}
                ${kpi('Districts destroyed', num(raid.enemyDistrictsDestroyed))}
                ${kpi('Gold per raider', players.length ? num(raid.capitalTotalLoot / players.length) : '—', 'average')}
            </div>
            ${seg('tab', 'Raid view', [{ value: 'summary', label: 'Players' }, { value: 'attacks', label: 'Our raids' }, { value: 'defenses', label: 'Defenses' }], state.tab)}
            <section class="card"><div id="raidTable"></div></section>
        </div>`;

    const playerCols = [
        { key: 'name', label: 'Player', sticky: true, value: r => r.name, render: r => `<div class="cell-player">${r.th ? `<img src="${thImg(r.th)}" alt="TH${r.th}">` : ''}<a class="player-link" href="#/members/${encodeURIComponent(r.tag.slice(1))}">${esc(r.name)}</a></div>` },
        { key: 'attacks', label: 'Attacks', num: true, value: r => r.attacks, render: r => `${r.attacks}/${r.limit}` },
        { key: 'gold', label: 'Capital gold', num: true, value: r => r.capitalResourcesLooted, render: r => `<b>${num(r.capitalResourcesLooted)}</b>` },
        { key: 'stars', label: 'Stars', num: true, value: r => r.stars },
        { key: 'damage', label: 'Damage', num: true, value: r => r.damage, render: r => `${num(r.damage)}%` },
        { key: 'avg', label: 'Avg stars', num: true, value: r => r.avgStars, render: r => r.avgStars == null ? '—' : r.avgStars.toFixed(2) }
    ];
    const clanCols = (who) => [
        { key: 'n', label: '#', num: true, value: r => r.n },
        { key: 'clan', label: who, value: r => r.clan, render: r => `<div class="cell-player">${r.badge ? `<img src="${r.badge}" alt="">` : ''}<span class="strong">${esc(r.clan)}</span></div>` },
        { key: 'level', label: 'Capital level', num: true, value: r => r.level },
        { key: 'attacks', label: 'Attacks', num: true, value: r => r.attacks },
        { key: 'destroyed', label: 'Districts destroyed', num: true, value: r => r.destroyed, render: r => `${r.destroyed}/${r.districts}${r.done ? ' <span class="badge win">Cleared</span>' : ''}`, exportValue: r => `${r.destroyed}/${r.districts}` }
    ];
    const views = {
        summary: { columns: playerCols, rows: players, sort: { key: 'gold', dir: 'desc' }, title: 'Players', noun: 'players' },
        attacks: { columns: clanCols('Target clan'), rows: logRows(raid.attackLog, 'defender'), title: 'Our raids', noun: 'raids' },
        defenses: { columns: clanCols('Attacking clan'), rows: logRows(raid.defenseLog, 'attacker'), title: 'Defenses', noun: 'defenses' }
    };
    const drawTable = () => {
        const v = views[state.tab];
        const el = root.querySelector('#raidTable');
        el.replaceWith(Object.assign(document.createElement('div'), { id: 'raidTable' }));
        mountTable(root.querySelector('#raidTable'), { columns: v.columns, rows: v.rows, sort: v.sort, caption: v.title, noun: v.noun });
    };
    bindToggle(root, 'tab', v => { state.tab = v; drawTable(); });
    bindSelect(root, 'weekend', v => { location.hash = `#/raids/${v}`; });
    drawTable();

    const title = `Raid Weekend ${parseCoc(raid.startTime).toISOString().slice(0, 10)}`;
    const sheets = () => Object.values(views).map(v => ({ name: v.title, ...tableData(v.columns, v.rows) }));
    bindExports(root, {
        xlsx: () => exportExcel(title, sheets()),
        pdf: () => exportPdf(title, `${num(raid.capitalTotalLoot)} capital gold · ${raid.totalAttacks} attacks`, sheets().map(s => ({ title: s.name, header: s.header, body: s.body })))
    });
}
