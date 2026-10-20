/**
 * Analytics & Charts Module
 * Aggregations and Chart.js rendering for the Overview KPIs and Reports tab.
 */
import { parseCoCDate, getTHImage, esc, warResult, isFinished } from './constants.js';

const charts = {};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function draw(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    charts[id]?.destroy();
    charts[id] = new Chart(canvas, config);
}

function applyChartDefaults() {
    if (!window.Chart || Chart.defaults._cocStyled) return;
    Chart.defaults._cocStyled = true;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = cssVar('--muted');
    Chart.defaults.borderColor = cssVar('--grid');
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = false;
    Object.assign(Chart.defaults.plugins.tooltip, {
        backgroundColor: '#1d222c', borderColor: '#373d4a', borderWidth: 1, titleColor: '#eceef2',
        bodyColor: '#b3bac6', padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true
    });
    Chart.defaults.interaction = { mode: 'index', intersect: false };
}

const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtMonth = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
const isoOf = (cocDate) => `${cocDate.slice(0, 4)}-${cocDate.slice(4, 6)}-${cocDate.slice(6, 8)}`;
const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
const empty = (msg) => `<p class="empty-state">${msg}</p>`;

/** Monday (UTC) of the week containing an ISO date. */
function weekStart(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
}

/** Filter utility for the time-range dropdown. */
function filterHistoryByRange(wars, range) {
    const now = new Date();
    const since = (days) => new Date(now.getTime() - days * 86400000);
    const list = wars.filter(w => w.state !== 'preparation');
    if (range === 'month') {
        const ym = now.toISOString().slice(0, 7).replace('-', '');
        return list.filter(w => w.startTime.slice(0, 6) === ym);
    }
    if (range === 'week') return list.filter(w => parseCoCDate(w.startTime) >= since(7));
    if (range === '30d') return list.filter(w => parseCoCDate(w.startTime) >= since(30));
    if (range === '90d') return list.filter(w => parseCoCDate(w.startTime) >= since(90));
    if (range === 'prev') {
        return list.filter(w => isFinished(w, now)).sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, 1);
    }
    return list;
}

/** Per-member attack tallies over a set of wars. */
function attackStats(wars) {
    const map = {};
    for (const war of wars) {
        // Misses only count when we saw the war end; otherwise the last snapshot may predate final attacks.
        const finished = war.state === 'warEnded';
        for (const m of war.clan?.members || []) {
            const p = map[m.tag] ??= { tag: m.tag, name: m.name, wars: 0, used: 0, available: 0, s3: 0, s2: 0, s1: 0, s0: 0, stars: 0, destruction: 0 };
            p.name = m.name;
            p.wars++;
            const atks = m.attacks || [];
            p.used += atks.length;
            // Unused attacks only count as missed once the war is over.
            p.available += finished ? (war.attacksPerMember || 2) : atks.length;
            for (const a of atks) {
                p.stars += a.stars;
                p.destruction += a.destructionPercentage;
                p[`s${a.stars}`]++;
            }
        }
    }
    return Object.values(map);
}

