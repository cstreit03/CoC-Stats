/**
 * Analytics & Charts Module
 * Handles all Month-to-Date (MTD) statistical aggregations and Chart.js rendering.
 */
import { parseCoCDate } from './constants.js';

let starsChart = null;      // Star history line chart
let efficiencyChart = null; // Stacked bar chart for conversion rates

/**
 * Main entry point for rendering the Stats tab.
 * Aggregates all war data month-to-date.
 */
export function renderCharts(warHistory) {
    if (!warHistory || warHistory.length === 0) return;

    renderStarsTrend(warHistory);
    renderTopPerformers(warHistory);
    renderEfficiencyChart(warHistory);
}

/**
 * Line Chart: War Stars Achieved (%)
 * Filters for finished wars only to show a historical trend.
 */
function renderStarsTrend(warHistory) {
    const canvas = document.getElementById('starsTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = new Date();

    // Line chart only shows finished wars
    const finishedWars = warHistory.filter(w => {
        const end = parseCoCDate(w.endTime);
        return end && now > end;
    });
    
    if (finishedWars.length === 0) {
        if (starsChart) starsChart.destroy();
        return;
    }

    // Sort chronologically and take the last 10 entries
    const sortedHistory = finishedWars.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const last10 = sortedHistory.slice(-10);
    
    const labels = last10.map(w => w.startTime.substring(4, 6) + '/' + w.startTime.substring(6, 8));
    const data = last10.map(w => {
        const totalPossibleStars = (w.teamSize || 0) * 3;
        if (totalPossibleStars === 0) return 0;
        return ((w.clan.stars / totalPossibleStars) * 100).toFixed(1);
    });

    if (starsChart) starsChart.destroy();

    starsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Stars Won (%)',
                data: data,
                borderColor: '#d4af37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 } } },
                x: { grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Table: Stars Earned Breakdown
 * Aggregates the raw count of 3, 2, 1, and 0 star hits for every player MTD.
 */
function renderTopPerformers(warHistory) {
    const container = document.getElementById('topPerformersContainer');
    if (!container) return;
    const now = new Date();
    // Get year-month string like "202604"
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    
    // Aggregate data from all wars that started this month
    const monthWars = warHistory.filter(w => {
        if (!w.startTime) return false;
        return w.startTime.substring(0, 6) === currentMonthStr;
    });
    
    const statsMap = {}; 

    monthWars.forEach(war => {
        if (!war.clan || !war.clan.members) return;
        war.clan.members.forEach(m => {
            if (!statsMap[m.tag]) statsMap[m.tag] = { name: m.name, s3: 0, s2: 0, s1: 0, s0: 0, totalStars: 0 };
            (m.attacks || []).forEach(atk => {
                statsMap[m.tag].totalStars += atk.stars;
                if (atk.stars === 3) statsMap[m.tag].s3++;
                else if (atk.stars === 2) statsMap[m.tag].s2++;
                else if (atk.stars === 1) statsMap[m.tag].s1++;
                else statsMap[m.tag].s0++;
            });
        });
    });

    // Sort by stars descending and take Top 20
    const topPerformers = Object.values(statsMap)
        .filter(p => (p.s3 + p.s2 + p.s1 + p.s0) > 0)
        .sort((a, b) => b.totalStars - a.totalStars || b.s3 - a.s3)
        .slice(0, 20);

    if (topPerformers.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-600 py-10 text-[10px]">No attack data for this month yet.</p>`;
        return;
    }

    let html = `
        <table class="w-full text-[10px] text-left border-collapse">
            <thead>
                <tr class="border-b border-gray-800 text-gray-500 uppercase font-black">
                    <th class="py-2 pl-1">Player</th>
                    <th class="py-2 text-center text-green-500">3★</th>
                    <th class="py-2 text-center text-yellow-500">2★</th>
                    <th class="py-2 text-center text-red-500">1★</th>
                    <th class="py-2 text-center text-gray-500">0★</th>
                    <th class="py-2 text-right pr-1 gold">Total</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/30">
    `;

    topPerformers.forEach(p => {
        html += `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="py-2 pl-1 font-bold text-gray-300">${p.name}</td>
                <td class="py-2 text-center font-mono">${p.s3}</td>
                <td class="py-2 text-center font-mono">${p.s2}</td>
                <td class="py-2 text-center font-mono">${p.s1}</td>
                <td class="py-2 text-center font-mono">${p.s0}</td>
                <td class="py-2 text-right pr-1 font-bold gold">${p.totalStars}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/**
 * Chart: Stars Conversion Rates
 * Stacked horizontal bars showing the percentage distribution of attack outcomes.
 */
function renderEfficiencyChart(warHistory) {
    const canvas = document.getElementById('efficiencyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    
    const monthWars = warHistory.filter(w => {
        if (!w.startTime) return false;
        return w.startTime.substring(0, 6) === currentMonthStr;
    });

    const statsMap = {}; 

    monthWars.forEach(war => {
        if (!war.clan || !war.clan.members) return;
        war.clan.members.forEach(m => {
            if (!statsMap[m.tag]) statsMap[m.tag] = { name: m.name, s3: 0, s2: 0, s1: 0, s0: 0, total: 0 };
            (m.attacks || []).forEach(atk => {
                statsMap[m.tag].total++;
                if (atk.stars === 3) statsMap[m.tag].s3++;
                else if (atk.stars === 2) statsMap[m.tag].s2++;
                else if (atk.stars === 1) statsMap[m.tag].s1++;
                else statsMap[m.tag].s0++;
            });
        });
    });

    // Rank by 3-star percentage descending
    const top20 = Object.values(statsMap)
        .filter(p => p.total > 0)
        .sort((a, b) => (b.s3/b.total) - (a.s3/a.total) || b.total - a.total)
        .slice(0, 20);

    if (top20.length === 0) {
        if (efficiencyChart) efficiencyChart.destroy();
        return;
    }

    const labels = top20.map(p => p.name);
    const datasets = [
        { label: '3-Star %', data: top20.map(p => (p.s3/p.total*100).toFixed(1)), backgroundColor: '#4ade80' }, // Green
        { label: '2-Star %', data: top20.map(p => (p.s2/p.total*100).toFixed(1)), backgroundColor: '#facc15' }, // Yellow
        { label: '1-Star %', data: top20.map(p => (p.s1/p.total*100).toFixed(1)), backgroundColor: '#ef4444' }, // Red
        { label: 'Fail %', data: top20.map(p => (p.s0/p.total*100).toFixed(1)), backgroundColor: '#9ca3af' }  // Grey
    ];

    if (efficiencyChart) efficiencyChart.destroy();

    efficiencyChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, beginAtZero: true, max: 100, grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 }, callback: (v) => v + '%' } },
                y: { stacked: true, grid: { display: false }, ticks: { color: '#ccc', font: { size: 10, weight: 'bold' } } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#777', font: { size: 9 }, boxWidth: 10, padding: 15 } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` } }
            }
        }
    });

    // Dynamically adjust container height to prevent squishing
    const container = document.getElementById('efficiencyContainer');
    if (container) {
        container.style.height = `${top20.length * 28 + 60}px`;
    }
}
