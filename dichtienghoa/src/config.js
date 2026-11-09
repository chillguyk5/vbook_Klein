var BASE_URL = "https://dichtienghoa.net";
var DOMAINS = ["https://dichtienghoa.net", "https://dichtienghoa.site", "https://dichtienghoa.com"];

function getUa() {
    if (typeof UserAgent !== "undefined") {
        if (typeof UserAgent.android === "function") return UserAgent.android() + "";
        if (typeof UserAgent.chrome === "function") return UserAgent.chrome() + "";
    }
    return "Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.47 Mobile Safari/537.36";
}

function configText(name) {
    var raw = this[name];
    if (raw === undefined || raw === null) return "";
    return String(raw).trim();
}

function getBuyMode() {
    var v = this["auto_buy"];
    if (v === true || v === 1) return "on";
    if (v === false || v === 0) return "off";
    if (v === undefined || v === null) return "confirm";
    v = String(v).toLowerCase().trim();
    if (v === "off" || v === "false" || v === "0") return "off";
    if (v === "on" || v === "true" || v === "1" || v === "yes" || v.indexOf("on") === 0) return "on";
    return "confirm";
}

function autoBuyOn() {
    return getBuyMode() === "on";
}

function hasCredentials() {
    return !!configText("username") && !!configText("password");
}

// ============ COOKIE & STORAGE ============
var _cookieCache = null;

function saveCookie(cookie) {
    if (!cookie) return;
    _cookieCache = cookie;
    if (typeof localStorage !== "undefined") localStorage.setItem("dth_cookie", cookie);
    if (typeof localCookie !== "undefined") localCookie.setCookie(cookie);
}