function membersDelta(history, days) {
    const daily = history?.clanDaily || [];
    if (daily.length === 0) return null;
    const last = daily[daily.length - 1];
    const cutoff = new Date(Date.parse(`${last.date}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    const base = daily.find(d => d.date >= cutoff) || daily[0];
    return { now: last.member_count, delta: last.member_count - base.member_count, since: base.date };
}

function kpi(label, value, sub = '', subClass = '') {
    return `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p>${sub ? `<p class="kpi-sub ${subClass}">${sub}</p>` : ''}</div>`;
}

const signed = (n) => n > 0 ? `+${n}` : `${n}`;

/**
 * Overview tab: a compact row of headline numbers.
 */
export function renderOverviewKpis(ctx) {
    applyChartDefaults();
    const el = document.getElementById('overviewKpis');
    if (!el) return;
    const { wars = [], raids = [], history, members = [] } = ctx;
    const tiles = [];

    const md = membersDelta(history, 30);
    tiles.push(kpi('Members', md ? md.now : members.length,
        md ? `${signed(md.delta)} in last 30 days` : '', md && md.delta < 0 ? 'delta-down' : md && md.delta > 0 ? 'delta-up' : ''));

    const live = wars.find(w => !isFinished(w) && w.state !== 'notInWar');
    const lastDone = wars.find(w => isFinished(w));
    if (live) {
        const label = live.state === 'preparation' ? 'Preparation day' : 'War in progress';
        tiles.push(kpi(label, `${live.clan.stars} – ${live.opponent.stars}`, `vs ${esc(live.opponent.name)}`));
    } else if (lastDone) {
        const r = warResult(lastDone);
        tiles.push(kpi('Last war', r === 'victory' ? 'Victory' : r === 'loss' ? 'Defeat' : 'Draw',
            `${lastDone.clan.stars} – ${lastDone.opponent.stars} vs ${esc(lastDone.opponent.name)}`));
    }

    const recent = wars.filter(w => isFinished(w)).slice(0, 10);
    if (recent.length) {
        const wins = recent.filter(w => warResult(w) === 'victory').length;
        tiles.push(kpi('Recent form', `${wins} / ${recent.length}`, `wins in last ${recent.length} wars`));
    }

    const raid = raids.find(r => r.state === 'ended') || raids[0];
    if (raid) {
        tiles.push(kpi('Capital gold', (raid.capitalTotalLoot || 0).toLocaleString(),
            `${raid.state === 'ongoing' ? 'this' : 'last'} raid weekend · ${(raid.members || []).length} raiders`));
    }
    el.innerHTML = tiles.join('');
}

/**
 * Reports tab entry point.
 */
export function renderCharts(ctx, range = 'all') {
    applyChartDefaults();
    const wars = filterHistoryByRange(ctx.wars || [], range);
    renderReportKpis(ctx, wars);
    renderMembership(ctx.history);
    renderRosterEvents(ctx.history);
    renderWarRecord(ctx.wars || [], ctx.history?.warlog || []);
    renderThDistribution(ctx.members || []);
    renderStarsTrend(wars);
    renderReliability(wars, ctx.members || []);
    renderTopPerformers(wars);
    renderEfficiencyChart(wars);
    renderDonations(ctx.members || []);
    renderRaidTrend(ctx.raids || []);
}

function renderReportKpis(ctx, wars) {
    const el = document.getElementById('reportKpis');
    if (!el) return;
    const finished = wars.filter(w => isFinished(w));
    const wins = finished.filter(w => warResult(w) === 'victory').length;
    const stats = attackStats(wars);
    const used = stats.reduce((s, p) => s + p.used, 0);
    const stars = stats.reduce((s, p) => s + p.stars, 0);
    const triples = stats.reduce((s, p) => s + p.s3, 0);
    const missed = stats.reduce((s, p) => s + (p.available - p.used), 0);
    const events30 = (ctx.history?.events || []).filter(e => Date.parse(e.date) > Date.now() - 30 * 86400000);
    const joins = events30.filter(e => e.type === 'join').length;
    const leaves = events30.length - joins;

    el.innerHTML = [
        kpi('Win rate', finished.length ? `${pct(wins, finished.length)}%` : '—', `${wins} of ${finished.length} finished wars`),
        kpi('Avg stars / attack', used ? (stars / used).toFixed(2) : '—', `${used} attacks`),
        kpi('3★ rate', used ? `${pct(triples, used)}%` : '—', `${triples} triples`),
        kpi('Missed attacks', missed, finished.length ? `${(missed / finished.length).toFixed(1)} per war` : '', missed > 0 ? 'delta-down' : ''),
        kpi('Roster churn (30d)', `${joins + leaves}`, `${joins} joined · ${leaves} left`)
    ].join('');
}

function renderMembership(history) {
    const daily = history?.clanDaily || [];
    if (daily.length === 0) return;
    const good = cssVar('--good'), bad = cssVar('--critical'), blue = cssVar('--series-1');

    draw('membershipChart', {
        type: 'line',
        data: {
            labels: daily.map(d => fmtDay(d.date)),
            datasets: [{
                label: 'Members', data: daily.map(d => d.member_count), borderColor: blue, borderWidth: 2,
                backgroundColor: 'rgba(57, 135, 229, 0.12)', fill: true, tension: 0.25, pointRadius: 0, pointHoverRadius: 4, stepped: false
            }]
        },
        options: {
            scales: {
                y: { suggestedMin: Math.max(0, Math.min(...daily.map(d => d.member_count)) - 5), suggestedMax: 50, ticks: { precision: 0 } },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true } }
            }
        }
    });

    // Weekly joins (up) and departures (down) on one shared "people" axis.
    const weeks = new Map();
    for (const d of daily) weeks.set(weekStart(d.date), { join: 0, leave: 0 });
    for (const e of history.events || []) {
        const w = weeks.get(weekStart(e.date));
        if (w) w[e.type]++;
    }
    const keys = [...weeks.keys()];
    draw('churnChart', {
        type: 'bar',
        data: {
            labels: keys.map(k => `Wk of ${fmtDay(k)}`),
            datasets: [
                { label: 'Joined', data: keys.map(k => weeks.get(k).join), backgroundColor: good, borderRadius: 3, stack: 's' },
                { label: 'Left', data: keys.map(k => -weeks.get(k).leave), backgroundColor: bad, borderRadius: 3, stack: 's' }
            ]
        },
        options: {
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.abs(c.raw)}` } } },
            scales: {
                y: { stacked: true, ticks: { count: 5, precision: 0, callback: (v) => Math.abs(v) } },
                x: { stacked: true, grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

function renderRosterEvents(history) {
    const el = document.getElementById('rosterEvents');
    if (!el) return;
    const events = [...(history?.events || [])].reverse().slice(0, 40);
    if (events.length === 0) { el.innerHTML = empty('No roster changes recorded yet.'); return; }
    el.innerHTML = events.map(e => `
        <div class="event-row">
            <span class="event-badge ${e.type}">${e.type === 'join' ? 'Joined' : 'Left'}</span>
            <img src="${getTHImage(e.townHall)}" class="w-6 h-6 object-contain" alt="TH${e.townHall}">
            <span class="flex-1 min-w-0 truncate text-gray-200 font-semibold cursor-pointer hover:text-gold" data-player-tag="${esc(e.tag)}">${esc(e.name)}</span>
            <span class="text-gray-500 tabular-nums">${fmtDay(e.date)}</span>
        </div>`).join('');
}

function renderWarRecord(wars, warlog) {
    // Prefer the API war log (covers every public war); add tracked wars it lacks.
    const byEnd = new Map();
    for (const w of warlog) if (w.result) byEnd.set(w.endTime, w.result === 'win' ? 'victory' : w.result === 'lose' ? 'loss' : 'draw');
    for (const w of wars) if (isFinished(w) && !byEnd.has(w.endTime)) byEnd.set(w.endTime, warResult(w));

    const months = new Map();
    for (const [end, result] of [...byEnd].sort((a, b) => a[0].localeCompare(b[0]))) {
        const ym = `${end.slice(0, 4)}-${end.slice(4, 6)}`;
        const m = months.get(ym) || { victory: 0, loss: 0, draw: 0 };
        m[result]++;
        months.set(ym, m);
    }
    const keys = [...months.keys()].slice(-12);
    const ds = (label, key, color) => ({ label, data: keys.map(k => months.get(k)[key]), backgroundColor: color, borderRadius: 3, borderColor: cssVar('--panel'), borderWidth: { top: 2 }, borderSkipped: false });
    draw('warRecordChart', {
        type: 'bar',
        data: {
            labels: keys.map(fmtMonth),
            datasets: [ds('Wins', 'victory', cssVar('--good')), ds('Losses', 'loss', cssVar('--critical')), ds('Draws', 'draw', cssVar('--neutral'))]
        },
        options: {
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } }
        }
    });
}

