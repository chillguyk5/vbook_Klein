var BASE_URL = "https://dichtienghoa.site";

function configText(name) {
    try {
        var raw = this[name];
        raw = raw === undefined || raw === null ? "" : String(raw);
        return raw.replace(/"/g, "").trim();
    } catch (e) {
        return "";
    }
}

function defaultHeaders(extra) {
    var h = {
        "accept": "application/json, text/plain, */*",
        "origin": BASE_URL,
        "referer": BASE_URL + "/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
    try { return localCookie.getCookie() || ""; } catch (e) { return ""; }
}

function getValidTokenAndCookie() {
    var cookie = readCookie();
    var csrfToken = getCsrfTokenFromCookie(cookie);
    if (!csrfToken) {
        var res = fetch(BASE_URL + "/", { headers: defaultHeaders() });
        if (res && res.ok) {
            var setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
            if (!setCookie && res.request && res.request.headers) {
                setCookie = res.request.headers.cookie || res.request.headers.Cookie || "";
            }
            cookie = mergeCookie(cookie, setCookie);
            csrfToken = getCsrfTokenFromCookie(cookie) || getCsrfTokenFromCookie(setCookie);
            if (csrfToken) {
                cookie = mergeCookie(cookie, "_csrfToken=" + csrfToken);
                persistCookie(cookie);
            }
        }
    }
    if (!csrfToken) {
        csrfToken = "1wfcRpG3D0X2hWDnAYieWQrgwa6HJMglAgXq8chTHms";
        cookie = mergeCookie(cookie, "_csrfToken=" + csrfToken);
        persistCookie(cookie);
    }
    return { token: csrfToken, cookie: cookie };
}

function apiFetch(path, opts) {
    opts = opts || {};
    var tc = getValidTokenAndCookie();
    var sep = path.indexOf("?") >= 0 ? "&" : "?";
    var url = path.indexOf("http") === 0 ? path : (BASE_URL + path);
    if (url.indexOf("_csrfToken=") < 0) {
        url = url + sep + "_csrfToken=" + encodeURIComponent(tc.token);
    }
    var headers = defaultHeaders(opts.headers || {});
    headers["Cookie"] = tc.cookie;
    if (opts.referer) headers["referer"] = opts.referer;
    var res = fetch(url, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body
    });
    if (res) {
        var setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || "";
        if (setCookie) {
            var merged = mergeCookie(tc.cookie, setCookie);
            persistCookie(merged);
        }
    }
    if (res && res.status === 403) {
        var homeRes = fetch(BASE_URL + "/", { headers: defaultHeaders() });
        if (homeRes && homeRes.ok) {
            var sc = homeRes.headers["set-cookie"] || homeRes.headers["Set-Cookie"] || "";
            var newCookie = mergeCookie(readCookie(), sc);
            var newToken = getCsrfTokenFromCookie(newCookie) || getCsrfTokenFromCookie(sc);
            if (newToken) {
                newCookie = mergeCookie(newCookie, "_csrfToken=" + newToken);
                persistCookie(newCookie);
                var url2 = path.indexOf("http") === 0 ? path : (BASE_URL + path);
                url2 = url2.replace(/([?&])_csrfToken=[^&]*/g, "$1").replace(/[?&]$/, "");
                url2 = url2 + (url2.indexOf("?") >= 0 ? "&" : "?") + "_csrfToken=" + encodeURIComponent(newToken);
                headers["Cookie"] = newCookie;
                res = fetch(url2, {
                    method: opts.method || "GET",
                    headers: headers,
                    body: opts.body
                });
            }
        }
    }
    return res;
}

function loginIfNeeded() {
    var username = configText("username");
    var password = configText("password");
    if (!username || !password) return;

    var cookie = readCookie();
    if (cookie.indexOf("access_token") !== -1) return;

    var tc = getValidTokenAndCookie();
    var loginRes = fetch(BASE_URL + "/api/auth/login?_csrfToken=" + encodeURIComponent(tc.token), {
        method: "POST",
        headers: defaultHeaders({
            "Content-Type": "application/json",
            "Cookie": tc.cookie
        }),
        body: JSON.stringify({
            identifier: username,
            password: password
        })
    });

    if (!loginRes || !loginRes.ok) return;

    var setCookie = loginRes.headers["set-cookie"] || loginRes.headers["Set-Cookie"] || "";
    var merged = mergeCookie(tc.cookie, setCookie);
    var loginJson = parseJson(loginRes);
    if (loginJson && loginJson.data && loginJson.data.accessToken) {
        merged = mergeCookie(merged, "access_token=" + loginJson.data.accessToken);
    } else if (loginJson && loginJson.accessToken) {
        merged = mergeCookie(merged, "access_token=" + loginJson.accessToken);
    }
    persistCookie(merged);
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

function cleanCnTitleText(raw) {
    raw = String(raw || "")
        .replace(/<\/?[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\(\)\s*$/g, "")
        .replace(/在线阅读[\s\S]*$/g, "")
        .replace(/_QQ阅读[\s\S]*$/g, "")
        .replace(/QQ阅读[\s\S]*$/g, "")
        .replace(/\s+/g, " ")
        .trim();
    var cut = raw.search(/[<{\"']/);
    if (cut > 0) raw = raw.slice(0, cut).trim();
    return raw;
}

/** Chinese chapter title from body first line — patterns differ by source. */
function extractTitleFromContent(content) {
    if (!content) return "";
    var text = String(content).replace(/^\uFEFF/, "");
    text = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "");
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < Math.min(lines.length, 8); i++) {
        var line = lines[i].replace(/^[\s\u3000\u00a0]+|[\s\u3000\u00a0]+$/g, "");
        if (!line) continue;
        line = cleanCnTitleText(line);
        if (/^第\s*\d+\s*章/.test(line)) return line.slice(0, 80);
        if (/^第[零〇一二三四五六七八九十百千万两\d\s]+章/.test(line)) return line.slice(0, 80);
        if (/^(序章|楔子|终章|終章|番外|尾声|后记|後記)/.test(line) && line.length <= 60) return line;
        break;
    }
    return "";
}
