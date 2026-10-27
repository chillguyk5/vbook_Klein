// Site chuyển sang .win (2026-10: .pet 301 -> .win). Domain cũ vẫn giữ làm
// fallback vì còn 301 sang .win, nhưng để .win đứng đầu để khỏi mất 1 hop.
var DAM_DEFAULT_BASE_URL = "https://damconuong.win";
var DAM_FALLBACK_BASES = [
    "https://damconuong.win",
    "https://damconuong.pet",
    "https://damconuong.mobi",
    "https://damconuong.cx",
    "https://damconuong.ceo",
    "https://damconuong.plus"
];
var BASE_CACHE_KEY = "damconuong.base.v3";
var BASE_CACHE_TTL_MS = 30 * 60 * 1000;

function normalizeBaseUrl(baseUrl) {
    if (!baseUrl) return "";
    var value = String(baseUrl).trim();
    if (!value) return "";
    if (value.toLowerCase() === "auto") return "auto";

    value = value.split(/[\n\r,;]/)[0].replace(/\s+/g, "");
    if (!value) return "";

    if (value.indexOf("http://") !== 0 && value.indexOf("https://") !== 0) {
        value = "https://" + value;
    }

    var matchedOrigin = /^(https?:\/\/[^/?#]+)/i.exec(value);
    if (!matchedOrigin) return "";

    return matchedOrigin[1].replace(/\/+$/, "");
}

function parseBaseCandidates() {
    var candidates = [];
    var seen = {};

    function add(candidate) {
        var base = normalizeBaseUrl(candidate);
        if (!base || base === "auto" || seen[base]) return;
        seen[base] = true;
        candidates.push(base);
    }

    if (typeof fallback_domains !== "undefined" && fallback_domains) {
        String(fallback_domains).split(/[\n\r,;]/).forEach(function(item) {
            add(item);
        });
    }

    DAM_FALLBACK_BASES.forEach(function(item) {
        add(item);
    });

    return candidates;
}

function getCachedBaseUrl() {
    try {
        var raw = localStorage.getItem(BASE_CACHE_KEY);
        if (!raw) return "";

        var payload = JSON.parse(raw);
        if (!payload || !payload.base || !payload.at) return "";
        if ((Date.now() - payload.at) > BASE_CACHE_TTL_MS) return "";

        return normalizeBaseUrl(payload.base);
    } catch (error) {
        return "";
    }
}

function setCachedBaseUrl(base) {
    try {
        localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({
            base: base,
            at: Date.now()
        }));
    } catch (error) {
    }
}

function getDcnUa() {
    try { return UserAgent.android() + ""; } catch (e2) {}
    try { return UserAgent.chrome() + ""; } catch (e3) {}
    return "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
}

function getDcnCookie() {
    if (typeof localCookie === "undefined") return "";
    try {
        return localCookie.getCookie(BASE_URL) || localCookie.getCookie("https://damconuong.win") || localCookie.getCookie() || "";
    } catch (e) {
        return "";
    }
}

function dcnHeaders(extra) {
    var cookie = getDcnCookie();
    var h = {
        "User-Agent": getDcnUa(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": "\"Android\""
    };
    if (cookie) {
        h["Cookie"] = cookie;
    }
    if (extra) {
        for (var k in extra) {
            if (extra.hasOwnProperty(k) && extra[k] != null) h[k] = extra[k];
        }
    }
    return h;
}

function dcnFetch(url, opts) {
    opts = opts || {};
    var headers = dcnHeaders(opts.headers || {});
    opts.headers = headers;
    return fetch(url, opts);
}

function canUseBaseUrl(base, path) {
    try {
        var response = dcnFetch(base + path);
        return !!(response && response.ok);
    } catch (error) {
        return false;
    }
}

function resolveBaseUrl() {
    var configuredBase = normalizeBaseUrl(typeof base_url !== "undefined" ? base_url : "");
    if (configuredBase && configuredBase !== "auto") {
        return configuredBase;
    }

    var cachedBase = getCachedBaseUrl();
    if (cachedBase) {
        return cachedBase;
    }

    var candidates = parseBaseCandidates();
    var probePaths = ["/tim-kiem?sort=-updated_at", "/tim-kiem", "/"];

    for (var i = 0; i < candidates.length; i++) {
        for (var j = 0; j < probePaths.length; j++) {
            if (canUseBaseUrl(candidates[i], probePaths[j])) {
                setCachedBaseUrl(candidates[i]);
                return candidates[i];
            }
        }
    }

    setCachedBaseUrl(DAM_DEFAULT_BASE_URL);
    return DAM_DEFAULT_BASE_URL;
}

var BASE_URL = resolveBaseUrl();

function normalizeUrl(url) {
    if (!url) return "";
    url = String(url).replace(/\s+/g, "").trim();
    if (!url || url.indexOf("data:image/") === 0) return "";
    if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("/") === 0) return BASE_URL + url;
    return BASE_URL + "/" + url;
}

function cleanText(text) {
    if (!text) return "";
    return String(text).replace(/\s+/g, " ").trim();
}

function getTextBetween(text, startText, endText) {
    if (!text) return "";
    var startIndex = text.indexOf(startText);
    if (startIndex < 0) return "";
    startIndex += startText.length;
    var nextText = text.substring(startIndex);
    if (endText) {
        var endIndex = nextText.indexOf(endText);
        if (endIndex >= 0) {
            nextText = nextText.substring(0, endIndex);
        }
    }
    return cleanText(nextText);
}

function buildPagedUrl(url, page) {
    url = normalizeUrl(url);
    if (!page || page === "1") return url;
    if (url.indexOf("page=") >= 0) {
        return url.replace(/([?&])page=\d+/i, "$1page=" + page);
    }
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
}

function getNextPage(doc, currentPage) {
    var pageNumber = parseInt(currentPage || "1", 10);
    var nextPage = null;
    doc.select("a[href*='page=']").forEach(function(e) {
        var href = e.attr("href");
        var matched = /[?&]page=(\d+)/i.exec(href);
        if (!matched) return;
        var candidate = parseInt(matched[1], 10);
        if (candidate > pageNumber && (!nextPage || candidate < nextPage)) {
            nextPage = candidate;
        }
    });
    return nextPage ? String(nextPage) : null;
}

function pushUniqueCard(items, seen, item) {
    if (!item || !item.link || seen[item.link]) return;
    seen[item.link] = true;
    items.push(item);
}

function parseMangaCards(doc) {
    var seen = {};
    var items = [];
    doc.select(".manga-vertical").forEach(function(card) {
        var nameNode = card.select("h3 a").first();
        if (!nameNode) return;
        var chapterNode = card.select("h4 a").first();
        var coverNode = card.select(".cover-frame img").first();
        pushUniqueCard(items, seen, {
            name: cleanText(nameNode.text()),
            link: normalizeUrl(nameNode.attr("href")),
            cover: coverNode ? normalizeUrl(coverNode.attr("src")) : "",
            description: chapterNode ? cleanText(chapterNode.text()) : "",
            host: BASE_URL
        });
    });
    return items;
}