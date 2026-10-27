var BASE_URL = "https://dichtienghoa.net";
// .site đã bị domain parking nhưng giữ lại cuối mảng fallback cho backward-compat
var DOMAINS = ["https://dichtienghoa.net", "https://dichtienghoa.site", "https://dichtienghoa.com"];

function configText(name) {
    try {
        var raw = this[name];
        raw = raw === undefined || raw === null ? "" : String(raw);
        return raw.trim();
    } catch (e) {
        return "";
    }
}

function autoBuyOn() {
    var v;
    try { v = this["auto_buy"]; } catch (e) { return false; }
    if (v === true || v === 1) return true;
    v = v === undefined || v === null ? "" : String(v).toLowerCase().trim();
    return v === "true" || v === "1" || v === "on" || v === "yes";
}

function hasCredentials() {
    return !!configText("username") && !!configText("password");
}

function getUa() {
    try { return UserAgent.android() + ""; } catch (e2) {}
    try { return UserAgent.chrome() + ""; } catch (e3) {}
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
}

function defaultHeaders(extra) {
    var h = {
        "accept": "application/json, text/plain, */*",
        "origin": BASE_URL,
        "referer": BASE_URL + "/",
        "user-agent": getUa()
    };
    if (extra) {
        for (var k in extra) {
            if (extra.hasOwnProperty(k) && extra[k] != null) h[k] = extra[k];
        }
    }
    return h;
}

function parseJson(res) {
    if (!res) return null;
    try {
        if (typeof res.json === "function") {
            var j = res.json();
            if (j) return j;
        }
    } catch (e) {}
    try {
        var t = res.text();
        if (t) return JSON.parse(t);
    } catch (e2) {}
    return null;
}

function getCsrfTokenFromCookie(cookie) {
    var match = (((cookie || "") + "").match(/_csrfToken=([^;,\s<]+)/) || []);
    return match[1] || "";
}

function getCookieValue(cookie, name) {
    var m = String(cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return m ? m[1].trim() : "";
}

function dropCookie(cookie, name) {
    var parts = String(cookie || "").split(";");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (!p || p.indexOf(name + "=") === 0) continue;
        out.push(p);
    }
    return out.join("; ");
}

function mergeCookie(oldCookie, setCookie) {
    var map = {};
    function put(part) {
        part = (part || "").trim();
        if (!part) return;
        var eq = part.indexOf("=");
        if (eq < 1) return;
        var k = part.slice(0, eq).trim();
        var v = part.slice(eq + 1).trim();
        var low = k.toLowerCase();
        if (low === "path" || low === "domain" || low === "expires" || low === "max-age" || low === "secure" || low === "httponly" || low === "samesite") return;
        map[k] = v;
    }
    var oldParts = (oldCookie || "").split(";");
    for (var i = 0; i < oldParts.length; i++) put(oldParts[i]);
    var chunks = String(setCookie || "").split(/,(?=[^;]+?=)/);
    for (var j = 0; j < chunks.length; j++) {
        var first = chunks[j].split(";")[0];
        put(first);
    }
    var out = [];
    for (var key in map) {
        if (map.hasOwnProperty(key)) out.push(key + "=" + map[key]);
    }
    return out.join("; ");
}

function persistCookie(cookie) {
    if (!cookie || typeof localCookie === "undefined") return;
    try { localCookie.setCookie(cookie); } catch (e) {}
}

function readCookie() {
    if (typeof localCookie === "undefined") return "";
    try { return localCookie.getCookie(BASE_URL) || localCookie.getCookie() || ""; } catch (e) { return ""; }
}

