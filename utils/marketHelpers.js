const { CURRENCY } = require("../config/market");

// A smaller, faster copy of a Cloudinary image (the original stays untouched)
function thumb(url, width, height) {

    if (!url || !String(url).includes("/upload/")) {
        return url || "";
    }

    return String(url).replace(
        "/upload/",
        "/upload/w_" + width + ",h_" + height + ",c_fill,q_auto,f_auto/"
    );

}

function formatPrice(amount) {

    const value = Number(amount) || 0;

    if (value === 0) {
        return "Free";
    }

    return CURRENCY + " " + value.toLocaleString("en-US", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
    });

}

function timeAgo(date) {

    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " min ago";

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

    const days = Math.floor(hours / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");

    const months = Math.floor(days / 30);
    return months + (months === 1 ? " month ago" : " months ago");

}

module.exports = { thumb, formatPrice, timeAgo };