function renderThDistribution(members) {
    const el = document.getElementById('thDistribution');
    if (!el) return;
    const counts = {};
    for (const m of members) counts[m.townHallLevel] = (counts[m.townHallLevel] || 0) + 1;
    const levels = Object.keys(counts).map(Number).sort((a, b) => b - a);
    const max = Math.max(...Object.values(counts), 1);
    el.innerHTML = levels.map(th => `
        <div class="flex items-center gap-3 py-1.5">
            <img src="${getTHImage(th)}" class="w-7 h-7 object-contain" alt="">
            <span class="w-10 text-xs font-semibold text-gray-300">TH${th}</span>
            <div class="bar-track flex-1"><div class="bar-fill" style="width:${counts[th] / max * 100}%"></div></div>
            <span class="w-6 text-right text-xs font-semibold text-gray-200 tabular-nums">${counts[th]}</span>
        </div>`).join('') || empty('No roster data.');
}

function renderStarsTrend(wars) {
    const finished = wars.filter(w => isFinished(w)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const gold = cssVar('--gold');
    draw('starsTrendChart', {
        type: 'line',
        data: {
            labels: finished.map(w => fmtDay(isoOf(w.startTime))),
            datasets: [{
                label: 'Stars won', data: finished.map(w => +(w.clan.stars / ((w.teamSize || 1) * 3) * 100).toFixed(1)),
                borderColor: gold, borderWidth: 2, backgroundColor: 'rgba(233, 185, 73, 0.10)', fill: true, tension: 0.3,
                pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: gold,
                opponents: finished.map(w => w.opponent.name)
            }]
        },
        options: {
            scales: { y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0 } } },
            plugins: { tooltip: { callbacks: {
                title: (items) => `${items[0].label} · vs ${items[0].dataset.opponents[items[0].dataIndex]}`,
                label: (c) => `Stars won: ${c.raw}%`
            } } }
        }
    });
}

