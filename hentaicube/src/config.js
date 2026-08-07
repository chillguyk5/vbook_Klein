var DEFAULT_BASE = "https://hentaicube.xyz";
var HOME_CACHE_KEY = "hcube.home.v5";
var HOME_CACHE_TTL = 10 * 60 * 1000;
var COOKIE_TIME_KEY = "hcube.cookie_time";

function cookieAge() {
    try {
        var saved = localStorage.getItem(COOKIE_TIME_KEY);
        if (saved) return Date.now() - parseInt(saved, 10);
    } catch(e) {}
    return 999999;
}

function markCookieFresh() {
    try { localStorage.setItem(COOKIE_TIME_KEY, "" + Date.now()); } catch(e) {}
}

function normalizeBaseUrl(baseUrl) {
    if (!baseUrl) return DEFAULT_BASE;
    var value = String(baseUrl).trim().split(/[\n\r,;]/)[0].replace(/\s+/g, "");
    if (!value) return DEFAULT_BASE;
    if (value.indexOf("http://") !== 0 && value.indexOf("https://") !== 0) value = "https://" + value;
    var m = /^(https?:\/\/[^/?#]+)/i.exec(value);
    return m ? m[1].replace(/\/+$/, "") : DEFAULT_BASE;
}

var BASE_URL = normalizeBaseUrl(
    (typeof base_url !== "undefined" && base_url) ? base_url :
    ((typeof CONFIG_URL !== "undefined" && CONFIG_URL) ? CONFIG_URL : DEFAULT_BASE)
);
var CDN = "https://cdn.hentaicube.xyz";

function getUa() {
    try { return UserAgent.android() + ""; } catch (e2) {}
    try { return UserAgent.chrome() + ""; } catch (e3) {}
    return "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
}

function sourceCookie() {
    try {
        var c = localCookie.getCookie(BASE_URL);
        if (c) return c;
    } catch(e) {}
    try { var c = localStorage.getItem("hcube.cookie"); if (c) return c; } catch(e2) {}
    try { return localCookie.getCookie() || ""; } catch(e) {}
    return "";
}

function saveCookie(cookie) {
    if (!cookie) return;
    try { localCookie.setCookie(cookie + ""); } catch(e) {}
    try { localStorage.setItem("hcube.cookie", cookie + ""); } catch(e2) {}
}

function captureCookie(res) {
    if (!res) return;
    try {
        var c = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
        if (c) saveCookie(c);
    } catch(e) {}
    try {
        var c = res.request.headers.cookie || res.request.headers.Cookie || "";
        if (c) saveCookie(c);
    } catch(e2) {}
}

function request(url, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["Accept"] = headers["Accept"] || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    headers["Accept-Language"] = headers["Accept-Language"] || "vi-VN,vi;q=0.9,en;q=0.8";
    headers["Referer"] = headers["Referer"] || BASE_URL + "/";
    headers["User-Agent"] = headers["User-Agent"] || getUa();
    var cookie = sourceCookie();
    if (cookie && !headers.Cookie) headers.Cookie = cookie;
    options.headers = headers;
    return fetch(normalizeUrl(url), options);
}

function isBlockedText(text) {
    if (!text) return true;
    // CF pages có title "Just a moment" + body ngắn (không phải site content)
    var t = (text + "");
    if (t.length > 100000) return false;
    var s = t.toLowerCase();
    return (s.indexOf("just a moment") >= 0 || s.indexOf("checking your browser") >= 0)
        && (s.indexOf("challenge-platform") >= 0 || s.indexOf("_cf_chl_opt") >= 0);
}

var LAST_ERROR = "";

function getText(url, options) {
    LAST_ERROR = "";
    try {
        var response = request(url, options);
        if (!response) { LAST_ERROR = "Không nhận được phản hồi."; return ""; }
        captureCookie(response);
        if (!response.ok) { LAST_ERROR = "HTTP " + response.status; return ""; }
        var text = response.text() || "";
        if (isBlockedText(text)) { LAST_ERROR = "Cloudflare challenge. Tự động refresh..."; return ""; }
        markCookieFresh();
        return text;
    } catch (e) { LAST_ERROR = "Lỗi: " + e; }
    return "";
}

function getDoc(url) {
    LAST_ERROR = "";
    var path = pathOf(url);
    var isHome = path === "/" || path === "" || path.indexOf("/page/") === 0;
    // Nếu cookie > 8 phút và không phải home, refresh ngầm trước
    if (cookieAge() > 480000 && !isHome) {
        var b = Engine.newBrowser();
        try {
            try { b.setUserAgent(getUa()); } catch(e) { try { b.setUserAgent(UserAgent.android()); } catch(e2) {} }
            b.launch(BASE_URL + "/", 30000);
            for (var w = 0; w < 8; w++) {
                sleep(1200);
                var wd = b.html(8000);
                if (!isBlockedText(wd.html() + "")) {
                    try { var j = localCookie.getCookie() || ""; if (j) saveCookie(j); } catch(eJ) {}
                    markCookieFresh();
                    break;
                }
            }
        } catch(eW) {}
        finally { try { b.close(); } catch(eC) {} }
    }

    try {
        var response = request(url);
        if (response && response.ok) {
            captureCookie(response);
            var doc = response.html();
            if (!isBlockedText(doc.html() + "")) return doc;
        }
    } catch (e) {}
    return browserDoc(url);
}

function browserDoc(url) {
    var b = null;
    try {
        b = Engine.newBrowser();
        try { b.setUserAgent(getUa()); } catch(e) { try { b.setUserAgent(UserAgent.android()); } catch(e2) {} }

        url = normalizeUrl(url);
        var isDeep = url.indexOf(BASE_URL + "/read/") === 0 || url.indexOf(BASE_URL + "/page/") === 0;

        // Luôn warm home trước (kể cả khi là home) — CF có thể kịp clear
        var warmed = false;
        for (var attempt = 0; attempt < 3; attempt++) {
            b.launch(BASE_URL + "/", 30000);
            for (var w = 0; w < 10; w++) {
                sleep(w === 0 ? 2000 : 1000);
                var wdoc = b.html(8000);
                if (!isBlockedText(wdoc.html() + "")) { warmed = true; break; }
            }
            if (warmed) break;
            // CF chưa clear → thử lại với browser mới
            try { b.close(); } catch(eB) {}
            b = Engine.newBrowser();
            try { b.setUserAgent(getUa()); } catch(e) { try { b.setUserAgent(UserAgent.android()); } catch(e2) {} }
        }

        if (!warmed) {
            try { var j = localCookie.getCookie() || ""; if (j) saveCookie(j); } catch(eJ) {}
            LAST_ERROR = "Cookie hết hạn. Tự động refresh thất bại. Mở WebView pass CF rồi thử lại.";
            return null;
        }

        // Lưu cookie từ warm
        try { var j1 = localCookie.getCookie() || ""; if (j1) saveCookie(j1); markCookieFresh(); } catch(eJ1) {}

        // Navigate đến target nếu là deep link
        if (isDeep) {
            try { b.callJs("window.location.href=" + JSON.stringify(url), 8000); } catch(eN) {
                try { b.launch(url, 25000); } catch(eL) {}
            }
        }

        // Chờ target load
        var doc = b.html(5000);
        for (var i = 0; i < 8 && isBlockedText(doc.html() + ""); i++) {
            sleep(1000);
            doc = b.html();
        }

        if (isBlockedText(doc.html() + "")) {
            try { var j2 = localCookie.getCookie() || ""; if (j2) saveCookie(j2); } catch(eJ2) {}
            LAST_ERROR = "Tự động refresh cookie thất bại. Mở WebView pass CF 1 lần rồi thử lại.";
            return null;
        }

        // Lưu cookie sau khi load xong
        try { var j3 = localCookie.getCookie() || ""; if (j3) saveCookie(j3); markCookieFresh(); } catch(eJ3) {}
        return doc;
    } catch (e) { LAST_ERROR = "Browser lỗi: " + e; return null; }
    finally { try { if (b) b.close(); } catch(e2) {} }
}

function loadError() {
    return Response.error(LAST_ERROR || "Không tải được HentaiCube.");
}

function cleanText(text) {
    if (!text) return "";
    return ("" + text).replace(/\s+/g, " ").trim();
}

function foldText(text) {
    text = cleanText(text).toLowerCase();
    try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
    return text.replace(/đ/g, "d").replace(/Đ/g, "d");
}

function normalizeUrl(url) {
    if (!url) return "";
    url = ("" + url).replace(/&amp;/g, "&").trim();
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("/") === 0) return BASE_URL + url;
    if (!/^https?:\/\//i.test(url)) return BASE_URL + "/" + url.replace(/^\/+/, "");
    return url.replace(/^https?:\/\/(?:www\.)?hentaicube\.xyz/i, BASE_URL);
}

function normalizeImage(url) {
    if (!url) return "";
    url = ("" + url).replace(/&amp;/g, "&").trim();
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("/") === 0) return BASE_URL + url;
    if (!/^https?:\/\//i.test(url)) return BASE_URL + "/" + url.replace(/^\/+/, "");
    return url;
}

function isMangaUrl(link) {
    if (!link) return false;
    return /^\/(?:read|manga)\/[^/]+\/?$/i.test(pathOf(link));
}

function isChapterUrl(link) {
    if (!link) return false;
    return /^\/(?:read|manga)\/[^/]+\/(?:chap[^/]*|ch[^/]*|oneshot|extra)$/i.test(pathOf(link).replace(/\/+$/, ""));
}

function pathOf(url) {
    url = normalizeUrl(url);
    var m = /^https?:\/\/[^/]+(\/[^?#]*)?/.exec(url);
    return m && m[1] ? m[1] : "/";
}

function mangaKey(url) {
    var m = /\/(?:read|manga)\/([^/]+)/i.exec(pathOf(url));
    return m ? m[1].toLowerCase() : "";
}

function storyUrlFromAny(url) {
    var m = /^(https?:\/\/[^/]+\/(?:read|manga)\/[^/?#/]+)/i.exec(normalizeUrl(url));
    return m ? m[1] + "/" : url;
}

function imageAttr(e) {
    if (!e) return "";
    return e.attr("data-original") || e.attr("data-src") || e.attr("data-lazy-src") || e.attr("data-cfsrc") || e.attr("src") || "";
}

function imageFromNode(e) {
    return normalizeImage(imageAttr(e));
}

function coverField(url) {
    return normalizeImage(url);
}

function isNavLabel(text) {
    var f = foldText(text);
    return f.indexOf("doc tu dau") >= 0 || f.indexOf("chuong moi nhat") >= 0 || f.indexOf("read first") >= 0 || f.indexOf("read last") >= 0 || f.indexOf("latest chapter") >= 0;
}

function isNavLink(a) {
    if (!a) return true;
    var id = cleanText(a.attr("id"));
    if (id === "btn-read-first" || id === "btn-read-last") return true;
    return foldText(a.attr("class")).indexOf("c-btn") >= 0;
}

function firstText(node, selectors) {
    for (var i = 0; i < selectors.length; i++) {
        var e = node.select(selectors[i]).first();
        var t = e ? cleanText(e.text()) : "";
        if (t) return t;
    }
    return "";
}

function firstHtml(node, selectors) {
    for (var i = 0; i < selectors.length; i++) {
        var e = node.select(selectors[i]).first();
        if (e && cleanText(e.text())) return e.html();
    }
    return "";
}

function metaContent(doc, selector) {
    var n = doc.select(selector).first();
    return n ? cleanText(n.attr("content")) : "";
}

function listPageUrl(url, page) {
    if (!url) url = "/read/";
    if (!page || page === "1") return normalizeUrl(url);
    if (("" + page).indexOf("http") === 0 || ("" + page).indexOf("/") === 0) return normalizeUrl(page);
    var p = normalizeUrl(url).split("?");
    var base = p[0].replace(/\/page\/\d+\/?$/i, "").replace(/\/+$/, "");
    var q = p.length > 1 ? "?" + p.slice(1).join("?") : "";
    return base + "/page/" + page + "/" + q;
}

function pageNumberFromUrl(url) {
    var m = /\/page\/(\d+)/i.exec(url || "");
    if (!m) m = /[?&](?:paged|page)=(\d+)/i.exec(url || "");
    return m ? parseInt(m[1]) : 1;
}

function nextPageUrl(doc, currentUrl) {
    var sels = ["a.nextpostslink[href]", ".wp-pagenavi a.nextpostslink[href]", ".nav-links a.next[href]", ".pagination a.next[href]", "a.page-numbers.next[href]", "a[rel=next][href]"];
    for (var i = 0; i < sels.length; i++) {
        var e = doc.select(sels[i]).first();
        if (e) return normalizeUrl(e.attr("href"));
    }
    var cur = pageNumberFromUrl(currentUrl || "");
    var best = 0, bestHref = "";
    doc.select("a[href*='/page/'], a[href*='paged=']").forEach(function(a) {
        var p = pageNumberFromUrl(a.attr("href"));
        if (p > cur && (!best || p < best)) { best = p; bestHref = a.attr("href"); }
    });
    return bestHref ? normalizeUrl(bestHref) : "";
}

// ====== HOME CACHE ======

function parseCard(card) {
    var a = card.select(".post-title a, h3 a, h5 a, .item-thumb a, a").first();
    if (!a) return null;
    var link = normalizeUrl(a.attr("href") + "");
    var name = cleanText(a.text() || a.attr("title") || "");
    if (!name) name = cleanText(card.select("img").attr("alt") || "");
    if (!name || !link || !isMangaUrl(link)) return null;
    var chaps = [], seen = {};
    card.select(".list-chapter a, .chapter-item a, a[href*='/chap'], a[href*='/oneshot']").forEach(function(c) {
        var href = normalizeUrl(c.attr("href") + "");
        var cn = cleanText(c.text() + "");
        if (!href || seen[href] || !isChapterUrl(href)) return;
        seen[href] = true;
        chaps.push({ name: cn || "Chap", url: href, host: BASE_URL });
    });
    return {
        name: name,
        link: link,
        cover: coverField(imageFromNode(card.select("img").first())),
        description: chaps.length ? chaps[0].name : "",
        host: BASE_URL,
        chapters: chaps
    };
}

function parseHomeIndex(doc) {
    var idx = { items: [], byKey: {}, genres: [], at: Date.now() };
    var seen = {};
    doc.select(".page-item-detail, .c-tabs-item__content, .popular-item-wrap").forEach(function(card) {
        var it = parseCard(card);
        if (!it || !it.link || seen[it.link]) return;
        seen[it.link] = true;
        idx.items.push(it);
        idx.byKey[mangaKey(it.link)] = it;
    });
    return idx;
}

function loadHomeIndex(force) {
    if (!force) {
        try {
            var raw = localStorage.getItem(HOME_CACHE_KEY);
            if (raw) { var c = JSON.parse(raw); if (c && c.at && Date.now() - c.at < HOME_CACHE_TTL && c.items && c.items.length) return c; }
        } catch(e) {}
    }
    var loaded = getDoc(BASE_URL + "/");
    if (!loaded) return null;
    var idx = parseHomeIndex(loaded);
    try { localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(idx)); } catch(e2) {}
    return idx;
}

function findInIndex(idx, url) {
    if (!idx || !idx.byKey) return null;
    var key = mangaKey(url);
    return idx.byKey[key] || null;
}

function itemsToList(items) {
    var out = [], seen = {};
    if (!items) return out;
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it || !it.link || seen[it.link]) continue;
        seen[it.link] = true;
        out.push({ name: it.name, link: it.link, cover: it.cover || "", description: it.description || "", host: BASE_URL });
    }
    return out;
}

function slugToTitle(url) {
    var key = mangaKey(url);
    if (!key) return "";
    try { key = decodeURIComponent(key); } catch(e) {}
    return key.replace(/[-_]+/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}
