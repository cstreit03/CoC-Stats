/**
 * CWL scorecard: every lineup slot per round, scored with adjustable rules.
 * Used by the CWL tab and the Reports catalog. The Excel export keeps the
 * scoring live: weights sit on a "Scoring" sheet and every score is a formula.
 */
import { esc, thImg, starsHtml, fmtSeason, prefs } from '../util.js';
import { mountTable } from '../ui.js';
import { cwlAttackRows, cwlSummary, defaultWeights, weightLabels, scoreRow } from '../stats.js';
import { exportExcel, exportPdf } from '../export.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function scorecardHtml() {
    const w = prefs.get('cwlWeights', defaultWeights);
    return `
        <details class="disclosure no-print">
            <summary>Scoring rules</summary>
            <div class="stack" style="gap:12px">
                <p class="note">Each attack scores: stars × points + destruction × points + three-star bonus + TH levels attacked up × points. A missed attack (war ended, attack unused) adds the missed-attack value. Defense adds points per star conceded on the member's own base. Changes are saved in this browser and carried into the Excel export.</p>
                <div class="weights">${Object.keys(defaultWeights).map(k => `<label>${esc(weightLabels[k])}
                    <input class="input input-num" type="number" step="0.01" data-weight="${k}" value="${w[k] ?? defaultWeights[k]}"></label>`).join('')}</div>
                <div><button type="button" class="btn" data-reset-weights>Reset to defaults</button></div>
            </div>
        </details>
        <div id="cwlScoreTable"></div>`;
}

/** Wires the scorecard for `season` inside `root`. */
export function mountScorecard(root, season) {
    let weights = { ...defaultWeights, ...prefs.get('cwlWeights', defaultWeights) };
    const rounds = Math.max(...season.wars.filter(w => w.ours).map(w => w.round), 0);

    const columns = () => [
        { key: 'rank', label: '#', num: true, value: r => r.rank, sortable: false },
        { key: 'name', label: 'Player', sticky: true, value: r => r.name, render: r => `<div class="cell-player"><img src="${thImg(r.th)}" alt="TH${r.th}"><a class="player-link" href="#/members/${encodeURIComponent(r.tag.slice(1))}">${esc(r.name)}</a></div>` },
        ...Array.from({ length: rounds }, (_, i) => ({
            key: `r${i + 1}`, label: `R${i + 1}`, value: r => r.rounds[i + 1]?.score ?? null,
            render: r => {
                const x = r.rounds[i + 1];
                if (!x) return '<span class="muted">—</span>';
                if (x.missed) return '<span class="badge loss">Missed</span>';
                if (x.pending) return '<span class="badge prep">To attack</span>';
                return `<div class="cwl-cell">${starsHtml(x.stars)} ${x.destruction}%<div class="meta">#${x.defPos} TH${x.defTh}${x.thDiff ? ` (${x.thDiff > 0 ? '+' : ''}${x.thDiff})` : ''} · ${round2(x.score)} pts</div></div>`;
            }
        })),
        { key: 'attacks', label: 'Attacks', num: true, value: r => r.attacks, render: r => `${r.attacks}/${r.wars}` },
        { key: 'stars', label: 'Stars', num: true, value: r => r.stars },
        { key: 'triples', label: '3-star', num: true, value: r => r.triples },
        { key: 'avg', label: 'Avg %', num: true, value: r => r.avgDestruction, render: r => r.avgDestruction == null ? '—' : `${Math.round(r.avgDestruction)}%` },
        { key: 'missed', label: 'Missed', num: true, value: r => r.missed, render: r => r.missed ? `<span class="down">${r.missed}</span>` : '0' },
        { key: 'conceded', label: 'Def stars', num: true, value: r => r.conceded, title: 'Stars conceded on own base' },
        { key: 'score', label: 'Score', num: true, value: r => r.score, render: r => `<b>${round2(r.score)}</b>` }
    ];

    const tableEl = root.querySelector('#cwlScoreTable');
    let table = null;
    const compute = () => {
        const rows = cwlAttackRows(season, weights);
        const summary = cwlSummary(rows).map((p, i) => ({ ...p, rank: i + 1 }));
        return { rows, summary };
    };
    const draw = () => {
        const { summary } = compute();
        if (!summary.length) { tableEl.innerHTML = '<p class="empty">No attacks yet this season.</p>'; return; }
        if (!table) table = mountTable(tableEl, { columns: columns(), rows: summary, sort: { key: 'score', dir: 'desc' }, caption: 'CWL scorecard', limit: 15, noun: 'members' });
        else table.setRows(summary);
    };

    root.querySelectorAll('[data-weight]').forEach(input => input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (Number.isNaN(v)) return;
        weights = { ...weights, [input.dataset.weight]: v };
        prefs.set('cwlWeights', weights);
        draw();
    }));
    root.querySelector('[data-reset-weights]')?.addEventListener('click', () => {
        weights = { ...defaultWeights };
        prefs.set('cwlWeights', weights);
        root.querySelectorAll('[data-weight]').forEach(i => { i.value = weights[i.dataset.weight]; });
        draw();
    });
    draw();

    const title = `CWL scorecard ${season.season}`;
    return {
        xlsx: () => exportScorecardExcel(title, season, compute(), weights, rounds),
        pdf: () => {
            const { summary } = compute();
            const header = ['#', 'Player', 'TH', ...Array.from({ length: rounds }, (_, i) => `R${i + 1}`), 'Attacks', 'Stars', '3-star', 'Avg %', 'Missed', 'Def stars', 'Score'];
            const body = summary.map(p => [p.rank, p.name, p.th,
                ...Array.from({ length: rounds }, (_, i) => {
                    const x = p.rounds[i + 1];
                    return !x ? '' : x.missed ? 'MISS' : x.pending ? '…' : `${x.stars} star ${x.destruction}% #${x.defPos}`;
                }),
                `${p.attacks}/${p.wars}`, p.stars, p.triples, p.avgDestruction == null ? '' : Math.round(p.avgDestruction), p.missed, p.conceded, round2(p.score)]);
            const rules = Object.keys(defaultWeights).map(k => `${weightLabels[k]}: ${weights[k]}`).join(' · ');
            return exportPdf(title, `${fmtSeason(season.season)} · ${rules}`, [{ header, body }]);
        }
    };
}