function isCfChallengeText(text) {
    if (!text) return false;
    var s = ("" + text).toLowerCase();
    if (s.length > 80000) return false; // trang thật luôn lớn hơn 80KB
    var hasPhrase = s.indexOf("just a moment") >= 0 || s.indexOf("checking your browser") >= 0
        || s.indexOf("verify you are human") >= 0 || s.indexOf("attention required") >= 0
        || s.indexOf("cloudflare") >= 0 && s.indexOf("turnstile") >= 0;
    if (!hasPhrase) return false;
    return s.indexOf("challenge-platform") >= 0 || s.indexOf("challenges.cloudflare") >= 0
        || s.indexOf("_cf_chl") >= 0 || s.indexOf("cf-mitigated") >= 0;
}

function isCfBlocked(res) {
    if (!res) return false;
    if (res.status === 403 || res.status === 503) {
        try {
            var headers = res.headers || {};
            var mitigated = headers["cf-mitigated"] || headers["Cf-Mitigated"] || "";
            if (mitigated === "challenge") return true;
        } catch (e) {}
        try {
            var t = res.text();
            if (isCfChallengeText(t)) return true;
        } catch (e2) {}
    }
    return false;
}

// ====== BROWSER SESSION ĐỂ VƯỢT CLOUDFLARE ======
var DTH_SESSION = null; // { b, passed, at, loaded }
var DTH_SESSION_TTL = 10 * 60 * 1000;

function hasEngineBrowser() {
    return typeof Engine !== "undefined" && typeof Engine.newBrowser === "function";
}

function closeBrowser() {
    if (DTH_SESSION) {
        try { DTH_SESSION.b.close(); } catch (e) {}
        DTH_SESSION = null;
    }
}

function getBrowser() {
    if (!hasEngineBrowser()) return null;
    if (DTH_SESSION) {
        var dead = Date.now() - DTH_SESSION.at > DTH_SESSION_TTL;
        if (!dead && DTH_SESSION.loaded) {
            var r = null;
            try { r = DTH_SESSION.b.callJs("1", 3000); } catch (e) { r = null; }
            if (r === undefined || r === null) dead = true;
            else { DTH_SESSION.at = Date.now(); return DTH_SESSION.b; }
        }
        if (dead) closeBrowser();
        else return DTH_SESSION.b;
    }
    var b = Engine.newBrowser();
    try { b.setUserAgent(getUa()); } catch (e) {}
    DTH_SESSION = { b: b, passed: false, at: Date.now(), loaded: false };
    return DTH_SESSION.b;
}

function callStr(b, js, ms) {
    try {
        var r = b.callJs(js, ms || 3000);
        if (r === undefined || r === null) return null;
        return ("" + r).replace(/<[^>]*>/g, "").trim();
    } catch (e) { return null; }
}

function callRaw(b, js, ms) {
    try {
        var r = b.callJs(js, ms || 3000);
        if (r === undefined || r === null) return null;
        return "" + r;
    } catch (e) { return null; }
}

function harvestBrowserCookie() {
    if (typeof localCookie === "undefined") return;
    try {
        var j = localCookie.getCookie(BASE_URL) || localCookie.getCookie() || "";
        if (j) persistCookie(j);
    } catch (e) {}
}

function waitForPass(b, budgetMs) {
    var t0 = Date.now();
    var budget = budgetMs || 10000;
    while (Date.now() - t0 < budget) {
        var d = null;
        try { d = b.html(1500); } catch (e) {}
        var text = d ? ("" + d.html()) : "";
        if (text && !isCfChallengeText(text) && text.length > 500) {
            if (DTH_SESSION) { DTH_SESSION.passed = true; DTH_SESSION.at = Date.now(); }
            harvestBrowserCookie();
            return true;
        }
        sleep(600);
    }
    return false;
}

function warmBrowserCf() {
    var b = getBrowser();
    if (!b) return false;
    try {
        b.launch(BASE_URL + "/", 15000);
        if (DTH_SESSION) { DTH_SESSION.loaded = true; DTH_SESSION.at = Date.now(); }
        return waitForPass(b, 10000);
    } catch (e) {
        closeBrowser();
        return false;
    }
}

