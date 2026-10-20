/**
 * Chart.js wrappers. Colors come from CSS tokens so charts follow the theme;
 * every chart created here is destroyed when the route changes.
 */

const live = new Set();

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function applyDefaults() {
    const C = window.Chart;
    C.defaults.font.family = "'Inter', system-ui, sans-serif";
    C.defaults.font.size = 12;
    C.defaults.color = cssVar('--muted');
    C.defaults.borderColor = cssVar('--chart-grid');
    C.defaults.maintainAspectRatio = false;
    C.defaults.animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300 };
    C.defaults.plugins.legend.display = false;
    Object.assign(C.defaults.plugins.tooltip, {
        backgroundColor: cssVar('--surface-3'), borderColor: cssVar('--line-strong'), borderWidth: 1,
        titleColor: cssVar('--text'), bodyColor: cssVar('--text-2'), padding: 10, cornerRadius: 8, boxPadding: 4
    });
    C.defaults.interaction = { mode: 'index', intersect: false };
}

export function chart(canvas, config) {
    if (!canvas || !window.Chart) return null;
    applyDefaults();
    window.Chart.getChart(canvas)?.destroy();
    const c = new window.Chart(canvas, config);
    live.add(c);
    return c;
}

export function destroyCharts() {
    for (const c of live) c.destroy();
    live.clear();
}

export function lineConfig(labels, data, { color = cssVar('--series-1'), label = '', yMin, yMax, yFormat, tooltipTitle } = {}) {
    return {
        type: 'line',
        data: { labels, datasets: [{ label, data, borderColor: color, borderWidth: 2, backgroundColor: color + '22', fill: true, tension: 0.25, pointRadius: data.length > 40 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: color }] },
        options: {
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
                y: { min: yMin, max: yMax, suggestedMin: yMin, ticks: { precision: 0, callback: yFormat } }
            },
            plugins: { tooltip: { callbacks: { title: tooltipTitle } } }
        }
    };
}
