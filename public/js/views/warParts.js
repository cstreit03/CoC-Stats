/**
 * War building blocks shared by Overview, Wars and War detail.
 */
import { esc, parseCoc, warPhase, countdown, fmtDate, num, resultLabel, scoreResult } from '../util.js';
import { predictWar } from '../predict.js';
import { store } from '../store.js';

export function phaseBadge(phase, kind, round) {
    const cwl = kind === 'cwl' ? `<span class="badge gold">CWL${round ? ` · Round ${round}` : ''}</span>` : '';
    const map = {
        preparation: '<span class="badge prep">Preparation day</span>',
        inWar: '<span class="badge live"><span class="dot live" aria-hidden="true"></span>Battle day</span>',
        ended: '<span class="badge">Ended</span>',
        unconfirmed: '<span class="badge warn" title="The last snapshot was taken before the war ended.">Final not captured</span>'
    };
    return `<span class="row-wrap">${cwl}${map[phase] || ''}</span>`;
}

export function resultBadge(result) {
    return result ? `<span class="badge ${result}">${resultLabel[result]}</span>` : '';
}

/** Scoreboard card for one war. Countdown elements update via startCountdowns(). */
export function warHero(war, { link = true, title = '' } = {}) {
    const phase = warPhase(war);
    const total = war.teamSize * (war.attacksPerMember || 2);
    const target = phase === 'preparation' ? parseCoc(war.startTime) : phase === 'inWar' ? parseCoc(war.endTime) : null;
    const res = phase === 'ended' ? scoreResult(war.clan.stars, war.opponent.stars, war.clan.destructionPercentage, war.opponent.destructionPercentage) : null;
    const scoreClass = res === 'win' ? 'up' : res === 'loss' ? 'down' : '';
    const label = phase === 'preparation' ? 'Battle starts in' : 'Ends in';

    return `<section class="card war-hero" aria-label="${esc(title || `War against ${war.opponent.name}`)}">
        <div class="war-hero-top">
            <div class="row-wrap">${phaseBadge(phase, war.kind, war.round)}${resultBadge(res)}</div>
            <span class="countdown">${target ? `${label} <span data-countdown="${target.getTime()}">${countdown(target)}</span>` : fmtDate(parseCoc(war.endTime))}</span>
        </div>
        <div class="scoreboard">
            <div class="team">
                <img src="${war.clan.badgeUrls?.small}" alt="">
                <div class="min-w-0"><p class="team-name">${esc(war.clan.name)}</p><p class="team-sub">${war.clan.attacks || 0}/${total} attacks</p></div>
            </div>
            <div class="score">
                <p class="score-num ${scoreClass}" aria-label="Score ${war.clan.stars} to ${war.opponent.stars}">${war.clan.stars}<span class="muted" style="color:var(--muted)"> – </span>${war.opponent.stars}</p>
                <p class="score-sub">${num(war.clan.destructionPercentage, 1)}% · ${num(war.opponent.destructionPercentage, 1)}%</p>
                <p class="score-sub">${war.teamSize} v ${war.teamSize}</p>
            </div>
            <div class="team right">
                <img src="${war.opponent.badgeUrls?.small}" alt="">
                <div class="min-w-0"><p class="team-name">${esc(war.opponent.name)}</p><p class="team-sub">${war.opponent.attacks || 0}/${total} attacks</p></div>
            </div>
        </div>
        ${phase === 'preparation' || phase === 'inWar' ? `<div class="prob" data-prediction="${esc(war.id)}"><p class="note">Calculating win probability…</p></div>` : ''}
        ${link ? `<div class="prob" style="padding-top:0;border-top:0"><a class="btn" href="#/wars/${encodeURIComponent(war.id)}">Open war details</a></div>` : ''}
    </section>`;
}

/** Fills [data-prediction] placeholders after first paint (the simulation takes a moment). */
export function fillPredictions(root, { detailed = false } = {}) {
    const slots = root.querySelectorAll('[data-prediction]');
    if (!slots.length) return;
    setTimeout(() => {
        for (const slot of slots) {
            const war = store.wars.find(w => w.id === slot.dataset.prediction);
            if (!war || !slot.isConnected) continue;
            const p = predictWar(war, store.wars, { sims: war.teamSize > 30 ? 1200 : 2000 });
            slot.innerHTML = p ? predictionHtml(p, war, detailed) : '';
        }
    }, 30);
}