function renderReliability(wars, roster) {
    const el = document.getElementById('reliabilityTable');
    if (!el) return;
    const current = new Set(roster.map(m => m.tag));
    const rows = attackStats(wars).filter(p => p.available > 0)
        .sort((a, b) => (b.available - b.used) - (a.available - a.used) || a.used / a.available - b.used / b.available || a.name.localeCompare(b.name));
    if (rows.length === 0) { el.innerHTML = empty('No wars in this range.'); return; }
    el.innerHTML = `<div style="max-height: 360px; overflow-y: auto;"><table class="data-table">
        <thead><tr><th>Player</th><th class="num">Wars</th><th class="num">Attacks</th><th class="num">Missed</th><th style="width:30%">Usage</th></tr></thead>
        <tbody>${rows.map(p => {
            const rate = pct(p.used, p.available);
            const missed = p.available - p.used;
            return `<tr>
                <td><span class="player" data-player-tag="${esc(p.tag)}">${esc(p.name)}</span>${current.has(p.tag) ? '' : ' <span class="pill">former</span>'}</td>
                <td class="num">${p.wars}</td>
                <td class="num">${p.used} / ${p.available}</td>
                <td class="num ${missed ? 'delta-down font-semibold' : ''}">${missed}</td>
                <td><div class="flex items-center gap-2"><div class="bar-track flex-1"><div class="bar-fill" style="width:${rate}%; background:${rate < 75 ? 'var(--critical)' : rate < 100 ? 'var(--warning)' : 'var(--good)'}"></div></div><span class="w-9 text-right">${rate}%</span></div></td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
}

