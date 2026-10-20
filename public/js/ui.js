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
 * Pagination bar: "1–10 of 139 wars · ‹ 1 2 3 … 14 ›".
 */
function pagerHtml(page, pageSize, total, noun) {
    const pages = Math.ceil(total / pageSize);
    if (pages <= 1) return '';
    const first = (page - 1) * pageSize + 1, last = Math.min(total, page * pageSize);
    // First, last, and a window around the current page, with gaps as ellipses.
    const nums = [...new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages))].sort((x, y) => x - y);
    const items = [];
    nums.forEach((n, i) => {
        if (i && n - nums[i - 1] > 1) items.push('<span class="pager-gap" aria-hidden="true">…</span>');
        items.push(`<button type="button" class="pager-num" data-page="${n}" ${n === page ? 'aria-current="page"' : ''} aria-label="Page ${n}">${n}</button>`);
    });
    return `<nav class="pager no-print" aria-label="Pages of ${esc(noun)}">
        <span class="note" role="status">${first}–${last} of ${total} ${esc(noun)}</span>
        <div class="pager-btns">
            <button type="button" class="pager-num" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
            ${items.join('')}
            <button type="button" class="pager-num" data-page="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next page">›</button>
        </div>
    </nav>`;
}

function onPage(container, getState, redraw) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-page]');
        if (!btn || btn.disabled || !container.contains(btn)) return;
        getState().page = +btn.dataset.page;
        redraw();
        // Bring the top of the list back into view and keep keyboard focus in the pager.
        if (container.getBoundingClientRect().top < 0) container.scrollIntoView({ block: 'start' });
        container.querySelector('.pager [aria-current="page"]')?.focus({ preventScroll: true });
    });
}

/**
 * A paged list of pre-rendered items (rows, cards), `pageSize` per page.
 * Returns { setItems(htmlItems) }; filters call setItems, which goes back to page 1.
 */
export function mountPagedList(container, { className = '', pageSize = 10, noun = 'items', emptyHtml = '<p class="empty">Nothing to show.</p>' } = {}) {
    const st = { items: [], page: 1 };
    const draw = () => {
        if (!st.items.length) { container.innerHTML = emptyHtml; return; }
        const start = (st.page - 1) * pageSize;
        container.innerHTML = `<div class="${className}">${st.items.slice(start, start + pageSize).join('')}</div>${pagerHtml(st.page, pageSize, st.items.length, noun)}`;
    };
    onPage(container, () => st, draw);
    return {
        setItems(items) { st.items = items; st.page = 1; draw(); }
    };
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
 * Sortable, accessible data table, `limit` rows per page.
 * columns: [{ key, label, num?, value(row), render?(row), sticky?, title? }]
 * Returns { setRows(rows), getSorted() } and renders into `container`.
 */
export function mountTable(container, { columns, rows, sort, caption, rowClass, limit = 10, noun = 'rows' }) {
    let state = { rows, sort: sort || null, page: 1 };

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
        state.page = Math.min(state.page, Math.max(1, Math.ceil(all.length / limit)));
        const list = all.slice((state.page - 1) * limit, state.page * limit);
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
        </table></div>${pagerHtml(state.page, limit, all.length, noun)}`;
    };
    onPage(container, () => state, render);

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sort]');
        if (!btn) return;
        const key = btn.dataset.sort;
        const col = columns.find(c => c.key === key);
        const firstDir = col.num ? 'desc' : 'asc';
        state.sort = state.sort?.key === key
            ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: firstDir };
        state.page = 1;
        render();
        container.querySelector(`[data-sort="${key}"]`)?.focus();
    });

    render();
    return {
        setRows(rows) { state.rows = rows; state.page = 1; render(); },
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
