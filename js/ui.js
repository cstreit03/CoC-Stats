/**
 * UI State & Navigation Module
 * Manages tab switching and header updates.
 */

/**
 * Switches between primary top-level tabs (About, Members, War).
 */
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

/**
 * Switches between sub-tabs within the War section (History, Stats).
 */
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
    
    // Always hide the "View War" details when clicking top sub-tabs
    const detailView = document.getElementById('warDetailView');
    if (detailView) detailView.classList.add('hidden');
}

/**
 * Updates the global site header (Clan Name and Badge).
 */
export function updateHeader(name, badgeUrl) {
    const titleEl = document.getElementById('pageTitle');
    const badgeEl = document.getElementById('clanBadge');
    
    if (name) titleEl.innerText = name;
    if (badgeUrl) {
        badgeEl.src = badgeUrl;
        badgeEl.classList.remove('hidden');
    }
}

/**
 * Updates the member count label in the Roster tab.
 */
export function updateMemberCount(count) {
    const countEl = document.getElementById('memberCount');
    if (countEl) countEl.innerText = `${count} / 50`;
}

/**
 * Forces an update of the main page title.
 */
export function updatePageTitle(title) {
    const el = document.getElementById('pageTitle');
    if (el) el.innerText = title;
}
