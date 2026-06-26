var STV_ORIGIN = (typeof stv_origin !== "undefined" && stv_origin ? stv_origin.replace(/\/$/, "") : "https://dns1.stv-appdomain-00000001.org");
var STV_DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
var STV_ANDROID_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
var STV_URL_REGEX = /\/truyen\/([^\/]+)\/\d+\/(\d+)(?:\/(\d+))?\/?$/i;
var STV_CJK_CHAR_CLASS = "\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF";
var STV_CJK_PUNCT_CLASS = "\\u3000-\\u303F\\uFF00-\\uFFEF";
var STV_CJK_TOKEN_CLASS = STV_CJK_CHAR_CLASS + STV_CJK_PUNCT_CLASS;
var STV_TRANSLATION_MODE = "chinese";

function parseStvCookieJar(cookieText) {
    let order = [];
    let map = {};
    let parts = String(cookieText || "").split(";");

    for (let i = 0; i < parts.length; i++) {
        let piece = String(parts[i] || "").trim();
        if (!piece) {
            continue;
        }

        let eqIndex = piece.indexOf("=");
        if (eqIndex < 1) {
            continue;
        }

        let name = piece.substring(0, eqIndex).trim();
        let value = piece.substring(eqIndex + 1).trim();
        if (!name) {
            continue;
        }

        if (!map.hasOwnProperty(name)) {
            order.push(name);
        }
        map[name] = value;
    }

    return {
        order: order,
        map: map
    };
}

function serializeStvCookieJar(jar) {
    if (!jar || !jar.order || !jar.map) {
        return "";
    }

    let parts = [];
    for (let i = 0; i < jar.order.length; i++) {
        let name = jar.order[i];
        if (!jar.map.hasOwnProperty(name)) {
            continue;
        }

        let value = jar.map[name];
        if (typeof value === "undefined") {
            continue;
        }
        parts.push(name + "=" + value);
    }

    return parts.join("; ");
}

function readStvRequestCookie(response) {
    try {
        if (response && response.request && response.request.headers && response.request.headers.cookie) {
            return String(response.request.headers.cookie);
        }
    } catch (error) {
    }

    return "";
}

function captureStvSessionCookie(meta, userAgent) {
    if (!meta) {
        return "";
    }

    if (typeof meta.sessionCookie === "string" && meta.sessionCookie) {
        return meta.sessionCookie;
    }

    if (typeof stv_cookie !== "undefined" && stv_cookie) {
        meta.sessionCookie = String(stv_cookie);
        return meta.sessionCookie;
    }

    let urls = [];
    if (meta.chapterId) {
        urls.push(buildStvChapterUrl(meta, meta.chapterId));
    }
    urls.push(buildStvBookUrl(meta));

    let headers = {
        "User-Agent": userAgent || STV_DESKTOP_UA
    };
    let cookie = "";

    for (let i = 0; i < urls.length; i++) {
        try {
            let probe = fetch(urls[i], { headers: headers });
            cookie = readStvRequestCookie(probe);
            if (cookie) {
                break;
            }
        } catch (error) {
        }
    }

    meta.sessionCookie = cookie || "";
    return meta.sessionCookie;
}

function getStvHeaders() {
    return {
        "Cookie": "lang=zh; transmode=1",
        "User-Agent": STV_DESKTOP_UA
    };
}

function getStvTocHeaders(meta) {
    return {
        "Cookie": "lang=zh; transmode=1",
        "User-Agent": STV_DESKTOP_UA,
        "Referer": buildStvBookUrl(meta)
    };
}

function normalizeStvTransmode(mode) {
    let text = String(mode || "").toLowerCase().trim();
    if (text === "name" || text === "chinese" || text === "1" || text === "tfms") {
        return text;
    }
    
    if (text.indexOf("llm") !== -1) {
        return "chinese";
    }

    return "";
}

function getStvLegacyChapterTransmode(meta) {
    return meta && (meta.host === "sangtac" || meta.host === "dich") ? "name" : "chinese";
}

function getStvChapterTransmode(meta) {
    let configured = normalizeStvTransmode(STV_TRANSLATION_MODE);
    return configured || getStvLegacyChapterTransmode(meta);
}

