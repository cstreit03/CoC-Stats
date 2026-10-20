/**
 * War detail: scoreboard, prediction, both sides' attacks and the base-by-base matchup.
 */
import { store } from '../store.js';
import { esc, thImg, starsHtml, icons, warPhase, num, parseCoc, fmtDate, debounce } from '../util.js';
import { seg, chips, bindToggle, select, bindSelect, kpi, exportButtons, mountPagedList } from '../ui.js';
import { warHero, fillPredictions, startCountdowns } from './warParts.js';
import { exportExcel, exportPdf, bindExports } from '../export.js';

const state = { side: 'us', filter: 'all', sort: 'pos', q: '' };

function attackCell(a, targets, apm, attackerTh) {
    if (!a) return `<div class="atk empty">No attack</div>`;
    const t = targets.get(a.defenderTag);
    const diff = t ? t.townhallLevel - attackerTh : 0;
    const color = a.stars === 3 ? 'var(--chart-good)' : a.stars === 2 ? 'var(--warn)' : a.stars === 1 ? 'var(--chart-bad)' : 'var(--chart-neutral)';
    return `<div class="atk">
        <div class="atk-top"><span class="atk-target">#${t?.mapPosition ?? '?'} ${esc(t?.name || '')} · TH${t?.townhallLevel ?? '?'}${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}</span>${starsHtml(a.stars)}</div>
        <div class="row" style="gap:8px"><div class="atk-bar" style="flex:1"><span style="width:${a.destructionPercentage}%;background:${color}"></span></div><span style="font-size:12px;font-weight:600">${a.destructionPercentage}%</span></div>
    </div>`;
}

function rosterRow(m, targets, apm) {
    const atks = m.attacks || [];
    const total = atks.reduce((s, a) => s + a.stars, 0);
    const cells = Array.from({ length: apm }, (_, i) => attackCell(atks[i], targets, apm, m.townhallLevel)).join('');
    return `<div class="roster-row">
        <span class="pos">#${m.mapPosition}</span>
        <div class="row min-w-0"><img class="th-sm" src="${thImg(m.townhallLevel)}" alt="TH${m.townhallLevel}">
            <div class="min-w-0"><p class="li-title">${esc(m.name)}</p><p class="li-sub">TH${m.townhallLevel}${m.bestOpponentAttack ? ` · conceded ${m.bestOpponentAttack.stars} star${m.bestOpponentAttack.stars === 1 ? '' : 's'}` : ''}</p></div></div>
        <div class="attacks" style="--apm:${apm}">${cells}</div>
        <div class="roster-total"><b>${total}</b><p class="li-sub">stars</p></div>
    </div>`;
}

function matchupRow(ours, theirs) {
    const cell = (m, side) => m ? `<div class="row min-w-0" style="${side === 'r' ? 'flex-direction:row-reverse;text-align:right' : ''}">
        <img class="th-sm" src="${thImg(m.townhallLevel)}" alt="TH${m.townhallLevel}">
        <div class="min-w-0"><p class="li-title">${esc(m.name)}</p><p class="li-sub">TH${m.townhallLevel} · ${m.bestOpponentAttack ? `${m.bestOpponentAttack.destructionPercentage}%` : 'not attacked'}</p></div></div>` : '<div></div>';
    return `<div class="roster-row" style="grid-template-columns:34px minmax(0,1fr) auto auto minmax(0,1fr)">
        <span class="pos">#${(ours || theirs).mapPosition}</span>
        ${cell(ours, 'l')}
        <span title="Stars the opponent took on our base">${starsHtml(ours?.bestOpponentAttack?.stars ?? 0)}</span>
        <span title="Stars we took on their base">${starsHtml(theirs?.bestOpponentAttack?.stars ?? 0)}</span>
        ${cell(theirs, 'r')}
    </div>`;
}