// Thực thi fetch trong context WebView đã vượt Cloudflare
var BFETCH_SEQ = 0;
function browserFetchJson(url, opts) {
    opts = opts || {};
    var b = getBrowser();
    if (!b) return null;

    if (!DTH_SESSION || !DTH_SESSION.passed) {
        if (!warmBrowserCf()) return null;
    }

    var id = "dth" + (++BFETCH_SEQ);
    var full = url.indexOf("http") === 0 ? url : (BASE_URL + url);
    var method = opts.method || "GET";
    var body = opts.body ? String(opts.body) : null;
    var headers = opts.headers || {};
    headers["Accept"] = headers["Accept"] || "application/json, text/plain, */*";
    headers["X-Requested-With"] = "XMLHttpRequest";

    var js = "(function(){var i='" + id + "';window[i+'s']=0;window[i+'r']='';"
        + "var o={method:" + JSON.stringify(method) + ",credentials:'same-origin',cache:'no-store',headers:" + JSON.stringify(headers) + "};"
        + (body ? "o.body=" + JSON.stringify(body) + ";" : "")
        + "fetch(" + JSON.stringify(full) + ",o).then(function(r){"
        + "window[i+'c']=r.status;"
        + "r.text().then(function(t){window[i+'r']=t;window[i+'s']=1;});"
        + "},function(e){window[i+'s']=2;});})()";

    try { b.callJs(js, 6000); } catch (e2) { return null; }

    var st = 0;
    for (var i = 0; i < 30; i++) {
        sleep(300);
        var n = parseInt(callStr(b, "window['" + id + "s']", 2000) || "", 10);
        if (!isNaN(n)) { st = n; if (st === 1 || st === 2) break; }
    }
    if (st !== 1) return null;

    var status = parseInt(callStr(b, "window['" + id + "c']", 2000) || "", 10);
    var len = parseInt(callStr(b, "(window['" + id + "r']||'').length", 2000) || "0", 10) || 0;
    var out = "";
    var CHUNK = 40000;
    for (var q = 0; q < len; q += CHUNK) {
        var part = callRaw(b, "(window['" + id + "r']||'').substring(" + q + "," + (q + CHUNK) + ")", 5000);
        if (part === null) { out = ""; break; }
        var wm = /<body>([\s\S]*)<\/body>/.exec(part);
        out += wm ? wm[1] : part;
    }
    try { b.callJs("try{delete window['" + id + "r'];delete window['" + id + "s'];delete window['" + id + "c'];}catch(e){}", 1500); } catch (e3) {}

    harvestBrowserCookie();

    return {
        ok: status >= 200 && status < 300,
        status: status,
        headers: {},
        text: function() { return out; },
        json: function() { try { return JSON.parse(out); } catch (e) { return null; } }
    };
}

function getValidTokenAndCookie() {
    var cookie = readCookie();
    var csrfToken = getCsrfTokenFromCookie(cookie);
    var base = getCookieValue(cookie, "dth_base") || BASE_URL;
    var bearer = getCookieValue(cookie, "dth_bearer");
    if (csrfToken) {
        BASE_URL = base;
        return { token: csrfToken, cookie: cookie, base: base, bearer: bearer };
    }
    var order = [base];
    for (var d = 0; d < DOMAINS.length; d++) {
        if (order.indexOf(DOMAINS[d]) < 0) order.push(DOMAINS[d]);
    }
    for (var i = 0; i < order.length; i++) {
        var dom = order[i];
        var res = fetch(dom + "/", { headers: defaultHeaders({ origin: dom, referer: dom + "/" }) });
        if (!res || !res.ok) continue;
        var setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
        var tok = getCsrfTokenFromCookie(setCookie);
        if (!tok) continue;
        BASE_URL = dom;
        cookie = mergeCookie(mergeCookie(cookie, setCookie), "_csrfToken=" + tok);
        cookie = mergeCookie(cookie, "dth_base=" + dom);
        persistCookie(cookie);
        return { token: tok, cookie: cookie, base: dom, bearer: bearer };
    }
    // all probes failed: fallback token
    csrfToken = "1wfcRpG3D0X2hWDnAYieWQrgwa6HJMglAgXq8chTHms";
    cookie = mergeCookie(cookie, "_csrfToken=" + csrfToken);
    persistCookie(cookie);
    return { token: csrfToken, cookie: cookie, base: base, bearer: bearer };
}