/**
 * Workbook: Scoring (editable weights), Attacks (one row per lineup slot, score is
 * a formula) and Summary (per-member SUMIFS/COUNTIFS over Attacks).
 */
function exportScorecardExcel(title, season, { rows, summary }, weights, rounds) {
    const keys = Object.keys(defaultWeights);
    const wRef = Object.fromEntries(keys.map((k, i) => [k, `Scoring!$B$${i + 2}`]));

    const attackHeader = ['Player', 'Tag', 'TH', 'Round', 'Opponent clan', 'Map pos', 'Target pos', 'Target TH', 'TH diff', 'Stars', 'Destruction %', 'Three-star', 'Missed', 'Stars conceded', 'Score'];
    const attackBody = rows.map((r, i) => {
        const n = i + 2;
        return [r.name, r.tag, r.th, r.round, r.opponent, r.mapPos, r.defPos ?? '', r.defTh ?? '', r.thDiff ?? '',
            r.stars ?? '', r.destruction ?? '', r.triple, r.missed, r.conceded,
            { f: `N(J${n})*${wRef.star}+N(K${n})*${wRef.destruction}+L${n}*${wRef.triple}+N(I${n})*${wRef.thDiff}+M${n}*${wRef.missed}+N${n}*${wRef.conceded}`, v: round2(scoreRow(r, weights)) }];
    });
    const last = rows.length + 1;
    const A = (col) => `Attacks!$${col}$2:$${col}$${last}`;

    const summaryHeader = ['Rank', 'Player', 'Tag', 'TH', ...Array.from({ length: rounds }, (_, i) => `R${i + 1} score`), 'Wars', 'Attacks', 'Missed', 'Stars', 'Three-stars', 'Avg destruction %', 'Stars conceded', 'Total score'];
    const col = (k) => colName(k);
    const summaryBody = summary.map((p, i) => {
        const n = i + 2;
        const tag = `$C${n}`;
        const roundCells = Array.from({ length: rounds }, (_, r) => ({ f: `SUMIFS(${A('O')},${A('B')},${tag},${A('D')},${r + 1})`, v: round2(p.rounds[r + 1]?.score ?? 0) }));
        return [i + 1, p.name, p.tag, p.th, ...roundCells,
            { f: `COUNTIFS(${A('B')},${tag})`, v: p.wars },
            { f: `COUNTIFS(${A('B')},${tag},${A('J')},">=0")`, v: p.attacks },
            { f: `SUMIFS(${A('M')},${A('B')},${tag})`, v: p.missed },
            { f: `SUMIFS(${A('J')},${A('B')},${tag})`, v: p.stars },
            { f: `SUMIFS(${A('L')},${A('B')},${tag})`, v: p.triples },
            { f: `IFERROR(AVERAGEIFS(${A('K')},${A('B')},${tag}),"")`, v: p.avgDestruction == null ? '' : round2(p.avgDestruction) },
            { f: `SUMIFS(${A('N')},${A('B')},${tag})`, v: p.conceded },
            { f: `SUM(${col(5)}${n}:${col(4 + rounds)}${n})`, v: round2(p.score) }];
    });

    return exportExcel(title, [
        { name: 'Summary', header: summaryHeader, body: summaryBody, cols: [6, 22, 14, 5, ...Array(rounds).fill(10), 7, 8, 8, 7, 11, 17, 14, 12] },
        { name: 'Attacks', header: attackHeader, body: attackBody, cols: [22, 14, 5, 7, 24, 8, 10, 10, 8, 6, 13, 10, 8, 14, 9] },
        { name: 'Scoring', header: ['Rule', 'Points'], body: keys.map(k => [weightLabels[k], weights[k]]), cols: [34, 10] }
    ]);
}

/** 1 -> A, 27 -> AA */
function colName(n) {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
}