function getCookie() {
    if (_cookieCache) return _cookieCache;
    var c1 = typeof localStorage !== "undefined" ? (localStorage.getItem("dth_cookie") || "") : "";
    var c2 = typeof localCookie !== "undefined" ? (localCookie.getCookie(BASE_URL) || "") : "";
    if (!c1) return (_cookieCache = c2);
    if (!c2) return (_cookieCache = c1);
    var parts = (c1 + "; " + c2).split(";"), map = {}, i, eq, k;
    for (i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        eq = p.indexOf("=");
        if (eq > 0) map[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
    var out = [];
    for (k in map) out.push(k + "=" + map[k]);
    _cookieCache = out.join("; ");
    return _cookieCache;
}

function getCookieVal(cookie, name) {
    var m = (cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return m ? m[1].trim() : "";
}

function dropCookie(cookie, name) {
    var parts = (cookie || "").split(";"), out = [], i, p;
    for (i = 0; i < parts.length; i++) {
        p = parts[i].trim();
        if (p && p.indexOf(name + "=") !== 0) out.push(p);
    }
    return out.join("; ");
}

function mergeCookie(oldC, newC) {
    if (!oldC) return newC || "";
    if (!newC) return oldC;
    var map = {}, i, p, eq, k;
    var raw = (oldC + "; " + newC).split(";");
    for (i = 0; i < raw.length; i++) {
        p = raw[i].trim();
        eq = p.indexOf("=");
        if (eq > 0) {
            k = p.slice(0, eq).trim();
            var l = k.toLowerCase();
            if (l !== "path" && l !== "domain" && l !== "expires" && l !== "max-age" && l !== "secure" && l !== "httponly" && l !== "samesite") {
                map[k] = p.slice(eq + 1).trim();
            }
        }
    }
    var out = [];
    for (k in map) out.push(k + "=" + map[k]);
    return out.join("; ");
}

// Backward-compat aliases used by tests or external callers
function readCookie() { return getCookie(); }
function persistCookie(c) { saveCookie(c); }
function getCookieValue(c, n) { return getCookieVal(c, n); }

// ============ USER & WALLET CACHE ============
function getCachedUser() {
    if (typeof localStorage === "undefined") return null;
    var raw = localStorage.getItem("dth_user");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function saveCachedUser(username, user) {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("dth_user", JSON.stringify({ username: username, user: user, time: Date.now() }));
    }
}

function clearCachedUser() {
    if (typeof localStorage !== "undefined") {
        localStorage.removeItem("dth_user");
        localStorage.removeItem("dth_wallet");
    }
}

function clearCachedWallet() {
    if (typeof localStorage !== "undefined") localStorage.removeItem("dth_wallet");
}

function getUserWallet(force) {
    if (typeof localStorage !== "undefined" && !force) {
        var raw = localStorage.getItem("dth_wallet");
        if (raw) {
            try {
                var c = JSON.parse(raw);
                if (Date.now() - c.time < 300000) return c.wallet;
            } catch (e) {}
        }
    }
    var res = apiFetch("/api/models/user/wallet");
    var json = parseJson(res);
    var wallet = (json && json.data) ? json.data : json;
    if (wallet && wallet.balance !== undefined) {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("dth_wallet", JSON.stringify({ wallet: wallet, time: Date.now() }));
        }
        return wallet;
    }
    return null;
}

function isUserAuthenticated() {
    if (hasCredentials()) return true;
    var cached = getCachedUser();
    if (cached && cached.username) return true;
    var cookie = getCookie();
    var tok = getCookieVal(cookie, "access_token") || getCookieVal(cookie, "dth_bearer") || getCookieVal(cookie, "token");
    if (tok) return true;
    return !!(cookie && (cookie.indexOf("session") >= 0 || cookie.indexOf("auth") >= 0));
}

function syncAuthFromCookie(force) {
    if (!force) {
        var cached = getCachedUser();
        if (cached && cached.username && cached.time && (Date.now() - cached.time < 300000)) return cached;
    }
    var cookie = getCookie();
    var tok = getCookieVal(cookie, "access_token") || getCookieVal(cookie, "dth_bearer") || getCookieVal(cookie, "token");
    if (!tok && cookie.indexOf("session") < 0 && cookie.indexOf("auth") < 0) return null;

    var res = apiFetch("/api/auth/me");
    if (!res || !res.ok) {
        if (res && (res.status === 401 || res.status === 403)) clearCachedUser();
        return null;
    }

    var json = parseJson(res);
    var u = (json && json.data) ? json.data : (json && (json.user || json));
    if (!u) return null;
    var uname = u.username || u.name || u.email || u.identifier || "";
    if (uname) {
        saveCachedUser(uname, u);
        return { username: uname, user: u, time: Date.now() };
    }
    return null;
}

// ============ HTTP & CLOUDFLARE ============
function parseJson(res) {
    if (!res) return null;
    if (typeof res.json === "function") {
        try { return res.json(); } catch (e) {}
    }
    if (typeof res.text === "function") {
        try { return JSON.parse(res.text()); } catch (e2) {}
    }
    return null;
}

function isCfChallengeText(text) {
    if (!text || text.length > 80000) return false;
    var s = text.toLowerCase();
    return (s.indexOf("just a moment") >= 0 || s.indexOf("verify you are human") >= 0 || s.indexOf("turnstile") >= 0) &&
           (s.indexOf("challenge-platform") >= 0 || s.indexOf("_cf_chl") >= 0 || s.indexOf("cf-mitigated") >= 0);
}

function isCfBlocked(res) {
    if (!res || (res.status !== 403 && res.status !== 503)) return false;
    var h = res.headers;
    if (h && (h["cf-mitigated"] === "challenge" || h["Cf-Mitigated"] === "challenge")) return true;
    var t = typeof res.text === "function" ? res.text() : "";
    return isCfChallengeText(t);
}

// Off-screen browser session for Cloudflare challenges
var DTH_SESSION = null;
function hasEngineBrowser() {
    return typeof Engine !== "undefined" && typeof Engine.newBrowser === "function";
}

function getBrowser() {
    if (!hasEngineBrowser()) return null;
    if (DTH_SESSION) {
        var dead = Date.now() - DTH_SESSION.at > 600000;
        if (!dead && DTH_SESSION.loaded) {
            var r = null;
            try { r = DTH_SESSION.b.callJs("1", 3000); } catch (e) {}
            if (r === undefined || r === null) dead = true;
            else { DTH_SESSION.at = Date.now(); return DTH_SESSION.b; }
        }
        if (dead) {
            try { DTH_SESSION.b.close(); } catch (e2) {}
            DTH_SESSION = null;
        } else return DTH_SESSION.b;
    }
    var b = Engine.newBrowser();
    try { b.setUserAgent(_UA); } catch (e3) {}
    DTH_SESSION = { b: b, passed: false, at: Date.now(), loaded: false };
    return DTH_SESSION.b;
}

function browserFetchJson(url, opts) {
    opts = opts || {};
    var b = getBrowser();
    if (!b) return null;

    if (!DTH_SESSION || !DTH_SESSION.passed) {
        try {
            b.launch(BASE_URL + "/", 15000);
            if (DTH_SESSION) { DTH_SESSION.loaded = true; DTH_SESSION.at = Date.now(); }
            var t0 = Date.now();
            while (Date.now() - t0 < 2500) {
                var d = b.html(1200);
                var text = d ? (d.html() + "") : "";
                if (text && !isCfChallengeText(text) && text.length > 500) {
                    if (DTH_SESSION) { DTH_SESSION.passed = true; DTH_SESSION.at = Date.now(); }
                    var j = typeof localCookie !== "undefined" ? (localCookie.getCookie(BASE_URL) || "") : "";
                    if (j) saveCookie(j);
                    break;
                }
                sleep(400);
            }
        } catch (e) {
            if (DTH_SESSION) { try { DTH_SESSION.b.close(); } catch (ce) {} DTH_SESSION = null; }
            return null;
        }
    }

    var full = url.indexOf("http") === 0 ? url : (BASE_URL + url);
    var id = "dth" + Date.now();
    var cleanH = { "Accept": "application/json, text/plain, */*", "X-Requested-With": "XMLHttpRequest" };
    var js = "(function(){var i='" + id + "';window[i+'s']=0;window[i+'r']='';"
        + "fetch(" + JSON.stringify(full) + ",{method:" + JSON.stringify(opts.method || "GET") + ",credentials:'include',cache:'no-store',headers:" + JSON.stringify(cleanH) + (opts.body ? ",body:" + JSON.stringify(String(opts.body)) : "") + "}).then(function(r){"
        + "window[i+'c']=r.status;r.text().then(function(t){window[i+'r']=t;window[i+'s']=1;});"
        + "},function(){window[i+'s']=2;});})()";

    try { b.callJs(js, 6000); } catch (e2) { return null; }

    var st = 0;
    for (var i = 0; i < 30; i++) {
        sleep(300);
        var n = parseInt(String(b.callJs("window['" + id + "s']", 2000) || ""), 10);
        if (!isNaN(n)) { st = n; if (st === 1 || st === 2) break; }
    }
    if (st !== 1) return null;

    var status = parseInt(String(b.callJs("window['" + id + "c']", 2000) || ""), 10);
    var out = String(b.callJs("window['" + id + "r']||''", 5000) || "").replace(/<[^>]*>/g, "");
    try { b.callJs("delete window['" + id + "r'];delete window['" + id + "s'];delete window['" + id + "c'];", 1000); } catch (e3) {}

    return {
        ok: status >= 200 && status < 300,
        status: status,
        headers: {},
        text: function() { return out; },
        json: function() { try { return JSON.parse(out); } catch (e) { return null; } }
    };
}

// ============ API FETCH (UNIFIED ENGINE) ============
function getTokenCtx() {
    var cookie = getCookie();
    var m = (cookie || "").match(/_csrfToken=([^;,\s<]+)/);
    var csrf = m ? m[1] : "";
    var base = getCookieVal(cookie, "dth_base") || BASE_URL;
    var bearer = getCookieVal(cookie, "dth_bearer") || getCookieVal(cookie, "access_token") || getCookieVal(cookie, "token");
    if (csrf) {
        BASE_URL = base;
        return { token: csrf, cookie: cookie, base: base, bearer: bearer };
    }

    var order = [base];
    for (var d = 0; d < DOMAINS.length; d++) {
        if (order.indexOf(DOMAINS[d]) < 0) order.push(DOMAINS[d]);
    }
    for (var i = 0; i < order.length; i++) {
        var dom = order[i];
        var res = fetch(dom + "/", { headers: { "user-agent": getUa(), "origin": dom, "referer": dom + "/" } });
        if (!res || !res.ok) continue;
        var sc = (res.headers && (res.headers["set-cookie"] || res.headers["Set-Cookie"])) || "";
        var tm = sc.match(/_csrfToken=([^;,\s<]+)/);
        if (tm) {
            BASE_URL = dom;
            cookie = mergeCookie(mergeCookie(cookie, sc), "_csrfToken=" + tm[1] + "; dth_base=" + dom);
            saveCookie(cookie);
            return { token: tm[1], cookie: cookie, base: dom, bearer: bearer };
        }
    }
    csrf = "1wfcRpG3D0X2hWDnAYieWQrgwa6HJMglAgXq8chTHms";
    cookie = mergeCookie(cookie, "_csrfToken=" + csrf);
    saveCookie(cookie);
    return { token: csrf, cookie: cookie, base: base, bearer: bearer };
}

function buildHeaders(extra, tc) {
    var h = {
        "accept": "application/json, text/plain, */*",
        "origin": tc ? tc.base : BASE_URL,
        "referer": (tc ? tc.base : BASE_URL) + "/",
        "user-agent": getUa(),
        "x-csrf-token": tc ? tc.token : "",
        "Cookie": tc ? tc.cookie : ""
    };
    if (tc && tc.bearer) h["Authorization"] = "Bearer " + tc.bearer;
    if (extra) {
        for (var k in extra) {
            if (extra.hasOwnProperty(k) && extra[k] != null) h[k] = extra[k];
        }
    }
    return h;
}

function apiFetch(path, opts) {
    opts = opts || {};
    var tc = getTokenCtx();
    var full = path.indexOf("http") === 0 ? path : (tc.base + path);
    if (full.indexOf("_csrfToken=") < 0) {
        full += (full.indexOf("?") >= 0 ? "&" : "?") + "_csrfToken=" + encodeURIComponent(tc.token);
    }
    var headers = buildHeaders(opts.headers, tc);
    if (opts.referer) headers["referer"] = opts.referer;
    if (opts.method === "POST" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

    var res = fetch(full, { method: opts.method || "GET", headers: headers, body: opts.body });
    if (res && res.headers) {
        var sc = res.headers["set-cookie"] || res.headers["Set-Cookie"];
        if (sc) saveCookie(mergeCookie(tc.cookie, sc));
    }

    if (isCfBlocked(res)) {
        if (hasEngineBrowser()) {
            var bRes = browserFetchJson(full, opts);
            if (bRes && bRes.ok) return bRes;
        }
        return res;
    }

    if (res && res.status === 401 && hasCredentials()) {
        loginIfNeeded(true);
        tc = getTokenCtx();
        res = fetch(full, { method: opts.method || "GET", headers: buildHeaders(opts.headers, tc), body: opts.body });
    }

    if (res && res.status === 403 && !isCfBlocked(res)) {
        saveCookie(dropCookie(getCookie(), "_csrfToken"));
        _cookieCache = null;
        tc = getTokenCtx();
        res = fetch(full, { method: opts.method || "GET", headers: buildHeaders(opts.headers, tc), body: opts.body });
    }

    return res;
}

// ============ AUTH ACTIONS ============
function loginIfNeeded(force) {
    var username = configText("username");
    var password = configText("password");
    if (!username || !password) {
        var cookieUser = syncAuthFromCookie(force);
        if (cookieUser) return { ok: true, user: cookieUser.user, fromCookie: true };
        var tok = getCookieVal(getCookie(), "access_token") || getCookieVal(getCookie(), "dth_bearer");
        if (tok) return { ok: true, user: null, fromCookie: true };
        return { ok: false, message: "Chưa đăng nhập (vào cài đặt hoặc đăng nhập trên web)" };
    }

    if (!force) {
        var existingTok = getCookieVal(getCookie(), "access_token");
        var cached = getCachedUser();
        if (existingTok && (!cached || cached.username === username)) return { ok: true, user: cached ? cached.user : null };
    } else {
        saveCookie(dropCookie(dropCookie(getCookie(), "access_token"), "dth_bearer"));
        _cookieCache = null;
        clearCachedUser();
    }

    var tc = getTokenCtx();
    var fullUrl = tc.base + "/api/auth/login?_csrfToken=" + encodeURIComponent(tc.token);
    var bodyStr = JSON.stringify({ identifier: username, password: password });
    var headers = buildHeaders({
        "Content-Type": "application/json",
        "referer": tc.base + "/dang-nhap"
    }, tc);

    var loginRes = fetch(fullUrl, { method: "POST", headers: headers, body: bodyStr });
    if (isCfBlocked(loginRes) && hasEngineBrowser()) {
        loginRes = browserFetchJson(fullUrl, { method: "POST", headers: headers, body: bodyStr });
    }

    if (!loginRes || !loginRes.ok) {
        var errJ = parseJson(loginRes) || {};
        var errMsg = (errJ.data && errJ.data.message) || errJ.message || ("Đăng nhập thất bại (" + (loginRes ? loginRes.status : "không phản hồi") + ")");
        clearCachedUser();
        return { ok: false, message: String(errMsg).slice(0, 140) };
    }

    var setC = (loginRes.headers && (loginRes.headers["set-cookie"] || loginRes.headers["Set-Cookie"])) || "";
    var merged = mergeCookie(tc.cookie, setC);
    var loginJson = parseJson(loginRes) || {};
    var bearer = (loginJson.data && loginJson.data.accessToken) || loginJson.accessToken || "";
    if (bearer) {
        merged = mergeCookie(merged, "access_token=" + bearer + "; dth_bearer=" + bearer);
    }
    saveCookie(merged);

    var user = loginJson.user || (loginJson.data && loginJson.data.user) || { username: username };
    saveCachedUser(username, user);
    clearCachedWallet();
    return { ok: true, user: user };
}

function buyChapter(chapterId, refererUrl) {
    var logRes = loginIfNeeded();
    if (!logRes.ok && !isUserAuthenticated()) {
        return { ok: false, message: logRes.message || "Chưa đăng nhập" };
    }
    var tc = getTokenCtx();
    var headers = { "Content-Type": "application/json", "referer": refererUrl || (tc.base + "/") };
    var res = apiFetch("/api/models/user/chapter-purchases", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ chapterId: String(chapterId) })
    });
    if (!res) return { ok: false, message: "không có phản hồi từ server" };
    if (res.status === 401 && hasCredentials()) {
        loginIfNeeded(true);
        res = apiFetch("/api/models/user/chapter-purchases", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ chapterId: String(chapterId) })
        });
        if (!res) return { ok: false, message: "không có phản hồi sau khi đăng nhập lại" };
    }
    if (res.ok) {
        clearCachedWallet();
        return { ok: true };
    }
    var j = parseJson(res) || {};
    var msg = (j.data && j.data.message) || j.message || j.statusMessage || ("HTTP " + res.status);
    return { ok: false, message: String(msg).slice(0, 140) };
}

// ============ UTILS ============
function extractStoryId(url) {
    var m = (url || "").match(/truyen\/(\d+)/);
    return m ? m[1] : null;
}

function extractChapterIds(url) {
    var m = (url || "").match(/truyen\/(\d+)\/(\d+)/);
    return m ? { storyId: m[1], chapterId: m[2] } : null;
}

function authorName(item) {
    if (!item) return "N/A";
    return (item.author && item.author.name) || item.authorName || (typeof item.author === "string" ? item.author : "N/A");
}

function storyTitle(item) {
    if (!item) return "";
    return item.titleChinese || item.nameChinese || item.title || item.name || "";
}

function getSourceName(sourceUrl) {
    if (!sourceUrl) return "";
    var u = sourceUrl.toLowerCase();
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
    var s = String(content);
    if (s.indexOf("<p") >= 0 || s.indexOf("<br") >= 0 || s.indexOf("<div") >= 0) return s;
    return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\n/g, "<br>");
}