function buildApiUrl(path, base, token) {
    var url = path.indexOf("http") === 0 ? path : (base + path);
    if (url.indexOf("_csrfToken=") < 0) {
        url = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_csrfToken=" + encodeURIComponent(token);
    }
    return url;
}

function doApiFetch(url, opts, tc) {
    var headers = defaultHeaders(opts.headers || {});
    if (url.indexOf(tc.base) === 0) {
        headers["Cookie"] = tc.cookie;
        if (tc.bearer) headers["Authorization"] = "Bearer " + tc.bearer;
    }
    if (opts.referer) headers["referer"] = opts.referer;
    var res = fetch(url, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body
    });
    if (res) {
        var setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
        if (setCookie) persistCookie(mergeCookie(tc.cookie, setCookie));
    }
    return res;
}

function apiFetch(path, opts) {
    opts = opts || {};
    var tc = getValidTokenAndCookie();
    var fullUrl = buildApiUrl(path, tc.base, tc.token);
    var res = doApiFetch(fullUrl, opts, tc);

    // Nếu gặp Cloudflare challenge (403/503) và đang chạy trong vBook có Engine.newBrowser:
    // thử warm qua browser để lấy cf_clearance và fetch lại qua browserFetchJson.
    if (isCfBlocked(res)) {
        if (hasEngineBrowser()) {
            var bRes = browserFetchJson(fullUrl, opts);
            if (bRes && bRes.ok) return bRes;
        }
        // Thử lại fetch thường 1 lần phòng khi WebView đã cập nhật cookie jar dùng chung
        tc = getValidTokenAndCookie();
        res = doApiFetch(buildApiUrl(path, tc.base, tc.token), opts, tc);
    }

    if (res && res.status === 401 && hasCredentials()) {
        loginIfNeeded(true);
        tc = getValidTokenAndCookie();
        res = doApiFetch(buildApiUrl(path, tc.base, tc.token), opts, tc);
    }

    if (res && res.status === 403 && !isCfBlocked(res)) {
        persistCookie(dropCookie(readCookie(), "_csrfToken"));
        tc = getValidTokenAndCookie();
        res = doApiFetch(buildApiUrl(path, tc.base, tc.token), opts, tc);
    }
    return res;
}

function loginIfNeeded(force) {
    var username = configText("username");
    var password = configText("password");
    if (!username || !password) return;

    if (!force) {
        if (getCookieValue(readCookie(), "access_token")) return;
    } else {
        persistCookie(dropCookie(dropCookie(readCookie(), "access_token"), "dth_bearer"));
    }

    var tc = getValidTokenAndCookie();
    var headers = defaultHeaders({
        "Content-Type": "application/json",
        "Cookie": tc.cookie
    });
    if (tc.bearer) headers["Authorization"] = "Bearer " + tc.bearer;
    var loginRes = fetch(tc.base + "/api/auth/login?_csrfToken=" + encodeURIComponent(tc.token), {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            identifier: username,
            password: password
        })
    });
    if (!loginRes || !loginRes.ok) return;

    var setCookie = loginRes.headers["set-cookie"] || loginRes.headers["Set-Cookie"] || "";
    var merged = mergeCookie(tc.cookie, setCookie);
    var loginJson = parseJson(loginRes);
    var bearer = (loginJson && loginJson.data && loginJson.data.accessToken) ||
        (loginJson && loginJson.accessToken) || "";
    if (bearer) {
        merged = mergeCookie(merged, "access_token=" + bearer);
        merged = mergeCookie(merged, "dth_bearer=" + bearer);
    }
    persistCookie(merged);
}

