var BASE_URL = "https://storya.click";
var API_BASE = BASE_URL + "/api/v1";

function extractStorySlug(url) {
    var matched = String(url || "").match(/\/truyen\/([^/?#]+)/i);
    return matched ? matched[1] : "";
}

function toAbsoluteUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return BASE_URL + (path.charAt(0) === "/" ? path : "/" + path);
}