export function render(root, { id }) {
    const war = store.wars.find(w => w.id === id);
    if (!war) {
        root.innerHTML = `<a class="back-link" href="#/wars">${icons.back}Wars</a><h1 class="page-title">War not found</h1><p class="empty">This war isn't in the tracked history.</p>`;
        return;
    }
    const phase = warPhase(war);
    const apm = war.attacksPerMember || 2;
    // Nothing to show per attack before battle day; open on the base matchups.
    if (state.lastWar !== id) state.q = '';
    if (phase === 'preparation' && state.side !== 'matchup' && state.lastWar !== id) state.side = 'matchup';
    state.lastWar = id;
    const ourMap = new Map(war.clan.members.map(m => [m.tag, m]));
    const theirMap = new Map(war.opponent.members.map(m => [m.tag, m]));

    const attacksOf = (list) => list.flatMap(m => m.attacks || []);
    const ourAtks = attacksOf(war.clan.members), theirAtks = attacksOf(war.opponent.members);
    const avg = (arr, k) => arr.length ? arr.reduce((s, a) => s + a[k], 0) / arr.length : null;
    const triples = (arr) => arr.filter(a => a.stars === 3).length;
    const left = (list) => list.reduce((s, m) => s + apm - (m.attacks || []).length, 0);
    const cleanup = war.opponent.members.filter(m => { const s = m.bestOpponentAttack?.stars ?? 0; return s > 0 && s < 3; }).length;
    const untouched = war.opponent.members.filter(m => !m.bestOpponentAttack).length;

    root.innerHTML = `
        <a class="back-link" href="#/wars">${icons.back}Wars</a>
        <div class="page-head">
            <div><h1 class="page-title">vs ${esc(war.opponent.name)}</h1>
            <p class="page-sub">${fmtDate(parseCoc(war.startTime))} · ${war.kind === 'cwl' ? `CWL round ${war.round}` : 'Regular war'} · ${war.teamSize} v ${war.teamSize}</p></div>
            ${exportButtons()}
        </div>
        <div class="stack">
            ${warHero(war, { link: false })}
            ${phase !== 'preparation' ? `<div class="kpis five">
                ${kpi('Avg stars', avg(ourAtks, 'stars')?.toFixed(2) ?? '—', `opponent ${avg(theirAtks, 'stars')?.toFixed(2) ?? '—'}`)}
                ${kpi('Avg destruction', ourAtks.length ? `${avg(ourAtks, 'destructionPercentage').toFixed(1)}%` : '—', `opponent ${theirAtks.length ? avg(theirAtks, 'destructionPercentage').toFixed(1) + '%' : '—'}`)}
                ${kpi('Three-stars', triples(ourAtks), `opponent ${triples(theirAtks)}`)}
                ${kpi(phase === 'ended' ? 'Missed attacks' : 'Attacks left', left(war.clan.members), `opponent ${left(war.opponent.members)}`, phase === 'ended' && left(war.clan.members) ? 'down' : '')}
                ${kpi('Bases to clean up', cleanup, `${untouched} not attacked yet`)}
            </div>` : ''}
            <section class="card" aria-labelledby="roster-h">
                <div class="card-head"><h2 class="card-title" id="roster-h">Line-up</h2></div>
                <div class="controls" style="margin-bottom:12px">
                    ${seg('side', 'View', [{ value: 'us', label: 'Our attacks' }, { value: 'them', label: 'Their attacks' }, { value: 'matchup', label: 'Base matchups' }], state.side)}
                    ${chips('filter', 'Filter members', [{ value: 'all', label: 'Everyone' }, { value: 'left', label: 'Attacks left' }, { value: 'noTriple', label: 'No three-star' }], state.filter)}
                    ${select('sort', 'Sort', [{ value: 'pos', label: 'Map position' }, { value: 'stars', label: 'Stars' }, { value: 'th', label: 'Town Hall' }], state.sort, { hideLabel: true })}
                    <label class="field" style="flex:1;min-width:160px"><span class="sr-only">Search players</span>
                        <input class="input" type="search" id="rosterSearch" placeholder="Search player" value="${esc(state.q)}" autocomplete="off"></label>
                </div>
                <div id="rosterHead"></div>
                <div id="roster"></div>
            </section>
        </div>`;

    const roster = mountPagedList(root.querySelector('#roster'), { className: 'roster', pageSize: 10, noun: 'bases', emptyHtml: '<p class="empty">No members match this filter.</p>' });
    const head = root.querySelector('#rosterHead');
    const matches = (m) => !state.q || (m?.name || '').toLowerCase().includes(state.q.toLowerCase());
    const draw = () => {
        if (state.side === 'matchup') {
            const n = war.teamSize;
            const byPos = (list) => new Map(list.map(m => [m.mapPosition, m]));
            const a = byPos(war.clan.members), b = byPos(war.opponent.members);
            const positions = Array.from({ length: n }, (_, i) => i + 1).filter(p => !state.q || matches(a.get(p)) || matches(b.get(p)));
            head.innerHTML = `<div class="row" style="justify-content:space-between;font-size:12px;color:var(--muted);padding:0 12px 8px"><span>Our base · stars they took</span><span>Stars we took · their base</span></div>`;
            roster.setItems(positions.map(p => matchupRow(a.get(p), b.get(p))));
            return;
        }
        head.innerHTML = '';
        const list = state.side === 'us' ? war.clan.members : war.opponent.members;
        const targets = state.side === 'us' ? theirMap : ourMap;
        const stars = (m) => (m.attacks || []).reduce((s, x) => s + x.stars, 0);
        const rows = list
            .filter(matches)
            .filter(m => state.filter === 'all'
                || (state.filter === 'left' && (m.attacks || []).length < apm)
                || (state.filter === 'noTriple' && !(m.attacks || []).some(x => x.stars === 3)))
            .sort(state.sort === 'stars' ? (x, y) => stars(y) - stars(x) || x.mapPosition - y.mapPosition
                : state.sort === 'th' ? (x, y) => y.townhallLevel - x.townhallLevel || x.mapPosition - y.mapPosition
                : (x, y) => x.mapPosition - y.mapPosition);
        roster.setItems(rows.map(m => rosterRow(m, targets, apm)));
    };
    bindToggle(root, 'side', v => { state.side = v; draw(); });
    bindToggle(root, 'filter', v => { state.filter = v; draw(); });
    bindSelect(root, 'sort', v => { state.sort = v; draw(); });
    root.querySelector('#rosterSearch').addEventListener('input', debounce(e => { state.q = e.target.value; draw(); }, 120));
    draw();

    // Export: one row per attack for both sides.
    const rowsFor = (attackers, defenders, side) => attackers.flatMap(m => (m.attacks || []).map(a => {
        const d = defenders.get(a.defenderTag);
        return [side, m.mapPosition, m.name, m.townhallLevel, d?.mapPosition, d?.name, d?.townhallLevel, a.stars, a.destructionPercentage, a.order, a.duration];
    }));
    const header = ['Side', 'Pos', 'Attacker', 'TH', 'Target pos', 'Target', 'Target TH', 'Stars', 'Destruction %', 'Order', 'Duration (s)'];
    const body = () => [...rowsFor(war.clan.members, theirMap, war.clan.name), ...rowsFor(war.opponent.members, ourMap, war.opponent.name)].sort((a, b) => a[9] - b[9]);
    const title = `War vs ${war.opponent.name}`;
    bindExports(root, {
        xlsx: () => exportExcel(title, [
            { name: 'Attacks', header, body: body() },
            { name: 'Summary', header: ['', war.clan.name, war.opponent.name], body: [
                ['Stars', war.clan.stars, war.opponent.stars],
                ['Destruction %', war.clan.destructionPercentage, war.opponent.destructionPercentage],
                ['Attacks used', war.clan.attacks || 0, war.opponent.attacks || 0]
            ] }
        ]),
        pdf: () => exportPdf(title, `${fmtDate(parseCoc(war.startTime))} · ${war.clan.stars}–${war.opponent.stars} · ${num(war.clan.destructionPercentage, 1)}% vs ${num(war.opponent.destructionPercentage, 1)}%`, [{ header, body: body() }])
    });

    fillPredictions(root, { detailed: true });
    document.title = `${title} · Clan Stats`;
    return startCountdowns(root);
}
