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
        if (!sections[key] || !tabs[key]) return;
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
        stats: document.getElementById('warStatsView')
    };
    const btns = {
        history: document.getElementById('subtab-history'),
        stats: document.getElementById('subtab-stats')
    };

    Object.keys(views).forEach(key => {
        if (!views[key] || !btns[key]) return;
        if (key === subview) {
            views[key].classList.remove('hidden');
            btns[key].classList.add('active');
        } else {
            views[key].classList.add('hidden');
            btns[key].classList.remove('active');
        }
    });
    
    const detailView = document.getElementById('warDetailView');
    if (detailView) detailView.classList.add('hidden');
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
    const el = document.getElementById('pageTitle');
    if (el) el.innerText = title;
}
