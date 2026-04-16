export function switchView(view) {
    const sections = {
        members: document.getElementById('section-members'),
        war: document.getElementById('section-war'),
        stats: document.getElementById('section-stats')
    };
    const tabs = {
        members: document.getElementById('tab-members'),
        war: document.getElementById('tab-war'),
        stats: document.getElementById('tab-stats')
    };

    Object.keys(sections).forEach(key => {
        if (key === view) {
            sections[key].classList.remove('hidden-section');
            tabs[key].classList.add('active');
        } else {
            sections[key].classList.add('hidden-section');
            tabs[key].classList.remove('active');
        }
    });
}

export function updateHeader(name, badgeUrl) {
    const titleEl = document.getElementById('pageTitle');
    const badgeEl = document.getElementById('clanBadge');
    
    if (name) titleEl.innerText = name;
    if (badgeUrl) {
        badgeEl.src = badgeUrl;
        badgeEl.classList.remove('hidden');
    }
}

export function updateMemberCount(count) {
    const countEl = document.getElementById('memberCount');
    if (countEl) countEl.innerText = `${count} / 50`;
}

export function updatePageTitle(title) {
    document.getElementById('pageTitle').innerText = title;
}
