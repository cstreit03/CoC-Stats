export function switchView(view) {
    const membersSection = document.getElementById('section-members');
    const warSection = document.getElementById('section-war');
    const membersTab = document.getElementById('tab-members');
    const warTab = document.getElementById('tab-war');

    if (view === 'members') {
        membersSection.classList.remove('hidden-section');
        warSection.classList.add('hidden-section');
        membersTab.classList.add('active');
        warTab.classList.remove('active');
    } else {
        warSection.classList.remove('hidden-section');
        membersSection.classList.add('hidden-section');
        warTab.classList.add('active');
        membersTab.classList.remove('active');
    }
}

export function updateMemberCount(count) {
    const countEl = document.getElementById('memberCount');
    if (countEl) countEl.innerText = `${count} / 50`;
}

export function updatePageTitle(title) {
    document.getElementById('pageTitle').innerText = title;
}
