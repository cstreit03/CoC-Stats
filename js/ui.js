export function switchView(view) {
    const sections = {
        members: document.getElementById('section-members'),
        war: document.getElementById('section-war'),
        about: document.getElementById('section-about')
    };
    const tabs = {
        members: document.getElementById('tab-members'),
        war: document.getElementById('tab-war'),
        about: document.getElementById('tab-about')
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

export function switchSubView(subview) {
    const views = {
        history: document.getElementById('warListView'),
        stats: document.getElementById('warStatsView'),
        infractions: document.getElementById('warInfractionsView')
    };
    const btns = {
        history: document.getElementById('subtab-history'),
        stats: document.getElementById('subtab-stats'),
        infractions: document.getElementById('subtab-infractions')
    };

    Object.keys(views).forEach(key => {
        if (key === subview) {
            views[key].classList.remove('hidden');
            btns[key].classList.add('active');
        } else {
            views[key].classList.add('hidden');
            btns[key].classList.remove('active');
        }
    });
    
    // Ensure war detail view is hidden when switching sub-tabs
    document.getElementById('warDetailView').classList.add('hidden');
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
