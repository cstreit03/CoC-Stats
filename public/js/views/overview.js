/**
 * Overview: headline numbers, the current war, recent results and the clan profile.
 */
import { store, members } from '../store.js';
import { esc, num, signed, warPhase, fmtDay } from '../util.js';
import { kpi, noDataMessage } from '../ui.js';
import { warHistory, record, membershipDelta } from '../stats.js';
import { chart, lineConfig, cssVar } from '../charts.js';
import { warHero, warRow, fillPredictions, startCountdowns } from './warParts.js';

export function render(root) {
    const c = store.clan;
    if (!c) { root.innerHTML = `<h1 class="sr-only">Overview</h1>${noDataMessage()}`; return; }

    const history = warHistory();
    const active = store.wars.filter(w => ['preparation', 'inWar'].includes(warPhase(w)));
    const recent = history.filter(e => e.result).slice(0, 10);
    const form = record(recent);
    const md = membershipDelta(30);
    const raid = store.raids.find(r => r.state === 'ended') || store.raids[0];
    const total = (c.warWins || 0) + (c.warLosses || 0) + (c.warTies || 0);

    root.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Overview</h1><p class="page-sub">${esc(c.name)} · ${esc(c.warLeague?.name || 'Unranked')}</p></div>
        </div>
        <div class="stack">
            <div class="kpis">
                ${kpi('Members', `${members().length}<span class="muted" style="font-size:16px;font-weight:600"> / 50</span>`, md ? `${signed(md.delta)} in the last 30 days` : '', md?.delta < 0 ? 'down' : md?.delta > 0 ? 'up' : '')}
                ${kpi('Recent form', recent.length ? `${form.win}–${form.loss}${form.draw ? `–${form.draw}` : ''}` : '—', recent.length ? `last ${recent.length} wars (W–L${form.draw ? '–D' : ''})` : '')}
                ${kpi('All-time wins', num(c.warWins), total ? `${Math.round(c.warWins / total * 100)}% win rate · ${c.warWinStreak || 0} streak` : '')}
                ${kpi('Capital gold', raid ? num(raid.capitalTotalLoot) : '—', raid ? `${raid.state === 'ongoing' ? 'this' : 'last'} raid weekend` : '')}
            </div>

            ${active.map(w => warHero(w, { title: 'Current war' })).join('')}

            <div class="grid-3">
                <section class="card span-2" aria-labelledby="recent-h">
                    <div class="card-head"><div><h2 class="card-title" id="recent-h">Recent wars</h2><p class="card-sub">Results include the clan's public war log.</p></div>
                    <a class="btn" href="#/wars">All wars</a></div>
                    <div class="list">${history.filter(e => e.phase === 'ended' || e.phase === 'unconfirmed').slice(0, 6).map(warRow).join('') || '<p class="empty">No wars recorded yet.</p>'}</div>
                </section>
                <section class="card" aria-labelledby="members-h">
                    <div class="card-head"><div><h2 class="card-title" id="members-h">Membership</h2><p class="card-sub">Members per day</p></div>
                    <a class="btn" href="#/reports/membership">Report</a></div>
                    <div class="chart-box sm"><canvas id="ovMembers" aria-label="Member count over time"></canvas></div>
                </section>
            </div>

            <div class="grid-3">
                <section class="card span-2" aria-labelledby="about-h">
                    <h2 class="card-title" id="about-h" style="margin-bottom:10px">About ${esc(c.name)}</h2>
                    <p class="desc">${esc(c.description || '')}</p>
                    <div class="labels" style="margin-top:12px">${(c.labels || []).map(l => `<span class="badge"><img src="${l.iconUrls?.small}" alt="">${esc(l.name)}</span>`).join('')}</div>
                    <dl class="dl" style="margin-top:16px">
                        <div><dt>Location</dt><dd>${esc(c.location?.name || '—')}</dd></div>
                        <div><dt>Language</dt><dd>${esc(c.chatLanguage?.name || '—')}</dd></div>
                        <div><dt>War frequency</dt><dd>${esc(c.warFrequency || '—')}</dd></div>
                        <div><dt>Family friendly</dt><dd>${c.isFamilyFriendly ? 'Yes' : 'No'}</dd></div>
                    </dl>
                </section>
                <section class="card" aria-labelledby="req-h">
                    <h2 class="card-title" id="req-h" style="margin-bottom:12px">Clan details</h2>
                    <dl class="dl">
                        <div><dt>War league</dt><dd>${esc(c.warLeague?.name || '—')}</dd></div>
                        <div><dt>Capital league</dt><dd>${esc(c.capitalLeague?.name || '—')}</dd></div>
                        <div><dt>Capital hall</dt><dd>Level ${c.clanCapital?.capitalHallLevel ?? '—'}</dd></div>
                        <div><dt>Clan points</dt><dd>${num(c.clanPoints)}</dd></div>
                        <div><dt>Min. Town Hall</dt><dd>TH${c.requiredTownhallLevel ?? '—'}</dd></div>
                        <div><dt>Required trophies</dt><dd>${num(c.requiredTrophies)}</dd></div>
                    </dl>
                </section>
            </div>
        </div>`;

    const daily = store.history?.clanDaily || [];
    if (daily.length > 1) {
        chart(root.querySelector('#ovMembers'), lineConfig(daily.map(d => fmtDay(d.date)), daily.map(d => d.member_count),
            { label: 'Members', color: cssVar('--series-1') }));
    } else {
        root.querySelector('#ovMembers').parentElement.innerHTML = '<p class="empty">The chart fills in as daily snapshots are collected.</p>';
    }

    fillPredictions(root);
    return startCountdowns(root);
}
