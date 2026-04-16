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

function renderStarsTrend(warHistory) {
    const ctx = document.getElementById('starsTrendChart').getContext('2d');
    const now = new Date();

    // Only Finished Wars
    const finishedWars = warHistory.filter(w => {
        const end = parseCoCDate(w.endTime);
        return end && now > end;
    });
    
    // Sort by time ascending for the chart
    const sortedHistory = finishedWars.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    // Take last 10 wars
    const last10 = sortedHistory.slice(-10);
    
    const labels = last10.map(w => w.startTime.substring(4, 6) + '/' + w.startTime.substring(6, 8));
    const data = last10.map(w => {
        // Star logic: each base can give max 3 stars.
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
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: '#333' },
                    ticks: { color: '#777' }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#777' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTopPerformers(warHistory) {
    const ctx = document.getElementById('topPerformersChart').getContext('2d');
    
    // Filter to current month
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 4) + now.toISOString().substring(5, 7);
    
    const monthWars = warHistory.filter(w => w.startTime.substring(0, 6) === currentMonthStr);
    
    const performanceMap = {}; // tag -> { name, stars }

    monthWars.forEach(war => {
        war.clan.members.forEach(m => {
            if (!performanceMap[m.tag]) {
                performanceMap[m.tag] = { name: m.name, stars: 0 };
            }
            const totalStars = (m.attacks || []).reduce((sum, atk) => sum + atk.stars, 0);
            performanceMap[m.tag].stars += totalStars;
        });
    });

    const top10 = Object.values(performanceMap)
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 10);

    const labels = top10.map(p => p.name);
    const data = top10.map(p => p.stars);

    if (topPerformersChart) topPerformersChart.destroy();

    topPerformersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Stars',
                data: data,
                backgroundColor: '#d4af37',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { color: '#777' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#777' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}
