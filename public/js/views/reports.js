/**
 * Reports: a catalog of focused reports, each with its own controls and
 * Excel/PDF export. Routes: #/reports and #/reports/<id>.
 */
import { store, members, fetchMembersOn } from '../store.js';
import { esc, num, thImg, icons, roleNames, fmtDate, fmtDay, fmtMonth, fmtSeason, parseCoc, cocDay } from '../util.js';
import { seg, chips, bindToggle, select, bindSelect, kpi, mountTable, tableData, exportButtons, noDataMessage } from '../ui.js';
import { inRange, rangeOptions, memberWarStats, clanWarTotals, warHistory, record, recordByMonth, weekStart } from '../stats.js';
import { chart, lineConfig, cssVar } from '../charts.js';
import { exportExcel, exportPdf, bindExports } from '../export.js';
import { playerRows } from './raids.js';
import { scorecardHtml, mountScorecard } from './cwlScorecard.js';

const pctCell = (v, digits = 0) => v == null ? '—' : `${(v * 100).toFixed(digits)}%`;
const fix = (v, d = 2) => v == null ? '—' : v.toFixed(d);
const rangeLabel = (r) => rangeOptions.find(o => o.value === r)?.label || 'All time';
const playerCell = (r) => `<div class="cell-player"><img src="${thImg(r.th)}" alt="TH${r.th}"><a class="player-link" href="#/members/${encodeURIComponent(r.tag.slice(1))}">${esc(r.name)}</a></div>`;
const memo = {};

/* ---------------- Report definitions ---------------- */