function renderTopPerformers(wars) {
    const container = document.getElementById('topPerformersContainer');
    if (!container) return;
    const top = attackStats(wars).filter(p => p.used > 0).sort((a, b) => b.stars - a.stars || b.s3 - a.s3).slice(0, 25);
    if (top.length === 0) { container.innerHTML = empty('No attack data for this range.'); return; }
    container.innerHTML = `<div style="max-height: 360px; overflow-y: auto;"><table class="data-table">
        <thead><tr><th>Player</th><th class="num">3★</th><th class="num">2★</th><th class="num">1★</th><th class="num">0★</th><th class="num">Total</th></tr></thead>
        <tbody>${top.map(p => `<tr>
            <td><span class="player" data-player-tag="${esc(p.tag)}">${esc(p.name)}</span></td>
            <td class="num">${p.s3}</td><td class="num">${p.s2}</td><td class="num">${p.s1}</td><td class="num">${p.s0}</td>
            <td class="num gold font-bold">${p.stars}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderEfficiencyChart(wars) {
    const top = attackStats(wars).filter(p => p.used > 0)
        .sort((a, b) => (b.s3 / b.used) - (a.s3 / a.used) || b.used - a.used).slice(0, 25);
    const container = document.getElementById('efficiencyContainer');
    if (top.length === 0) { charts.efficiencyChart?.destroy(); if (container) container.style.height = '0px'; return; }
    if (container) container.style.height = `${top.length * 24 + 40}px`;
    const panel = cssVar('--panel');
    const ds = (label, key, color) => ({
        label, data: top.map(p => +(p[key] / p.used * 100).toFixed(1)), backgroundColor: color,
        borderColor: panel, borderWidth: { right: 2 }, borderSkipped: false, barPercentage: 0.8
    });
    draw('efficiencyChart', {
        type: 'bar',
        data: {
            labels: top.map(p => p.name),
            datasets: [ds('3★', 's3', cssVar('--star-3')), ds('2★', 's2', cssVar('--star-2')), ds('1★', 's1', cssVar('--star-1')), ds('0★', 's0', cssVar('--star-0'))]
        },
        options: {
            indexAxis: 'y',
            interaction: { mode: 'index', axis: 'y', intersect: false },
            scales: {
                x: { stacked: true, min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
                y: { stacked: true, grid: { display: false }, ticks: { color: cssVar('--text-2'), font: { weight: 600 } } }
            },
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw}%` } } }
        }
    });
}

function renderDonations(members) {
    const el = document.getElementById('donationsTable');
    if (!el) return;
    const top = [...members].filter(m => m.donations > 0).sort((a, b) => b.donations - a.donations).slice(0, 15);
    if (top.length === 0) { el.innerHTML = empty('No donations yet this season.'); return; }
    const max = top[0].donations;
    el.innerHTML = `<table class="data-table">
        <thead><tr><th>Player</th><th style="width:35%">Donated</th><th class="num">Received</th><th class="num">Ratio</th></tr></thead>
        <tbody>${top.map(m => `<tr>
            <td><span class="player" data-player-tag="${esc(m.tag)}">${esc(m.name)}</span></td>
            <td><div class="flex items-center gap-2"><div class="bar-track flex-1"><div class="bar-fill" style="width:${m.donations / max * 100}%"></div></div><span class="w-12 text-right tabular-nums">${m.donations.toLocaleString()}</span></div></td>
            <td class="num">${m.donationsReceived.toLocaleString()}</td>
            <td class="num">${m.donationsReceived ? (m.donations / m.donationsReceived).toFixed(1) : '∞'}</td></tr>`).join('')}</tbody></table>`;
}

function renderRaidTrend(raids) {
    const list = [...raids].sort((a, b) => a.startTime.localeCompare(b.startTime));
    draw('raidTrendChart', {
        type: 'bar',
        data: {
            labels: list.map(r => fmtDay(isoOf(r.startTime))),
            datasets: [{
                label: 'Capital gold', data: list.map(r => r.capitalTotalLoot || 0), backgroundColor: cssVar('--series-1'),
                borderRadius: 4, maxBarThickness: 36, raiders: list.map(r => (r.members || []).length), attacks: list.map(r => r.totalAttacks || 0)
            }]
        },
        options: {
            scales: { y: { ticks: { callback: (v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v } }, x: { grid: { display: false } } },
            plugins: { tooltip: { callbacks: {
                label: (c) => `Capital gold: ${c.raw.toLocaleString()}`,
                afterLabel: (c) => `${c.dataset.raiders[c.dataIndex]} raiders · ${c.dataset.attacks[c.dataIndex]} attacks`
            } } }
        }
    });
}
