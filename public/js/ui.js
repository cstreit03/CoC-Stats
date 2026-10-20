/**
 * Reusable UI pieces: segmented controls, chips, sortable tables, KPIs, export buttons.
 * Controls are plain buttons with aria-pressed so they work with keyboard and screen readers.
 */
import { esc, icons } from './util.js';
import { store, collectError } from './store.js';

/** Segmented control. options: [{ value, label }] */
export function seg(name, label, options, current) {
    return `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${name}">${options.map(o =>
        `<button type="button" data-value="${esc(o.value)}" aria-pressed="${o.value === current}">${esc(o.label)}</button>`).join('')}</div>`;
}

/** Toggle chips (multi or single select). */
export function chips(name, label, options, selected) {
    const isOn = (v) => Array.isArray(selected) ? selected.includes(v) : selected === v;
    return `<div class="chips" role="group" aria-label="${esc(label)}" data-chips="${name}">${options.map(o =>
        `<button type="button" class="chip" data-value="${esc(o.value)}" aria-pressed="${isOn(o.value)}">${esc(o.label)}</button>`).join('')}</div>`;
}

/** Wires a seg/chips group: calls onChange(value) and updates pressed state. */
export function bindToggle(root, name, onChange) {
    const group = root.querySelector(`[data-seg="${name}"], [data-chips="${name}"]`);
    if (!group) return;
    group.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-value]');
        if (!btn) return;
        group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        onChange(btn.dataset.value);
    });
}