const REPORTS = [
    {
        id: 'member-performance', icon: icons.user, title: 'Member war performance',
        desc: 'Attacks used and missed, stars, three-star rate and defense for every member.',
        render(body, s) {
            s.range ??= 'all'; s.kind ??= 'all'; s.current ??= 'current';
            body.innerHTML = `<div class="controls">
                    ${seg('range', 'Time range', rangeOptions, s.range)}
                    ${chips('kind', 'War type', [{ value: 'all', label: 'All wars' }, { value: 'regular', label: 'Regular' }, { value: 'cwl', label: 'CWL' }], s.kind)}
                    ${chips('current', 'Members', [{ value: 'current', label: 'Current members' }, { value: 'everyone', label: 'Include former' }], s.current)}
                </div>
                <div class="kpis five" id="mpKpis"></div>
                <section class="card"><div id="mpTable"></div></section>`;
            const columns = [
                { key: 'name', label: 'Player', sticky: true, value: r => r.name, render: r => `${playerCell(r)}${r.current ? '' : ' <span class="badge">Former</span>'}` },
                { key: 'th', label: 'TH', num: true, value: r => r.th },
                { key: 'wars', label: 'Wars', num: true, value: r => r.wars },
                { key: 'used', label: 'Attacks', num: true, value: r => r.used, render: r => `${r.used}/${r.available}`, exportValue: r => r.used },
                { key: 'available', label: 'Available', num: true, value: r => r.available, hidden: true },
                { key: 'missed', label: 'Missed', num: true, value: r => r.missed, render: r => r.missed ? `<span class="down">${r.missed}</span>` : '0' },
                { key: 'usage', label: 'Usage', num: true, value: r => r.usage, render: r => pctCell(r.usage), exportValue: r => r.usage == null ? '' : +(r.usage * 100).toFixed(1) },
                { key: 'stars', label: 'Stars', num: true, value: r => r.stars },
                { key: 'avg', label: 'Avg stars', num: true, value: r => r.avgStars, render: r => fix(r.avgStars), exportValue: r => r.avgStars == null ? '' : +r.avgStars.toFixed(2) },
                { key: 'triple', label: '3-star rate', num: true, value: r => r.tripleRate, render: r => pctCell(r.tripleRate), exportValue: r => r.tripleRate == null ? '' : +(r.tripleRate * 100).toFixed(1) },
                { key: 'dest', label: 'Avg %', num: true, value: r => r.avgDestruction, render: r => r.avgDestruction == null ? '—' : `${r.avgDestruction.toFixed(1)}%`, exportValue: r => r.avgDestruction == null ? '' : +r.avgDestruction.toFixed(1) },
                { key: 'thdiff', label: 'Avg TH hit', num: true, title: 'Average Town Hall difference of targets (+ = attacked up)', value: r => r.avgThDiff, render: r => r.avgThDiff == null ? '—' : (r.avgThDiff > 0 ? '+' : '') + r.avgThDiff.toFixed(1), exportValue: r => r.avgThDiff == null ? '' : +r.avgThDiff.toFixed(2) },
                { key: 'def', label: 'Def stars conceded', num: true, value: r => r.avgConceded, render: r => fix(r.avgConceded), exportValue: r => r.avgConceded == null ? '' : +r.avgConceded.toFixed(2) }
            ];
            const allColumns = columns;
            const visibleColumns = columns.filter(c => !c.hidden);
            let table;
            const data = () => {
                const wars = inRange(store.wars, s.range).filter(w => s.kind === 'all' || w.kind === s.kind);
                const rows = memberWarStats(wars).filter(r => s.current === 'everyone' || r.current);
                return { wars, rows };
            };
            const draw = () => {
                const { wars, rows } = data();
                const t = clanWarTotals(wars);
                body.querySelector('#mpKpis').innerHTML = [
                    kpi('Wars', t.wars, rangeLabel(s.range)),
                    kpi('Avg stars', fix(t.avgStars), `${num(t.attacks)} attacks`),
                    kpi('3-star rate', pctCell(t.tripleRate), `${t.triples} triples`),
                    kpi('Missed attacks', t.missed, t.wars ? `${(t.missed / t.wars).toFixed(1)} per war` : '', t.missed ? 'down' : ''),
                    kpi('Avg destruction', t.avgDestruction == null ? '—' : `${t.avgDestruction.toFixed(1)}%`)
                ].join('');
                if (!table) table = mountTable(body.querySelector('#mpTable'), { columns: visibleColumns, rows, sort: { key: 'stars', dir: 'desc' }, caption: 'Member war performance', noun: 'members' });
                else table.setRows(rows);
            };
            bindToggle(body, 'range', v => { s.range = v; draw(); });
            bindToggle(body, 'kind', v => { s.kind = v; draw(); });
            bindToggle(body, 'current', v => { s.current = v; draw(); });
            draw();
            const sub = () => `${rangeLabel(s.range)} · ${s.kind === 'all' ? 'all wars' : s.kind === 'cwl' ? 'CWL wars' : 'regular wars'}`;
            return {
                xlsx: () => exportExcel('Member war performance', [{ name: 'Members', ...tableData(allColumns, table.getSorted()) }]),
                pdf: () => exportPdf('Member war performance', sub(), [tableData(visibleColumns, table.getSorted())])
            };
        }
    },
    {
        id: 'war-stats', icon: icons.wars, title: 'Clan war statistics',
        desc: 'Win/loss record by month, star rate per war, and every war result.',
        render(body, s) {
            s.kind ??= 'all';
            body.innerHTML = `<div class="controls">${chips('kind', 'War type', [{ value: 'all', label: 'All wars' }, { value: 'regular', label: 'Regular' }, { value: 'cwl', label: 'CWL' }], s.kind)}</div>
                <div class="kpis five" id="wsKpis"></div>
                <div class="grid-2">
                    <section class="card"><div class="card-head"><div><h2 class="card-title">Record by month</h2><p class="card-sub">Includes the clan's public war log</p></div></div>
                        <div class="chart-box"><canvas id="wsMonths" aria-label="Wins, losses and draws by month"></canvas></div>
                        <div class="legend"><span><i style="background:var(--chart-good)"></i>Wins</span><span><i style="background:var(--chart-bad)"></i>Losses</span><span><i style="background:var(--chart-neutral)"></i>Draws</span></div></section>
                    <section class="card"><div class="card-head"><div><h2 class="card-title">Stars won per war</h2><p class="card-sub">Share of available stars, tracked wars</p></div></div>
                        <div class="chart-box"><canvas id="wsStars" aria-label="Share of stars won per war"></canvas></div></section>
                </div>
                <section class="card"><div class="card-head"><h2 class="card-title">All wars</h2></div><div id="wsTable"></div></section>`;
            const columns = [
                { key: 'date', label: 'Date', value: r => r.endTime, render: r => fmtDate(parseCoc(r.endTime)), exportValue: r => cocDay(r.endTime) },
                { key: 'opp', label: 'Opponent', value: r => r.opponent?.name || '', render: r => r.id ? `<a class="player-link" href="#/wars/${encodeURIComponent(r.id)}">${esc(r.opponent?.name)}</a>` : esc(r.opponent?.name || (r.kind === 'cwl' ? 'CWL season total' : '—')), exportValue: r => r.opponent?.name || (r.kind === 'cwl' ? 'CWL season total' : '') },
                { key: 'kind', label: 'Type', value: r => r.kind, render: r => r.kind === 'cwl' ? '<span class="badge gold">CWL</span>' : 'Regular', exportValue: r => r.kind === 'cwl' ? 'CWL' : 'Regular' },
                { key: 'size', label: 'Size', num: true, value: r => r.teamSize },
                { key: 'result', label: 'Result', value: r => r.result || '', render: r => r.result ? `<span class="badge ${r.result}">${{ win: 'Win', loss: 'Loss', draw: 'Draw' }[r.result]}</span>` : '—', exportValue: r => ({ win: 'Win', loss: 'Loss', draw: 'Draw' }[r.result] || '') },
                { key: 'stars', label: 'Stars', num: true, value: r => r.clanStars, render: r => `${r.clanStars ?? '—'} – ${r.oppStars ?? '—'}`, exportValue: r => r.clanStars },
                { key: 'oppStars', label: 'Opp. stars', num: true, value: r => r.oppStars, hidden: true },
                { key: 'dest', label: 'Destruction', num: true, value: r => r.clanDest, render: r => r.clanDest == null || (r.kind === 'cwl' && !r.id) ? '—' : `${r.clanDest.toFixed(1)}% – ${(r.oppDest ?? 0).toFixed(1)}%`, exportValue: r => r.clanDest == null || (r.kind === 'cwl' && !r.id) ? '' : +r.clanDest.toFixed(2) },
                { key: 'oppDest', label: 'Opp. destruction', num: true, value: r => r.oppDest, hidden: true }
            ];
            const visible = columns.filter(c => !c.hidden);
            let table;
            const entries = () => warHistory().filter(e => e.phase === 'ended' || e.result).filter(e => s.kind === 'all' || e.kind === s.kind);
            const draw = () => {
                const list = entries();
                const rec = record(list);
                const tracked = store.wars.filter(w => s.kind === 'all' || w.kind === s.kind);
                const t = clanWarTotals(tracked);
                body.querySelector('#wsKpis').innerHTML = [
                    kpi('Record', `${rec.win}–${rec.loss}–${rec.draw}`, `${rec.total} wars (W–L–D)`),
                    kpi('Win rate', rec.total ? `${Math.round(rec.winRate * 100)}%` : '—'),
                    kpi('Star rate', pctCell(t.starRate), 'tracked wars'),
                    kpi('Avg stars / attack', fix(t.avgStars)),
                    kpi('3-star rate', pctCell(t.tripleRate))
                ].join('');
                if (!table) table = mountTable(body.querySelector('#wsTable'), { columns: visible, rows: list, sort: { key: 'date', dir: 'desc' }, caption: 'All wars', noun: 'wars' });
                else table.setRows(list);

                const months = recordByMonth(list);
                const keys = [...months.keys()].slice(-18);
                const ds = (label, k, color) => ({ label, data: keys.map(m => months.get(m)[k]), backgroundColor: color, borderRadius: 3, stack: 's' });
                chart(body.querySelector('#wsMonths'), {
                    type: 'bar',
                    data: { labels: keys.map(fmtMonth), datasets: [ds('Wins', 'win', cssVar('--chart-good')), ds('Losses', 'loss', cssVar('--chart-bad')), ds('Draws', 'draw', cssVar('--chart-neutral'))] },
                    options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } } }
                });
                const done = [...tracked].filter(w => w.state === 'warEnded').reverse();
                chart(body.querySelector('#wsStars'), lineConfig(done.map(w => fmtDay(parseCoc(w.startTime))), done.map(w => +(w.clan.stars / (w.teamSize * 3) * 100).toFixed(1)),
                    { label: 'Stars won', color: cssVar('--accent-solid'), yMin: 0, yMax: 100, yFormat: v => `${v}%`, tooltipTitle: (items) => `${items[0].label} · vs ${done[items[0].dataIndex].opponent.name}` }));
            };
            bindToggle(body, 'kind', v => { s.kind = v; draw(); });
            draw();
            return {
                xlsx: () => exportExcel('Clan war statistics', [
                    { name: 'Wars', ...tableData(columns, table.getSorted()) },
                    { name: 'By month', header: ['Month', 'Wins', 'Losses', 'Draws'], body: [...recordByMonth(entries())].map(([m, r]) => [m, r.win, r.loss, r.draw]) }
                ]),
                pdf: () => exportPdf('Clan war statistics', s.kind === 'all' ? 'All wars' : s.kind, [tableData(columns, table.getSorted())], { charts: [body.querySelector('#wsMonths')] })
            };
        }
    },
    {
        id: 'cwl-scorecard', icon: icons.cwl, title: 'CWL scorecard',
        desc: 'Every CWL attack per member and round, scored with rules you set. Excel export keeps live formulas.',
        render(body, s) {
            if (!store.cwl.length) { body.innerHTML = '<div class="card empty"><strong>No CWL season recorded yet</strong>The scorecard fills in from the next league week.</div>'; return null; }
            s.season ??= store.cwl[0].season;
            const season = store.cwl.find(x => x.season === s.season) || store.cwl[0];
            body.innerHTML = `<div class="controls">${select('season', 'Season', store.cwl.map(x => ({ value: x.season, label: fmtSeason(x.season) })), season.season)}</div>
                <section class="card"><div class="stack">${scorecardHtml()}</div></section>`;
            bindSelect(body, 'season', v => { s.season = v; s.rerender(); });
            return mountScorecard(body, season);
        }
    },
    {
        id: 'membership', icon: icons.members, title: 'Membership',
        desc: 'Members over time, weekly joins and departures, and how long each member has been in the clan.',
        render(body) {
            const daily = store.history?.clanDaily || [];
            const events = [...(store.history?.events || [])].reverse();
            const joined = store.history?.joinedAt || {};
            body.innerHTML = `<div class="grid-2">
                    <section class="card"><div class="card-head"><div><h2 class="card-title">Members over time</h2><p class="card-sub">Daily snapshot count</p></div></div>
                        <div class="chart-box"><canvas id="msCount" aria-label="Members per day"></canvas></div></section>
                    <section class="card"><div class="card-head"><div><h2 class="card-title">Joins and departures</h2><p class="card-sub">Per week</p></div></div>
                        <div class="chart-box"><canvas id="msChurn" aria-label="Joins and departures per week"></canvas></div>
                        <div class="legend"><span><i style="background:var(--chart-good)"></i>Joined</span><span><i style="background:var(--chart-bad)"></i>Left</span></div></section>
                </div>
                <div class="grid-2">
                    <section class="card"><div class="card-head"><h2 class="card-title">Roster changes</h2></div><div id="msEvents"></div></section>
                    <section class="card"><div class="card-head"><div><h2 class="card-title">Tenure</h2><p class="card-sub">Current members by join date</p></div></div><div id="msTenure"></div></section>
                </div>`;
            if (daily.length) {
                chart(body.querySelector('#msCount'), lineConfig(daily.map(d => fmtDay(d.date)), daily.map(d => d.member_count), { label: 'Members', color: cssVar('--series-1') }));
                const weeks = new Map();
                for (const d of daily) weeks.set(weekStart(d.date), { join: 0, leave: 0 });
                for (const e of store.history.events || []) { const w = weeks.get(weekStart(e.date)); if (w) w[e.type]++; }
                const keys = [...weeks.keys()];
                chart(body.querySelector('#msChurn'), {
                    type: 'bar',
                    data: { labels: keys.map(k => `Week of ${fmtDay(k)}`), datasets: [
                        { label: 'Joined', data: keys.map(k => weeks.get(k).join), backgroundColor: cssVar('--chart-good'), borderRadius: 3, stack: 's' },
                        { label: 'Left', data: keys.map(k => -weeks.get(k).leave), backgroundColor: cssVar('--chart-bad'), borderRadius: 3, stack: 's' }] },
                    options: { plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Math.abs(c.raw)}` } } },
                        scales: { x: { stacked: true, grid: { display: false }, ticks: { display: false } }, y: { stacked: true, ticks: { precision: 0, callback: v => Math.abs(v) } } } }
                });
            }
            const evCols = [
                { key: 'date', label: 'Date', value: r => r.date, render: r => fmtDate(r.date) },
                { key: 'type', label: 'Change', value: r => r.type, render: r => `<span class="badge ${r.type === 'join' ? 'win' : 'loss'}">${r.type === 'join' ? 'Joined' : 'Left'}</span>`, exportValue: r => r.type === 'join' ? 'Joined' : 'Left' },
                { key: 'name', label: 'Player', value: r => r.name, render: r => playerCell({ ...r, th: r.townHall }) },
                { key: 'th', label: 'TH', num: true, value: r => r.townHall }
            ];
            const tenure = members().map(m => ({ tag: m.tag, name: m.name, th: m.townHallLevel, role: m.role, since: joined[m.tag]?.date, before: joined[m.tag]?.beforeTracking }));
            const tnCols = [
                { key: 'name', label: 'Player', value: r => r.name, render: playerCell },
                { key: 'role', label: 'Role', value: r => roleNames[r.role] },
                { key: 'since', label: 'Member since', value: r => r.since, render: r => r.since ? `${r.before ? 'before ' : ''}${fmtDate(r.since)}` : '—', exportValue: r => r.since ? `${r.before ? 'before ' : ''}${r.since}` : '' },
                { key: 'days', label: 'Days', num: true, value: r => r.since ? Math.round((Date.now() - Date.parse(r.since)) / 86400000) : null, render: r => r.since ? `${r.before ? '>' : ''}${Math.round((Date.now() - Date.parse(r.since)) / 86400000)}` : '—' }
            ];
            mountTable(body.querySelector('#msEvents'), { columns: evCols, rows: events, caption: 'Roster changes', noun: 'changes' });
            mountTable(body.querySelector('#msTenure'), { columns: tnCols, rows: tenure, sort: { key: 'days', dir: 'desc' }, caption: 'Tenure', noun: 'members' });
            return {
                xlsx: () => exportExcel('Membership', [
                    { name: 'Members per day', header: ['Date', 'Members', 'Clan level', 'War wins', 'War losses'], body: daily.map(d => [d.date, d.member_count, d.clan_level, d.war_wins, d.war_losses]) },
                    { name: 'Roster changes', ...tableData(evCols, events) },
                    { name: 'Tenure', ...tableData(tnCols, tenure) }
                ]),
                pdf: () => exportPdf('Membership', `${members().length} members`, [{ title: 'Roster changes', ...tableData(evCols, events) }, { title: 'Tenure', ...tableData(tnCols, tenure) }], { charts: [body.querySelector('#msCount')] })
            };
        }
    },
    {
        id: 'donations', icon: icons.gift, title: 'Donations',
        desc: 'Troops donated and received this season, with ratios, for any snapshot date.',
        render(body, s) {
            s.date ??= store.memberDates[0];
            body.innerHTML = `<div class="controls">${select('date', 'Roster on', store.memberDates.map((d, i) => ({ value: d, label: i ? fmtDate(d) : `${fmtDate(d)} (latest)` })), s.date)}</div>
                <div class="kpis" id="dnKpis"></div><section class="card"><div id="dnTable"></div></section>`;
            const columns = [
                { key: 'name', label: 'Player', sticky: true, value: r => r.name, render: r => playerCell({ ...r, th: r.townHallLevel }) },
                { key: 'role', label: 'Role', value: r => roleNames[r.role] },
                { key: 'th', label: 'TH', num: true, value: r => r.townHallLevel },
                { key: 'don', label: 'Donated', num: true, value: r => r.donations, render: r => `<b>${num(r.donations)}</b>` },
                { key: 'rec', label: 'Received', num: true, value: r => r.donationsReceived, render: r => num(r.donationsReceived) },
                { key: 'net', label: 'Net', num: true, value: r => r.donations - r.donationsReceived, render: r => { const n = r.donations - r.donationsReceived; return `<span class="${n >= 0 ? 'up' : 'down'}">${n > 0 ? '+' : ''}${num(n)}</span>`; } },
                { key: 'ratio', label: 'Ratio', num: true, value: r => r.donationsReceived ? r.donations / r.donationsReceived : (r.donations ? Infinity : 0), render: r => r.donationsReceived ? (r.donations / r.donationsReceived).toFixed(2) : (r.donations ? '∞' : '—'), exportValue: r => r.donationsReceived ? +(r.donations / r.donationsReceived).toFixed(2) : '' }
            ];
            let table, rows = [];
            const draw = async () => {
                rows = s.date === store.memberDates[0] ? members() : (memo[s.date] ??= (await fetchMembersOn(s.date)).members);
                const given = rows.reduce((a, m) => a + m.donations, 0), got = rows.reduce((a, m) => a + m.donationsReceived, 0);
                const top = [...rows].sort((a, b) => b.donations - a.donations)[0];
                body.querySelector('#dnKpis').innerHTML = [kpi('Donated', num(given)), kpi('Received', num(got)), kpi('Top donor', top ? esc(top.name) : '—', top ? num(top.donations) : ''), kpi('Members donating', rows.filter(m => m.donations > 0).length, `of ${rows.length}`)].join('');
                if (!table) table = mountTable(body.querySelector('#dnTable'), { columns, rows, sort: { key: 'don', dir: 'desc' }, caption: 'Donations', noun: 'members' });
                else table.setRows(rows);
            };
            bindSelect(body, 'date', v => { s.date = v; draw(); });
            draw();
            return {
                xlsx: () => exportExcel(`Donations ${s.date}`, [{ name: 'Donations', ...tableData(columns, table.getSorted()) }]),
                pdf: () => exportPdf('Donations', `Season to ${fmtDate(s.date)}`, [tableData(columns, table.getSorted())])
            };
        }
    },
    {
        id: 'raids', icon: icons.raids, title: 'Raid Weekends',
        desc: 'Capital gold per weekend and a player-by-weekend gold sheet.',
        render(body) {
            const raids = [...store.raids].reverse();
            const recent = raids.slice(-10);
            const players = new Map();
            recent.forEach((r, i) => playerRows(r).forEach(p => {
                const x = players.get(p.tag) || { tag: p.tag, name: p.name, th: p.th, gold: Array(recent.length).fill(null), total: 0, attacks: 0 };
                x.gold[i] = p.capitalResourcesLooted; x.total += p.capitalResourcesLooted; x.attacks += p.attacks; x.th ??= p.th;
                players.set(p.tag, x);
            }));
            const matrix = [...players.values()];
            body.innerHTML = `<section class="card"><div class="card-head"><div><h2 class="card-title">Capital gold per weekend</h2></div></div>
                    <div class="chart-box sm"><canvas id="rdChart" aria-label="Capital gold per weekend"></canvas></div></section>
                <section class="card"><div class="card-head"><div><h2 class="card-title">Weekends</h2></div></div><div id="rdTable"></div></section>
                <section class="card"><div class="card-head"><div><h2 class="card-title">Gold by player</h2><p class="card-sub">Last ${recent.length} weekends</p></div></div><div id="rdMatrix"></div></section>`;
            chart(body.querySelector('#rdChart'), {
                type: 'bar',
                data: { labels: raids.map(r => fmtDay(parseCoc(r.startTime))), datasets: [{ label: 'Capital gold', data: raids.map(r => r.capitalTotalLoot), backgroundColor: cssVar('--series-1'), borderRadius: 4, maxBarThickness: 36 }] },
                options: { scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => v >= 1000 ? `${Math.round(v / 1000)}k` : v } } } }
            });
            const wkCols = [
                { key: 'date', label: 'Weekend', value: r => r.startTime, render: r => `<a class="player-link" href="#/raids/${r.startTime}">${fmtDate(parseCoc(r.startTime))}</a>`, exportValue: r => cocDay(r.startTime) },
                { key: 'gold', label: 'Capital gold', num: true, value: r => r.capitalTotalLoot, render: r => num(r.capitalTotalLoot) },
                { key: 'raiders', label: 'Raiders', num: true, value: r => (r.members || []).length },
                { key: 'attacks', label: 'Attacks', num: true, value: r => r.totalAttacks },
                { key: 'raids', label: 'Raids completed', num: true, value: r => r.raidsCompleted },
                { key: 'districts', label: 'Districts destroyed', num: true, value: r => r.enemyDistrictsDestroyed }
            ];
            const mxCols = [
                { key: 'name', label: 'Player', sticky: true, value: r => r.name, render: r => r.th ? playerCell(r) : esc(r.name) },
                ...recent.map((r, i) => ({ key: `w${i}`, label: fmtDay(parseCoc(r.startTime)), num: true, value: p => p.gold[i], render: p => p.gold[i] == null ? '<span class="muted">—</span>' : num(p.gold[i]) })),
                { key: 'total', label: 'Total', num: true, value: r => r.total, render: r => `<b>${num(r.total)}</b>` }
            ];
            mountTable(body.querySelector('#rdTable'), { columns: wkCols, rows: [...raids].reverse(), caption: 'Raid Weekends', noun: 'weekends' });
            const mx = mountTable(body.querySelector('#rdMatrix'), { columns: mxCols, rows: matrix, sort: { key: 'total', dir: 'desc' }, caption: 'Capital gold by player', noun: 'players' });
            return {
                xlsx: () => exportExcel('Raid Weekends', [{ name: 'Weekends', ...tableData(wkCols, [...raids].reverse()) }, { name: 'Gold by player', ...tableData(mxCols, mx.getSorted()) }]),
                pdf: () => exportPdf('Raid Weekends', `${raids.length} weekends`, [{ title: 'Weekends', ...tableData(wkCols, [...raids].reverse()) }, { title: 'Gold by player', ...tableData(mxCols, mx.getSorted()) }], { charts: [body.querySelector('#rdChart')] })
            };
        }
    },
    {
        id: 'roster', icon: icons.shield, title: 'Roster composition',
        desc: 'Town Hall levels, roles and leagues across the current roster.',
        render(body) {
            const list = members();
            const group = (fn) => { const m = new Map(); for (const x of list) { const k = fn(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
            const th = [...group(m => m.townHallLevel)].sort((a, b) => b[0] - a[0]);
            const roles = [...group(m => m.role)].sort((a, b) => b[1] - a[1]);
            const leagues = [...group(m => (m.leagueTier || m.league)?.name || 'Unranked')].sort((a, b) => b[1] - a[1]);
            const max = Math.max(...th.map(x => x[1]), 1);
            body.innerHTML = `<div class="grid-2">
                <section class="card"><div class="card-head"><h2 class="card-title">Town Hall levels</h2></div>
                    <div class="list">${th.map(([lv, n]) => `<div class="list-item"><img class="th-sm" src="${thImg(lv)}" alt=""><span style="width:52px;font-weight:600">TH${lv}</span>
                        <div class="bar-track" style="flex:1" role="img" aria-label="${n} members"><div class="bar-fill" style="width:${n / max * 100}%"></div></div><b style="width:28px;text-align:right">${n}</b></div>`).join('')}</div></section>
                <div class="stack">
                    <section class="card"><div class="card-head"><h2 class="card-title">Roles</h2></div><div class="list">${roles.map(([r, n]) => `<div class="list-item"><span class="li-main">${roleNames[r] || r}</span><b>${n}</b></div>`).join('')}</div></section>
                    <section class="card"><div class="card-head"><h2 class="card-title">Leagues</h2></div><div class="list">${leagues.map(([l, n]) => `<div class="list-item"><span class="li-main">${esc(l)}</span><b>${n}</b></div>`).join('')}</div></section>
                </div></div>`;
            const header = ['Player', 'Tag', 'Role', 'Town Hall', 'XP', 'League', 'Trophies', 'Donated', 'Received'];
            const rowsOut = () => list.map(m => [m.name, m.tag, roleNames[m.role], m.townHallLevel, m.expLevel, (m.leagueTier || m.league)?.name || '', m.trophies, m.donations, m.donationsReceived]);
            return {
                xlsx: () => exportExcel('Roster', [
                    { name: 'Roster', header, body: rowsOut() },
                    { name: 'Town Halls', header: ['Town Hall', 'Members'], body: th.map(([lv, n]) => [lv, n]) },
                    { name: 'Roles', header: ['Role', 'Members'], body: roles.map(([r, n]) => [roleNames[r] || r, n]) }
                ]),
                pdf: () => exportPdf('Roster composition', `${list.length} members`, [{ title: 'Town Halls', header: ['Town Hall', 'Members'], body: th.map(([lv, n]) => [`TH${lv}`, n]) }, { title: 'Roster', header, body: rowsOut() }])
            };
        }
    }
];

const reportState = {};

export function render(root, { id }) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">Reports</h1>${noDataMessage()}`; return; }
    const report = REPORTS.find(r => r.id === id);

    if (!report) {
        root.innerHTML = `<div class="page-head"><div><h1 class="page-title">Reports</h1><p class="page-sub">Pick a report to view it and export to Excel or PDF.</p></div></div>
            <div class="report-grid">${REPORTS.map(r => `<a class="card" href="#/reports/${r.id}"><div class="report-tile">
                <span class="report-icon">${r.icon}</span><div><h2 style="font-size:16px;font-weight:700">${r.title}</h2><p>${r.desc}</p></div></div></a>`).join('')}</div>`;
        return;
    }

    root.innerHTML = `<a class="back-link" href="#/reports">${icons.back}Reports</a>
        <div class="page-head"><div><h1 class="page-title">${report.title}</h1><p class="page-sub">${report.desc}</p></div>${exportButtons()}</div>
        <div class="stack" id="reportBody"></div>`;
    const s = (reportState[report.id] ??= {});
    s.rerender = () => render(root, { id });
    const exporters = report.render(root.querySelector('#reportBody'), s);
    if (exporters) bindExports(root, exporters);
    else root.querySelector('[data-export]')?.parentElement.remove();
}