// POST /api/models/user/chapter-purchases {chapterId} -> {wallet, purchase}
function buyChapter(chapterId, refererUrl) {
    var tc = getValidTokenAndCookie();
    var headers = defaultHeaders({
        "Content-Type": "application/json",
        "Cookie": tc.cookie,
        "referer": refererUrl
    });
    if (tc.bearer) headers["Authorization"] = "Bearer " + tc.bearer;
    var res = fetch(tc.base + "/api/models/user/chapter-purchases?_csrfToken=" + encodeURIComponent(tc.token), {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ chapterId: String(chapterId) })
    });
    if (!res) return { ok: false, message: "không có phản hồi từ server" };
    if (res.ok) return { ok: true };
    var j = parseJson(res) || {};
    var msg = (j.data && j.data.message) || j.message || j.statusMessage || ("HTTP " + res.status);
    return { ok: false, message: String(msg).slice(0, 140) };
}

function authorName(item) {
    if (!item) return "N/A";
    if (item.author && item.author.name) return String(item.author.name).trim();
    if (item.authorName) return String(item.authorName).trim();
    if (typeof item.author === "string") return item.author.trim();
    return "N/A";
}

function storyTitle(item) {
    if (!item) return "";
    return String(item.titleChinese || item.nameChinese || item.title || item.name || "").trim();
}

function extractStoryId(url) {
    if (!url) return null;
    var m = String(url).match(/truyen\/(\d+)/);
    return m ? m[1] : null;
}

function extractChapterIds(url) {
    if (!url) return null;
    var m = String(url).match(/truyen\/(\d+)\/(\d+)/);
    if (!m) return null;
    return { storyId: m[1], chapterId: m[2] };
}

/**
 * Map sourceUrl host -> crawl API name (/api/models/source)
 * crawl=true: 69shuba, 82zg.com, bookqq, fanqienovel, m.novel.qq.com,
 *             magev6.if.qidian.com, piaotia, trxs, uukanshu
 * crawl=false: faloo, m.qidian.com, qidian.com, ubook.reader.qq.com
 */
function getSourceName(sourceUrl) {
    if (!sourceUrl) return "";
    var u = String(sourceUrl).toLowerCase();
    if (u.indexOf("book.qq.com") >= 0) return "bookqq";
    if (u.indexOf("m.novel.qq.com") >= 0) return "m.novel.qq.com";
    if (u.indexOf("ubook.reader.qq.com") >= 0) return "ubook.reader.qq.com";
    if (u.indexOf("69shuba") >= 0) return "69shuba";
    if (u.indexOf("82zg.com") >= 0) return "82zg.com";
    if (u.indexOf("faloo") >= 0) return "faloo";
    if (u.indexOf("fanqienovel.com") >= 0 || u.indexOf("fanqie") >= 0) return "fanqienovel";
    if (u.indexOf("magev6.if.qidian.com") >= 0) return "magev6.if.qidian.com";
    if (u.indexOf("m.qidian.com") >= 0) return "m.qidian.com";
    if (u.indexOf("qidian.com") >= 0) return "qidian.com";
    if (u.indexOf("piaotia.com") >= 0 || u.indexOf("piaotian.com") >= 0) return "piaotia";
    if (u.indexOf("trxs") >= 0) return "trxs";
    if (u.indexOf("uukanshu") >= 0) return "uukanshu";
    return "";
}

function formatContent(content) {
    if (!content) return "";
    var html = String(content);
    if (html.indexOf("<p") < 0 && html.indexOf("<br") < 0 && html.indexOf("<div") < 0) {
        html = html
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/\n/g, "<br>");
    }
    return html;
}
