let starsChart = null;
let topPerformersChart = null;

export function renderCharts(warHistory) {
    if (!warHistory || warHistory.length === 0) return;

    renderStarsTrend(warHistory);
    renderTopPerformers(warHistory);
}

function parseCoCDate(dateStr) {
    if (!dateStr) return null;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6) - 1;
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const sec = dateStr.substring(13, 15);
    return new Date(Date.UTC(year, month, day, hour, min, sec));
}

function getDifficulty(targetTH, attackerTH) {
    if (!targetTH || !attackerTH) return "Normal";
    const diff = targetTH - attackerTH;
    if (diff > 0) return "Hard";
    if (diff === 0) return "Normal";
    return "Easy";
}

function renderStarsTrend(warHistory) {
    const ctx = document.getElementById('starsTrendChart').getContext('2d');
    const now = new Date();

    const finishedWars = warHistory.filter(w => {
        const end = parseCoCDate(w.endTime);
        return end && now > end;
    });
    
    const sortedHistory = finishedWars.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const last10 = sortedHistory.slice(-10);
    
    const labels = last10.map(w => w.startTime.substring(4, 6) + '/' + w.startTime.substring(6, 8));
    const data = last10.map(w => {
        const totalPossibleStars = w.teamSize * 3;
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
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 } } },
                x: { grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderTopPerformers(warHistory) {
    const ctx = document.getElementById('topPerformersChart').getContext('2d');
    
    // Filter to current month
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    const monthWars = warHistory.filter(w => w.startTime.substring(0, 6) === currentMonthStr);
    
    const performanceMap = {}; // tag -> { name, Easy: 0, Normal: 0, Hard: 0, total: 0 }

    monthWars.forEach(war => {
        const opponentMap = {};
        war.opponent.members.forEach(om => opponentMap[om.tag] = om.townhallLevel || om.townHallLevel);

        war.clan.members.forEach(m => {
            if (!performanceMap[m.tag]) {
                performanceMap[m.tag] = { name: m.name, Easy: 0, Normal: 0, Hard: 0, total: 0 };
            }
            const attackerTH = m.townhallLevel || m.townHallLevel;
            (m.attacks || []).forEach(atk => {
                const diff = getDifficulty(opponentMap[atk.defenderTag], attackerTH);
                performanceMap[m.tag][diff] += atk.stars;
                performanceMap[m.tag].total += atk.stars;
            });
        });
    });

    const top20 = Object.values(performanceMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);

    const labels = top20.map(p => p.name);
    const datasets = [
        { label: 'Hard', data: top20.map(p => p.Hard), backgroundColor: '#f87171' }, // Red-400
        { label: 'Normal', data: top20.map(p => p.Normal), backgroundColor: '#facc15' }, // Yellow-400
        { label: 'Easy', data: top20.map(p => p.Easy), backgroundColor: '#4ade80' } // Green-400
    ];

    if (topPerformersChart) topPerformersChart.destroy();

    // Update parent title via DOM since Chart.js options title is less flexible for our layout
    const titleEl = ctx.canvas.parentNode.querySelector('h3');
    if (titleEl) titleEl.innerText = "Top 10 Performers MTD";

    topPerformersChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#777', font: { size: 9 } } },
                y: { stacked: true, grid: { display: false }, ticks: { color: '#ccc', font: { size: 10, weight: 'bold' } } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#777', font: { size: 9 }, boxWidth: 10, padding: 15 } }
            },
            layout: { padding: { bottom: 10 } }
        }
    });

    const container = ctx.canvas.parentNode;
    container.style.height = `${top20.length * 25 + 60}px`;
}
