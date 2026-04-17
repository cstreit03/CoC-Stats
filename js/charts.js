let starsChart = null;
let topPerformersChart = null;
let efficiencyChart = null;

export function renderCharts(warHistory) {
    if (!warHistory || warHistory.length === 0) return;

    renderStarsTrend(warHistory);
    renderTopPerformers(warHistory);
    renderEfficiencyChart(warHistory);
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
            maintainAspectRatio: false,
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
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    const monthWars = warHistory.filter(w => w.startTime.substring(0, 6) === currentMonthStr);
    
    const performanceMap = {};

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
        { label: 'Hard', data: top20.map(p => p.Hard), backgroundColor: '#f87171' }, // Red
        { label: 'Normal', data: top20.map(p => p.Normal), backgroundColor: '#facc15' }, // Yellow
        { label: 'Easy', data: top20.map(p => p.Easy), backgroundColor: '#4ade80' } // Green
    ];

    if (topPerformersChart) topPerformersChart.destroy();

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
            }
        }
    });

    document.getElementById('topPerformersContainer').style.height = `${top20.length * 28 + 60}px`;
}

function renderEfficiencyChart(warHistory) {
    const ctx = document.getElementById('efficiencyChart').getContext('2d');
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    const monthWars = warHistory.filter(w => w.startTime.substring(0, 6) === currentMonthStr);

    const statsMap = {}; 

    monthWars.forEach(war => {
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

    const top20 = Object.values(statsMap)
        .filter(p => p.total > 0)
        .sort((a, b) => (b.s3/b.total) - (a.s3/a.total) || b.total - a.total)
        .slice(0, 20);

    const labels = top20.map(p => p.name);
    const datasets = [
        { label: '3-Star %', data: top20.map(p => (p.s3/p.total*100).toFixed(1)), backgroundColor: '#4ade80' }, // Green
        { label: '2-Star %', data: top20.map(p => (p.s2/p.total*100).toFixed(1)), backgroundColor: '#facc15' }, // Yellow
        { label: '1-Star %', data: top20.map(p => (p.s1/p.total*100).toFixed(1)), backgroundColor: '#ef4444' }, // Red
        { label: 'Fail %', data: top20.map(p => (p.s0/p.total*100).toFixed(1)), backgroundColor: '#7f1d1d' } // Dark Red
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

    document.getElementById('efficiencyContainer').style.height = `${top20.length * 28 + 60}px`;
}