function buildStvChapterCookie(transmode, baseCookie) {
    let normalized = normalizeStvTransmode(transmode) || "chinese";
    let jar = parseStvCookieJar(baseCookie);

    if (jar.order.length === 0) {
        jar.order = ["lang", "transmode"];
        jar.map.lang = "zh";
        jar.map.transmode = normalized;
        return serializeStvCookieJar(jar);
    }

    if (!jar.map.hasOwnProperty("lang")) {
        jar.order.push("lang");
    }
    jar.map.lang = "zh";

    if (!jar.map.hasOwnProperty("transmode")) {
        jar.order.push("transmode");
    }
    jar.map.transmode = normalized;

    return serializeStvCookieJar(jar);
}

function getStvChapterHeaders(meta, transmode, userAgent, baseCookie) {
    let cookie = buildStvChapterCookie(transmode, baseCookie || captureStvSessionCookie(meta, userAgent));
    let headers = {
        "User-Agent": userAgent || STV_DESKTOP_UA
    };

    if (cookie) {
        headers["Cookie"] = cookie;
    }

    if (meta && meta.chapterId) {
        headers["Referer"] = buildStvChapterUrl(meta, meta.chapterId);
    }

    return headers;
}

function getStvLocalStorage() {
    try {
        if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function" && typeof localStorage.setItem === "function") {
            return localStorage;
        }
    } catch (error) {
    }

    return undefined;
}

function readStvStorageText(key) {
    let storage = getStvLocalStorage();
    if (!storage || !key) {
        return "";
    }

    try {
        let value = storage.getItem(String(key));
        return typeof value === "string" ? value : "";
    } catch (error) {
        return "";
    }
}

function writeStvStorageText(key, value) {
    let storage = getStvLocalStorage();
    if (!storage || !key) {
        return false;
    }

    try {
        storage.setItem(String(key), typeof value === "undefined" ? "" : String(value));
        return true;
    } catch (error) {
        return false;
    }
}

function deleteStvStorageText(key) {
    let storage = getStvLocalStorage();
    if (!storage || !key) {
        return false;
    }

    try {
        if (typeof storage.removeItem === "function") {
            storage.removeItem(String(key));
            return true;
        }
    } catch (error) {
    }

    return false;
}

function hasStvStorageKey(key) {
    let storage = getStvLocalStorage();
    if (!storage || !key) {
        return false;
    }

    try {
        return storage.getItem(String(key)) !== null;
    } catch (error) {
        return false;
    }
}

function getStvStorageKeys() {
    let storage = getStvLocalStorage();
    let keys = [];
    if (!storage) {
        return keys;
    }

    try {
        let length = Number(storage.length || 0);
        for (let i = 0; i < length; i++) {
            let key = storage.key(i);
            if (typeof key === "string" && key) {
                keys.push(key);
            }
        }
    } catch (error) {
    }

    return keys;
}

function buildStvStorageSegment(value, fallback) {
    let text = safeStvText(value).toLowerCase().replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
    return text || fallback || "unknown";
}