export function predictionHtml(p, war, detailed) {
    const pc = (x) => `${Math.round(x * 100)}%`;
    const verdict = { win: 'Likely win', loss: 'Likely loss', draw: 'Likely draw' }[p.outcome];
    const phase = warPhase(war);
    return `<div class="row" style="justify-content:space-between;margin-bottom:8px">
            <p class="card-title" style="font-size:15px">${verdict} <span class="muted" style="color:var(--muted);font-weight:500">· ${pc(Math.max(p.pWin, p.pDraw, p.pLoss))}</span></p>
            <p class="note">Projected ${Math.round(p.us.mean)}–${Math.round(p.them.mean)} stars</p>
        </div>
        <div class="prob-bar" role="img" aria-label="Win ${pc(p.pWin)}, draw ${pc(p.pDraw)}, loss ${pc(p.pLoss)}">
            ${p.pWin > 0.005 ? `<span class="w" style="width:${p.pWin * 100}%"></span>` : ''}
            ${p.pDraw > 0.005 ? `<span class="d" style="width:${p.pDraw * 100}%"></span>` : ''}
            ${p.pLoss > 0.005 ? `<span class="l" style="width:${p.pLoss * 100}%"></span>` : ''}
        </div>
        <div class="prob-legend" aria-hidden="true">
            <span><i style="background:var(--chart-good)"></i>Win <b>${pc(p.pWin)}</b></span>
            <span><i style="background:var(--chart-neutral)"></i>Draw <b>${pc(p.pDraw)}</b></span>
            <span><i style="background:var(--chart-bad)"></i>Loss <b>${pc(p.pLoss)}</b></span>
        </div>
        ${detailed ? `
        <details class="disclosure" style="margin-top:12px">
            <summary>How this is calculated</summary>
            <div class="stack" style="gap:10px">
                <p class="note">Every remaining attack is simulated ${war.teamSize > 30 ? '1,200' : '2,000'} times. Each attack's stars depend on the attacker's skill, the Town Hall gap to the target and how often that side uses its attacks. Every run also draws each clan's form from its recent wars, so good and bad days (and perfect clears that end in draws) show up as often as they really happen. Stars already on the board are kept${phase === 'preparation' ? ' (none yet: it’s preparation day)' : ''}.</p>
                <div class="table-wrap"><table class="table">
                    <thead><tr><th scope="col"></th><th scope="col" class="num">Us</th><th scope="col" class="num">Opponent</th></tr></thead>
                    <tbody>
                        <tr><td>Skill (expected stars vs. equal TH)</td><td class="num">${p.inputs.ourSkill.toFixed(2)}</td><td class="num">${p.inputs.theirSkill.toFixed(2)}</td></tr>
                        <tr><td>Attack usage</td><td class="num">${pc(p.inputs.ourUsage)}</td><td class="num">${pc(p.inputs.theirUsage)}</td></tr>
                        <tr><td>Average Town Hall</td><td class="num">${p.inputs.ourAvgTh.toFixed(1)}</td><td class="num">${p.inputs.theirAvgTh.toFixed(1)}</td></tr>
                        <tr><td>Projected stars (80% range)</td><td class="num">${Math.round(p.us.mean)} (${p.us.lo}–${p.us.hi})</td><td class="num">${Math.round(p.them.mean)} (${p.them.lo}–${p.them.hi})</td></tr>
                        <tr><td>Projected destruction</td><td class="num">${p.us.dest.toFixed(1)}%</td><td class="num">${p.them.dest.toFixed(1)}%</td></tr>
                    </tbody>
                </table></div>
                <p class="note"><b>Us:</b> ${esc(p.inputs.ourSource)}${p.inputs.ourAttacksTracked ? `; each member adjusted up or down by their tracked attacks (${p.inputs.ourAttacksTracked} so far), allowing for the Town Halls they hit` : ''}. <b>Opponent:</b> ${esc(p.inputs.theirSource)}, refined by attacks they make in this war.</p>
            </div>
        </details>` : ''}`;
}

/** Ticks every [data-countdown] once a second; returns a stop function. */
export function startCountdowns(root) {
    const tick = () => root.querySelectorAll('[data-countdown]').forEach(el => {
        el.textContent = countdown(new Date(+el.dataset.countdown));
    });
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
}

/** One line of war history (links to detail when we tracked the war). */
export function warRow(e) {
    const date = fmtDate(parseCoc(e.endTime));
    // War-log CWL entries are whole-season totals, not single wars.
    const opp = e.opponent?.name ? esc(e.opponent.name) : (e.kind === 'cwl' ? 'CWL season total' : 'Unknown');
    const status = e.phase === 'preparation' || e.phase === 'inWar' ? phaseBadge(e.phase) : resultBadge(e.result) || (e.phase === 'unconfirmed' ? '<span class="badge warn">Unconfirmed</span>' : '');
    const inner = `
        <img class="th-sm" src="${e.opponent?.badgeUrls?.small || ''}" alt="" ${e.opponent?.badgeUrls?.small ? '' : 'style="visibility:hidden"'}>
        <div class="li-main">
            <p class="li-title">${opp}</p>
            <p class="li-sub">${date} · ${e.teamSize} v ${e.teamSize}${e.kind === 'cwl' ? (e.id ? ` · CWL${e.round ? ` R${e.round}` : ''}` : ' · all 7 rounds') : ''}</p>
        </div>
        <div class="result-col">
            <p class="war-score">${e.clanStars ?? '—'} – ${e.oppStars ?? '—'}</p>
            <div style="margin-top:2px">${status}</div>
        </div>`;
    return e.id ? `<a class="war-row" href="#/wars/${encodeURIComponent(e.id)}">${inner}</a>` : `<div class="war-row">${inner}</div>`;
}
