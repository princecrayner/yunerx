function pad(n) {
    return String(n).padStart(2, "0");
}

// "2026-10-21" (UTC): the key for "today"
function dateKey(date = new Date()) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}

// The Monday of that week, as a dateKey. The weekly board resets on it.
function weekKey(date = new Date()) {

    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const daysSinceMonday = (d.getUTCDay() + 6) % 7;     // Sunday = 6, Monday = 0

    d.setUTCDate(d.getUTCDate() - daysSinceMonday);

    return dateKey(d);

}

// The day before a given dateKey (used for streaks)
function previousDateKey(key) {

    const [y, m, d] = key.split("-").map(Number);

    return dateKey(new Date(Date.UTC(y, m - 1, d - 1)));

}

module.exports = { dateKey, weekKey, previousDateKey };