export function select(name, label, options, current, { hideLabel = false } = {}) {
    return `<label class="field"><span class="${hideLabel ? 'sr-only' : ''}">${esc(label)}</span>
        <select class="select" data-select="${name}">${options.map(o =>
            `<option value="${esc(o.value)}" ${String(o.value) === String(current) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
}

export function bindSelect(root, name, onChange) {
    root.querySelector(`[data-select="${name}"]`)?.addEventListener('change', (e) => onChange(e.target.value));
}

export function kpi(label, value, sub = '', subClass = '') {
    return `<div class="kpi"><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p>${sub ? `<p class="kpi-sub ${subClass}">${sub}</p>` : ''}</div>`;
}

export function empty(title, text = '') {
    return `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;
}

export function exportButtons() {
    return `<div class="row no-print">
        <button type="button" class="btn" data-export="xlsx">${icons.excel}<span>Excel</span></button>
        <button type="button" class="btn" data-export="pdf">${icons.pdf}<span>PDF</span></button>
    </div>`;
}

/**
 * "Showing 10 of 49 · Show more · Show all" controls under a capped list.
 * Long lists start short so pages don't scroll forever; exports always include everything.
 */
function capFooter(shown, total, noun, step) {
    if (total <= step) return '';
    const parts = [`<span class="note" role="status">Showing ${Math.min(shown, total)} of ${total} ${noun}</span>`];
    if (shown < total) {
        if (total - shown > step) parts.push(`<button type="button" class="btn" data-cap="more">Show ${step} more</button>`);
        parts.push(`<button type="button" class="btn" data-cap="all">Show all</button>`);
    } else {
        parts.push(`<button type="button" class="btn" data-cap="less">Show fewer</button>`);
    }
    return `<div class="cap-footer no-print">${parts.join('')}</div>`;
}

function onCap(container, getState, redraw) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cap]');
        if (!btn || !container.contains(btn)) return;
        const st = getState();
        const action = btn.dataset.cap;
        if (action === 'more') st.shown += st.step;
        else if (action === 'all') st.shown = Infinity;
        else { st.shown = st.step; container.scrollIntoView({ block: 'nearest' }); }
        redraw();
        // Keep keyboard focus on the footer after re-rendering.
        container.querySelector('.cap-footer button')?.focus({ preventScroll: true });
    });
}

/**
 * A capped list of pre-rendered items (cards, rows).
 * Returns { setItems(htmlItems) }; filters should call setItems, which resets the cap.
 */
export function mountList(container, { className = '', step = 10, noun = 'items', emptyHtml = '<p class="empty">Nothing to show.</p>' } = {}) {
    const st = { items: [], shown: step, step };
    const draw = () => {
        container.innerHTML = st.items.length
            ? `<div class="${className}">${st.items.slice(0, st.shown).join('')}</div>${capFooter(st.shown, st.items.length, noun, step)}`
            : emptyHtml;
    };
    onCap(container, () => st, draw);
    return {
        setItems(items) { st.items = items; st.shown = step; draw(); }
    };
}

/**
 * Sortable, accessible data table, capped at `limit` rows until expanded.
 * columns: [{ key, label, num?, value(row), render?(row), sticky?, title? }]
 * Returns { setRows(rows), getSorted() } and renders into `container`.
 */
export function mountTable(container, { columns, rows, sort, caption, rowClass, limit = 10, noun = 'rows' }) {
    let state = { rows, sort: sort || null, shown: limit, step: limit };

    const sorted = () => {
        if (!state.sort) return state.rows;
        const col = columns.find(c => c.key === state.sort.key);
        const dir = state.sort.dir === 'asc' ? 1 : -1;
        return [...state.rows].sort((a, b) => {
            const va = col.value(a), vb = col.value(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
        });
    };

    const render = () => {
        const all = sorted();
        const list = all.slice(0, state.shown);
        container.innerHTML = `<div class="table-wrap"><table class="table">
            ${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}
            <thead><tr>${columns.map(c => {
                const ariaSort = state.sort?.key === c.key ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                const cls = [c.num ? 'num' : '', c.sticky ? 'sticky-col' : ''].join(' ');
                return `<th scope="col" class="${cls}" aria-sort="${ariaSort}" ${c.title ? `title="${esc(c.title)}"` : ''}>${c.sortable === false ? esc(c.label)
                    : `<button type="button" class="sort-btn" data-sort="${c.key}">${esc(c.label)}</button>`}</th>`;
            }).join('')}</tr></thead>
            <tbody>${list.length === 0 ? `<tr><td colspan="${columns.length}" class="muted center">No data</td></tr>` : list.map(r =>
                `<tr class="${rowClass ? rowClass(r) : ''}">${columns.map(c =>
                    `<td class="${[c.num ? 'num' : '', c.sticky ? 'sticky-col' : '', c.className || ''].join(' ')}">${c.render ? c.render(r) : esc(c.value(r) ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>${capFooter(state.shown, all.length, noun, limit)}`;
    };
    onCap(container, () => state, render);

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sort]');
        if (!btn) return;
        const key = btn.dataset.sort;
        const col = columns.find(c => c.key === key);
        const firstDir = col.num ? 'desc' : 'asc';
        state.sort = state.sort?.key === key
            ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: firstDir };
        render();
        container.querySelector(`[data-sort="${key}"]`)?.focus();
    });

    render();
    return {
        setRows(rows) { state.rows = rows; state.shown = limit; render(); },
        getSorted: sorted
    };
}

/** Plain-text cell values for exports, from the same column definitions. */
export function tableData(columns, rows) {
    const cols = columns.filter(c => c.export !== false);
    return {
        header: cols.map(c => c.exportLabel || c.label),
        body: rows.map(r => cols.map(c => {
            const v = c.exportValue ? c.exportValue(r) : c.value(r);
            return v == null ? '' : v;
        }))
    };
}

/** Shown on any page when nothing has been collected yet. */
export function noDataMessage() {
    const err = collectError();
    const collecting = store.status?.lastCollect && !store.status.lastCollect.finishedAt;
    return `<div class="card empty"><strong>${err ? 'Data collection is failing' : 'No data collected yet'}</strong>${
        err ? esc(err) : collecting ? 'Collecting the first data from Clash of Clans…' : 'The first collection runs within the hour.'}</div>`;
}