function safeStvText(value) {
    if (!value) {
        return "";
    }

    return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

var STV_DOMAIN_REGEX = /^(https?:\/\/(?:[\w-]+\.)*(?:sangtacviet\.(?:app|com|pro|vip)|14\.225\.254\.182|103\.82\.20\.93|dns1\.stv-appdomain-\d+\.org))/i;

function normalizeStvUrl(url) {
    if (!url) {
        return STV_ORIGIN;
    }

    if (/^https?:\/\//i.test(url)) {
        // Tự động chuyển các domain sangtacviet sang IP (STV_ORIGIN)
        url = url.replace(/^(https?:\/\/(?:[\w-]+\.)*(?:sangtacviet\.(?:app|com|pro|vip)|14\.225\.254\.182|103\.82\.20\.93|dns1\.stv-appdomain-\d+\.org))/i, STV_ORIGIN);

        if (/^http:\/\/(?:\d+\.\d+\.\d+\.\d+)/i.test(url) && STV_ORIGIN.indexOf("https://") === 0) {
            return url.replace(/^http:\/\//i, "https://");
        }
        return url; // giữ nguyên domain gốc từ URL được chia sẻ nếu không khớp
    }

    if (url.charAt(0) !== "/") {
        url = "/" + url;
    }

    return STV_ORIGIN + url;
}

function normalizeStvImageUrl(url) {
    url = safeStvText(url);
    if (!url) {
        return "";
    }

    if (url.indexOf("//") === 0) {
        return "https:" + url;
    }

    if (url.charAt(0) === "/") {
        return STV_ORIGIN + url;
    }

    if (url.indexOf("http://") === 0) {
        return "https://" + url.substring(7);
    }

    return url;
}

function parseStvUrl(url) {
    let normalized = normalizeStvUrl(url);
    let origin = STV_ORIGIN;
    let domainMatch = /^(https?:\/\/[^\/]+)/i.exec(normalized);
    if (domainMatch) {
        origin = domainMatch[1];
    }
    let match = STV_URL_REGEX.exec(normalized);
    if (!match) {
        return null;
    }

    return {
        host: match[1],
        bookId: match[2],
        chapterId: match[3] || "",
        origin: origin,
        url: normalized
    };
}

function buildStvBookUrl(meta) {
    return (meta.origin || STV_ORIGIN) + "/truyen/" + meta.host + "/1/" + meta.bookId + "/";
}

function normalizeStvBookLink(url) {
    let meta = parseStvUrl(url);
    return meta ? buildStvBookUrl(meta) : normalizeStvUrl(url);
}

function buildStvChapterUrl(meta, chapterId) {
    return buildStvBookUrl(meta) + chapterId + "/";
}

function buildStvTocEndpoint(meta) {
    return (meta.origin || STV_ORIGIN) + "/index.php?ngmar=chapterlist&h=" + meta.host + "&bookid=" + meta.bookId + "&sajax=getchapterlist";
}

function buildStvAjaxChapterEndpoint(meta, mode) {
    let o = meta.origin || STV_ORIGIN;
    if (mode === "ajax") {
        return o + "/index.php?ajax=readchapter&bookid=" + meta.bookId + "&h=" + meta.host + "&c=" + meta.chapterId + "&sty=1";
    }

    return o + "/index.php?bookid=" + meta.bookId + "&h=" + meta.host + "&c=" + meta.chapterId + "&ngmar=readc&sajax=readchapter&sty=1";
}

function firstStvText(doc, selectors) {
    for (let i = 0; i < selectors.length; i++) {
        let value = safeStvText(doc.select(selectors[i]).text());
        if (value) {
            return value;
        }
    }

    return "";
}

function firstStvAttr(doc, selectors, attr) {
    for (let i = 0; i < selectors.length; i++) {
        let nodes = doc.select(selectors[i]);
        if (nodes && nodes.length > 0) {
            let value = safeStvText(nodes.first().attr(attr));
            if (value) {
                return value;
            }
        }
    }

    return "";
}

function parseStvListing(doc) {
    let items = [];
    let cards = doc.select(".booksearch");

    cards.forEach(function(card) {
        let name = safeStvText(card.select(".searchbooktitle").text());
        let description = safeStvText(card.select(".searchtag").last().text()) || safeStvText(card.select(".searchtag").first().text());
        let link = safeStvText(card.attr("href"));
        if (!link) {
            let nestedLink = card.select("a");
            if (nestedLink && nestedLink.length > 0) {
                link = safeStvText(nestedLink.first().attr("href"));
            }
        }

        if (!name || !link) {
            return;
        }

        items.push({
            name: name,
            link: normalizeStvBookLink(link),
            cover: normalizeStvImageUrl(firstStvAttr(card, ["img"], "data-src") || firstStvAttr(card, ["img"], "src")),
            description: description,
            host: STV_ORIGIN
        });
    });

    return items;
}

function parseStvChapterList(data) {
    let chapters = [];
    if (!data) {
        return chapters;
    }

    let rows = String(data).split("-//-");
    for (let i = 0; i < rows.length; i++) {
        let parts = rows[i].split("-/-");
        if (parts.length < 3) {
            continue;
        }

        let chapterId = safeStvText(parts[1]);
        let rawName = safeStvText(parts.slice(2).join("-/-"));
        // Detect VIP marker trước khi xóa
        let isVip = /-\/-vip\s*$/i.test(rawName);
        let name = rawName.replace(/-\/-(?:vip|unvip)\s*$/i, "").trim();
        if (!chapterId || !name) {
            continue;
        }

        chapters.push({
            chapterId: chapterId,
            name: name,
            pay: isVip
        });
    }

    return chapters;
}

function getStvChapterNode(doc, meta) {
    let selectors = [
        "#content-container .contentbox[cid='" + meta.chapterId + "']",
        "#cld-" + meta.bookId + "-" + meta.chapterId,
        "#content-container [cid='" + meta.chapterId + "']",
        "#content-container .contentbox"
    ];

    for (let i = 0; i < selectors.length; i++) {
        let nodes = doc.select(selectors[i]);
        if (nodes && nodes.length > 0) {
            return nodes.first();
        }
    }

    return null;
}

function isStvChapterLoaded(text, options) {
    text = safeStvText(text);
    if (!text || text.length < 60) {
        return false;
    }

    if (text.length < 500 && /Đang tải nội dung chương|spinner-border|Vui lòng xác nhận|mã báo lỗi|captcha|không xác định/i.test(text)) {
        return false;
    }

    return true;
}

function extractStvChapterHtml(doc, meta, options) {
    let node = getStvChapterNode(doc, meta);
    if (!node) {
        return "";
    }

    let text = node.text() || "";
    if (!isStvChapterLoaded(text, options)) {
        return "";
    }

    return cleanStvChapterHtml(node.html());
}

function normalizeStvParagraphMarkup(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?p\b[^>]*>/gi, "\n\n");
}

function stripStvChapterTags(html) {
    return String(html || "")
        .replace(/<\/?i\b[^>]*>/gi, "")
        .replace(/<\/?font\b[^>]*>/gi, "")
        .replace(/<\/?span\b[^>]*>/gi, "")
        .replace(/<[^>]+>/g, "");
}

function normalizeStvCjkSpacing(text) {
    let value = String(text || "");
    let betweenTokens = new RegExp("([" + STV_CJK_TOKEN_CLASS + "])[ \\t]+([" + STV_CJK_TOKEN_CLASS + "])", "g");
    let previous = "";
    while (value !== previous) {
        previous = value;
        value = value.replace(betweenTokens, "$1$2");
        value = value.replace(/([（《「『【]) +/g, "$1");
        value = value.replace(/ +([）】》」』！？：；，。、])/g, "$1");
    }
    return value;
}

function stripFqCssPreamble(text) {
    // Xóa khối CSS style của Fanqie chèn trước nội dung chương.
    // Fanqie dùng 。 (dấu chấm toàn góc U+3002) thay vì . làm CSS class prefix,
    // ví dụ: 。volumePicture img { ... } 。pageBg { ... } @media { ... }
    // CSS comment (/* 不可点击 */) chứa CJK nên KHÔNG thể dùng "tìm CJK đầu tiên".
    // Dùng thuật toán theo dõi độ sâu {} để tìm vị trí kết thúc khối CSS cuối.
    if (!text) return text;
    // Chỉ xử lý khi bắt đầu bằng。ClassName / .ClassName / @rule / /* comment */
    if (!/^\s*(?:\/\*|[@.\u3002])/.test(text)) return text;
    if (text.indexOf("{") === -1 || text.indexOf("}") === -1) return text;

    let depth = 0;
    let lastClosePos = -1;
    for (let i = 0; i < text.length; i++) {
        let ch = text.charCodeAt(i);
        if (ch === 123) {        // '{'
            depth++;
        } else if (ch === 125) { // '}'
            if (depth > 0) depth--;
            if (depth === 0) lastClosePos = i;
        }
    }

    if (lastClosePos === -1) return text;

    // Bỏ qua khoảng trắng/newline sau } cuối
    let start = lastClosePos + 1;
    while (start < text.length && text.charCodeAt(start) <= 32) {
        start++;
    }

    return start < text.length ? text.substring(start) : text;
}

function cleanupStvChapterText(text) {
    let value = String(text || "");
    value = value.replace(/\r/g, "");
    value = value.replace(/[ \u00A0]+\n/g, "\n");
    value = value.replace(/\n[ \u00A0]+/g, "\n");
    value = value.replace(/\t+/g, " ");
    value = value.replace(/[ \u00A0]{2,}/g, " ");
    // Xóa CSS preamble của Fanqie trước khi convert dấu câu
    value = stripFqCssPreamble(value);
    value = value.replace(/,/g, "，");
    value = value.replace(/\./g, "。");
    value = value.replace(/\?/g, "？");
    value = value.replace(/!/g, "！");
    value = value.replace(/:/g, "：");
    value = normalizeStvCjkSpacing(value);
    value = value.replace(/^\s*第\s*[\d零一二三四五六七八九十百千万]+\s*[章回节集卷][^\n]*(?:\n+|\s*)/i, "");
    value = value.replace(/\n{3,}/g, "\n\n");
    value = value.replace(/^\n+|\n+$/g, "");
    return value.trim();
}

function finalizeStvChapterHtml(text) {
    let parts = String(text || "").split(/\n{2,}/);
    let output = [];
    for (let i = 0; i < parts.length; i++) {
        let part = parts[i].trim();
        if (!part) {
            continue;
        }
        output.push(part.replace(/\n+/g, "<br>"));
    }
    return output.join("<br><br>");
}

function cleanStvChapterHtml(html) {
    if (!html) {
        return "";
    }

    html = String(html);
    html = html.replace(/&nbsp;/g, " ");
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<span[^>]*>@Bạn đang đọc bản lưu trong hệ thống<\/span>\s*(<br\s*\/?>[\s]*)*/i, "");
    html = html.replace(/Bạn đang xem văn bản gốc chưa dịch, có thể kéo xuống cuối trang để chọn bản dịch\./gi, "");
    html = html.replace(/Vì vấn đề nội dung, nguồn này không hỗ trợ xem văn bản gốc\./gi, "");

    // Convert STV bilingual dictionary tags to Chinese raw character (the 't' attribute)
    html = html.replace(/<i[^>]*?\bt=['"]([^'"]+)['"][^>]*>[\s\S]*?<\/i>/gi, "$1");
    html = html.replace(/<div[^>]*class=['"][^'"]*text-center[^>]*>[\s\S]*?<\/div>/i, "");
    html = normalizeStvParagraphMarkup(html);
    html = stripStvChapterTags(html);

    html = html.replace(/\(\s*Tấu chương xong\s*\)/gi, "");
    html = html.replace(/Người mua:\s*[^<]+/gi, "");
    html = cleanupStvChapterText(html);
    html = finalizeStvChapterHtml(html);

    // Convert half-width punctuations to full-width for Chinese formatting
    html = html.replace(/,(?![^<]*>)/g, "，");
    html = html.replace(/\.(?![^<]*>)/g, "。");
    html = html.replace(/\?(?![^<]*>)/g, "？");
    html = html.replace(/!(?![^<]*>)/g, "！");
    html = html.replace(/:(?![^<]*>)/g, "：");

    return html;
}

function parseStvAjaxChapterPayload(json, meta) {
    if (!json || String(json.code) !== "0") {
        return "";
    }

    let payload = json.cvnguyen || json.chtxt || json.nguyen || json.data;
    if (!payload) {
        return "";
    }

    let html = payload;
    let hostKey = safeStvText(meta && meta.host).toLowerCase();
    if ((hostKey === "sangtac" || hostKey === "dich") && typeof giaiMaChuoi === "function") {
        html = giaiMaChuoi(String(html || ""));
    }

    let titleInjected = json.orichaptername || json.chaptername;

    let plainText = safeStvText(String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "));
    if (!isStvChapterLoaded(plainText)) {
        return "";
    }

    return cleanStvChapterHtml(html);
}




