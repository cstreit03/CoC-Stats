/**
 * Constants & Utility Functions
 */

// Human-readable role names
export const roleMap = { 
    "leader": "Leader", 
    "coLeader": "Co-Leader", 
    "admin": "Elder", 
    "member": "Member" 
};

// Numerical weights for sorting logic (Leader > Co-Leader > Elder > Member)
export const roleWeight = { 
    "leader": 4, 
    "coLeader": 3, 
    "admin": 2, 
    "member": 1 
};

// Generates the local path for Town Hall images
export const getTHImage = (lv) => `assets/Town_Hall${lv}.webp`;

/**
 * Parses Clash of Clans ISO-style UTC date strings.
 * Format: 20260415T020302.000Z
 * @param {string} dateStr 
 * @returns {Date|null}
 */
export function parseCoCDate(dateStr) {
    if (!dateStr) return null;
    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const sec = dateStr.substring(13, 15);
    return new Date(Date.UTC(year, month, day, hour, min, sec));
}
