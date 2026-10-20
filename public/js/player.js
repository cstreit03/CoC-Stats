/**
 * Player profile drawer: tenure, war/raid/donation stats and history for one member.
 */
import { fetchPlayer } from './api.js';
import { roleMap, getTHImage, esc, parseCoCDate } from './constants.js';

let chart = null;

export function closePlayer() {
    document.getElementById('playerModal')?.classList.add('hidden');
    document.body.style.overflow = '';
}

const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function tile(label, value, sub = '') {
    return `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value" style="font-size:20px">${value}</p>${sub ? `<p class="kpi-sub">${sub}</p>` : ''}</div>`;
}

export async function openPlayer(tag, ctx) {
    const modal = document.getElementById('playerModal');
    const content = document.getElementById('playerContent');
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<p class="empty-state">Loading…</p>';

    let daily = [];
    try { daily = (await fetchPlayer(tag)).daily || []; } catch (e) { console.warn('player history', e); }

    const current = (ctx.members || []).find(m => m.tag === tag);
    const last = daily[daily.length - 1];
    const name = current?.name || last?.name || tag;
    const th = current?.townHallLevel || last?.town_hall;
    const role = current?.role || last?.role;
    const joined = ctx.history?.joinedAt?.[tag];

    // War attacks across every tracked war (regular + CWL).
    const attacks = [];
    let wars = 0, available = 0;
    for (const war of ctx.wars || []) {
        const m = war.clan?.members?.find(x => x.tag === tag);
        if (!m) continue;
        wars++;
        available += war.state === 'warEnded' ? (war.attacksPerMember || 2) : (m.attacks || []).length;
        for (const a of m.attacks || []) attacks.push({ ...a, war });
    }
    const stars = attacks.reduce((s, a) => s + a.stars, 0);
    const triples = attacks.filter(a => a.stars === 3).length;

    let raidGold = 0, raidWeekends = 0;
    for (const raid of ctx.raids || []) {
        const r = (raid.members || []).find(x => x.tag === tag);
        if (r) { raidGold += r.capitalResourcesLooted || 0; raidWeekends++; }
    }

    const recent = attacks.sort((a, b) => b.war.startTime.localeCompare(a.war.startTime) || b.order - a.order).slice(0, 12);

    content.innerHTML = `
        <div class="flex items-center gap-4 mb-5 pr-8">
            <img src="${getTHImage(th)}" class="w-14 h-14 object-contain" alt="TH${th}">
            <div class="min-w-0">
                <h2 class="text-xl font-bold text-white truncate">${esc(name)}</h2>
                <p class="text-xs text-gray-400 mt-0.5"><span class="font-mono">${esc(tag)}</span> · TH${th ?? '?'} · ${roleMap[role] || 'Former member'}</p>
                <p class="text-xs mt-1 ${current ? 'text-gray-400' : 'delta-down'}">${current
                    ? (joined ? (joined.beforeTracking ? `Member since before ${fmtDay(joined.date)}` : `Joined ${fmtDay(joined.date)}`) : '')
                    : (last ? `Left the clan · last seen ${fmtDay(last.date)}` : 'Not in recorded rosters')}</p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-6">
            ${tile('War attacks', `${attacks.length} / ${available}`, `${wars} wars · ${available - attacks.length} missed`)}
            ${tile('Avg stars', attacks.length ? (stars / attacks.length).toFixed(2) : '—', `${attacks.length ? Math.round(triples / attacks.length * 100) : 0}% three-star rate`)}
            ${tile('Capital gold', raidGold.toLocaleString(), `${raidWeekends} raid weekends`)}
            ${tile('Donations', (current?.donations ?? last?.donations ?? 0).toLocaleString(), `${(current?.donationsReceived ?? last?.donations_received ?? 0).toLocaleString()} received this season`)}
        </div>

        ${daily.length > 1 ? `
        <div class="report-card mb-6">
            <div class="report-head"><div><h3>Donations by day</h3><p>Season totals reset monthly.</p></div></div>
            <div style="height:160px"><canvas id="playerChart"></canvas></div>
        </div>` : ''}

        <div class="report-card">
            <div class="report-head"><div><h3>Recent war attacks</h3></div></div>
            ${recent.length === 0 ? '<p class="empty-state">No recorded attacks.</p>' : `
            <table class="data-table"><thead><tr><th>Date</th><th>Opponent</th><th class="num">Stars</th><th class="num">%</th></tr></thead>
            <tbody>${recent.map(a => `<tr>
                <td>${parseCoCDate(a.war.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${a.war.kind === 'cwl' ? ' <span class="pill gold">CWL</span>' : ''}</td>
                <td class="truncate" style="max-width:160px">${esc(a.war.opponent.name)}</td>
                <td class="num gold">${'★'.repeat(a.stars)}<span class="text-gray-700">${'★'.repeat(3 - a.stars)}</span></td>
                <td class="num">${a.destructionPercentage}%</td></tr>`).join('')}</tbody></table>`}
        </div>`;

    if (daily.length > 1 && window.Chart) {
        chart?.destroy();
        chart = new Chart(document.getElementById('playerChart'), {
            type: 'line',
            data: {
                labels: daily.map(d => new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })),
                datasets: [{ label: 'Donated', data: daily.map(d => d.donations), borderColor: '#3987e5', borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true, backgroundColor: 'rgba(57,135,229,0.12)' }]
            },
            options: { scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }, y: { beginAtZero: true } } }
        });
    }
}
