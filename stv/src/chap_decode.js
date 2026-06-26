function stvGetGlobalObject() {
    if (typeof globalThis !== "undefined") return globalThis;
    try {
        return Function("return this")();
    } catch (_) {
        return {};
    }
}

function stvAtobFallback(input) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var str = stvTrim(String(input)).replace(/[^A-Za-z0-9\+\/\=]/g, "");
    var output = "";
    var i = 0;

    while (i < str.length) {
        var e1 = chars.indexOf(str.charAt(i++));
        var e2 = chars.indexOf(str.charAt(i++));
        var e3 = chars.indexOf(str.charAt(i++));
        var e4 = chars.indexOf(str.charAt(i++));

        if (e1 < 0 || e2 < 0) continue;

        var c1 = (e1 << 2) | (e2 >> 4);
        var c2 = ((e2 & 15) << 4) | (e3 >> 2);
        var c3 = ((e3 & 3) << 6) | e4;

        output += String.fromCharCode(c1);
        if (e3 !== 64 && e3 >= 0) output += String.fromCharCode(c2);
        if (e4 !== 64 && e4 >= 0) output += String.fromCharCode(c3);
    }

    return output;
}

function stvDecodeBase64Utf8(base64Text) {
    var input = stvTrim(base64Text).replace(/\s+/g, "");
    if (!input) return "";

    var binary = "";
    var g = stvGetGlobalObject();

    try {
        binary = (g && typeof g.atob === "function") ? g.atob(input) : stvAtobFallback(input);
    } catch (_) {
        return "";
    }

    try {
        return decodeURIComponent(escape(binary));
    } catch (_) {
        return binary;
    }
}

function stvDecodeGrantHtml(htmlText) {
    var text = stvTrim(htmlText);
    if (!text) return "";

    text = text.replace(/^\s*<html[^>]*>\s*<head[^>]*>[\s\S]*?<\/head>\s*<body[^>]*>/i, "");
    text = text.replace(/<\/body>\s*<\/html>\s*$/i, "");

    text = text
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

    return text;
}

function stvLooksLikeGrantScript(text) {
    var sample = stvTrim(text);
    if (!sample) return false;
    if (sample.indexOf("(()=>") === 0 || sample.indexOf("(() =>") === 0) return true;
    if (sample.indexOf("app.reader") >= 0) return true;
    if (sample.indexOf("chapterkey") >= 0) return true;
    return false;
}

function stvFetchGrantText(url, options) {
    try {
        var response = fetch(url, options || {});
        var text = "";

        if (response && typeof response.html === "function") {
            try {
                var fromHtml = stvDecodeGrantHtml(response.html());
                if (stvLooksLikeGrantScript(fromHtml)) {
                    text = fromHtml;
                }
            } catch (_) {
                text = "";
            }
        }

        if (!text && response && typeof response.base64 === "function") {
            try {
                var fromBase64 = stvDecodeBase64Utf8(response.base64());
                if (stvLooksLikeGrantScript(fromBase64)) {
                    text = fromBase64;
                }
            } catch (_) {
                text = "";
            }
        }

        if (!text && response && typeof response.text === "function") {
            text = response.text();
        }

        return {
            ok: !!(response && response.ok),
            status: response ? response.status : 0,
            text: text,
            headers: response ? response.headers : null
        };
    } catch (e) {
        return {
            ok: false,
            status: 0,
            text: "",
            headers: null,
            error: e
        };
    }
}

function stvSortQuery(params) {
    var keys = [];
    for (var k in params) {
        if (params.hasOwnProperty(k)) keys.push(k);
    }

    keys.sort();

    var out = "";
    for (var i = 0; i < keys.length; i++) {
        out += keys[i] + "=" + params[keys[i]] + "&";
    }

    return out;
}

function stvEscapeHtml(text) {
    var value = text === null || typeof text === "undefined" ? "" : String(text);
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Decode STV webfont obfuscated glyphs in chapter content.
function giaiMaChuoi(input) {
    var text = input === null || typeof input === "undefined" ? "" : String(input);
    if (!text) return "";

    var mapping_list = [
        [0xE01B, "A"], [0xE01E, "y"], [0xE05F, "3"], [0xE063, "z"],
        [0xE06B, "K"], [0xE06C, "t"], [0xE089, "l"], [0xE0D5, "S"],
        [0xE0D6, "T"], [0xE100, "o"], [0xE101, "P"], [0xE116, "4"],
        [0xE122, "W"], [0xE124, "Z"], [0xE14B, "J"], [0xE160, "e"],
        [0xE184, "O"], [0xE186, "D"], [0xE1A4, "f"], [0xE1AD, "e"],
        [0xE1B4, "k"], [0xE1B8, "f"], [0xE1BF, "n"], [0xE1C0, "Y"],
        [0xE1C1, "1"], [0xE1D8, "K"], [0xE1E4, "M"], [0xE1EA, "Y"],
        [0xE215, "C"], [0xE218, "A"], [0xE22B, "h"], [0xE240, "x"],
        [0xE248, "v"], [0xE257, "G"], [0xE27E, "b"], [0xE2A9, "B"],
        [0xE2C5, "s"], [0xE2C7, "t"], [0xE2CA, "G"], [0xE2E3, "k"],
        [0xE2F8, "q"], [0xE30F, "F"], [0xE311, "u"], [0xE32F, "E"],
        [0xE334, "2"], [0xE34A, "I"], [0xE37C, "R"], [0xE38F, "v"],
        [0xE39B, "X"], [0xE3B0, "l"], [0xE3B7, "7"], [0xE3F1, "l"],
        [0xE41B, "o"], [0xE41C, "H"], [0xE426, "S"], [0xE427, "J"],
        [0xE43E, "6"], [0xE44E, "X"], [0xE46A, "b"], [0xE477, "y"],
        [0xE49A, "c"], [0xE4A3, "8"], [0xE4AE, "2"], [0xE4CC, "s"],
        [0xE4D3, "5"], [0xE4DB, "L"], [0xE4DF, "N"], [0xE4EC, "5"],
        [0xE4F3, "r"], [0xE519, "0"], [0xE51F, "g"], [0xE550, "E"],
        [0xE557, "h"], [0xE566, "N"], [0xE571, "F"], [0xE57B, "O"],
        [0xE5BD, "C"], [0xE5C1, "d"], [0xE5C9, "8"], [0xE5D1, "x"],
        [0xE5DC, "m"], [0xE5E1, "9"], [0xE5F0, "u"], [0xE5FA, "m"],
        [0xE5FF, "a"], [0xE603, "U"], [0xE62A, "w"], [0xE636, "P"],
        [0xE63E, "D"], [0xE648, "6"], [0xE65B, "H"], [0xE65D, "z"],
        [0xE660, "9"], [0xE68D, "1"], [0xE691, "M"], [0xE6A4, "q"],
        [0xE6A5, "c"], [0xE6D7, "W"], [0xE6E0, "R"], [0xE6F1, "T"],
        [0xE6F3, "a"], [0xE6F5, "g"], [0xE705, "w"], [0xE71A, "3"],
        [0xE735, "Z"], [0xE74F, "Q"], [0xE762, "r"], [0xE765, "n"],
        [0xE775, "V"], [0xE77A, "d"], [0xE77D, "L"], [0xE77E, "4"],
        [0xE7C7, "U"], [0xE7E5, "0"], [0xE7F6, "7"], [0xE902, "A"],
        [0xE915, "O"], [0xE91F, "e"], [0xE946, "a"], [0xE95D, "2"],
        [0xE97B, "f"], [0xE9A8, "y"], [0xE9CC, "P"], [0xE9D5, "o"],
        [0xE9D7, "r"], [0xE9F8, "O"], [0xE9F9, "K"], [0xEA15, "e"],
        [0xEA20, "Y"], [0xEA24, "N"], [0xEA2D, "v"], [0xEA2E, "R"],
        [0xEA2F, "C"], [0xEA43, "4"], [0xEA47, "l"], [0xEA65, "S"],
        [0xEA75, "M"], [0xEA76, "H"], [0xEA77, "u"], [0xEA82, "o"],
        [0xEAA1, "k"], [0xEAA4, "a"], [0xEAA5, "x"], [0xEAA6, "z"],
        [0xEAB2, "6"], [0xEAB4, "t"], [0xEABB, "y"], [0xEAC5, "w"],
        [0xEACF, "b"], [0xEAD5, "L"], [0xEAE3, "A"], [0xEAED, "F"],
        [0xEB02, "s"], [0xEB06, "s"], [0xEB0E, "C"], [0xEB0F, "R"],
        [0xEB18, "w"], [0xEB27, "D"], [0xEB62, "l"], [0xEB63, "9"],
        [0xEB75, "h"], [0xEB85, "X"], [0xEBEC, "k"], [0xEBF6, "N"],
        [0xEC0F, "q"], [0xEC19, "J"], [0xEC50, "7"], [0xEC6D, "g"],
        [0xEC75, "d"], [0xEC85, "n"], [0xECAD, "V"], [0xECB4, "S"],
        [0xECD4, "L"], [0xECDB, "Z"], [0xECE6, "E"], [0xECF8, "U"],
        [0xED07, "V"], [0xED2C, "Q"], [0xED35, "l"], [0xED37, "J"],
        [0xED48, "W"], [0xED64, "5"], [0xED71, "2"], [0xED72, "v"],
        [0xED8C, "E"], [0xEDEB, "Y"], [0xEDEC, "5"], [0xEDED, "m"],
        [0xEE01, "c"], [0xEE09, "Q"], [0xEE0C, "n"], [0xEE0F, "u"],
        [0xEE47, "W"], [0xEE5C, "P"], [0xEE69, "b"], [0xEE8D, "0"],
        [0xEEA1, "X"], [0xEEBB, "F"], [0xEEC1, "I"], [0xEECC, "B"],
        [0xEECF, "c"], [0xEEDA, "1"], [0xEEDB, "D"], [0xEEE3, "G"],
        [0xEF1F, "8"], [0xEF26, "K"], [0xEF35, "x"], [0xEF37, "6"],
        [0xEF3A, "d"], [0xEF57, "H"], [0xEF5A, "U"], [0xEF61, "G"],
        [0xEF91, "8"], [0xEF94, "T"], [0xEFC8, "m"], [0xEFD4, "1"],
        [0xEFD7, "Z"], [0xEFDA, "h"], [0xEFEE, "3"], [0xEFEF, "4"],
        [0xEFF6, "3"], [0xF00A, "q"], [0xF019, "T"], [0xF050, "B"],
        [0xF065, "0"], [0xF073, "7"], [0xF096, "z"], [0xF0A6, "t"],
        [0xF0BA, "r"], [0xF0BD, "M"], [0xF0C0, "g"], [0xF7A0, "0"],
        [0xF7A1, "1"], [0xF7A2, "2"], [0xF7A3, "3"], [0xF7A4, "4"],
        [0xF7A5, "5"], [0xF7A6, "6"], [0xF7A7, "7"], [0xF7A8, "8"],
        [0xF7A9, "9"], [0xF8FF, "*"]
    ];

    var mapping_dict = {};
    for (var i = 0; i < mapping_list.length; i++) {
        var code = String.fromCharCode(mapping_list[i][0]);
        mapping_dict[code] = mapping_list[i][1];
    }

    var output = "";
    for (var j = 0; j < text.length; j++) {
        var ch = text.charAt(j);
        output += mapping_dict.hasOwnProperty(ch) ? mapping_dict[ch] : ch;
    }
    return output;
}

var STV_CJK_CHAR_CLASS = "\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF";
var STV_CJK_PUNCT_CLASS = "\\u3000-\\u303F\\uFF00-\\uFFEF";
var STV_CJK_TOKEN_CLASS = STV_CJK_CHAR_CLASS + STV_CJK_PUNCT_CLASS;

function stvDecodeHtmlEntities(text) {
    return String(text || "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&");
}

function stvStripStvChapterNotices(text) {
    var value = String(text || "");
    value = value.replace(/<span[^>]*>@Bạn đang đọc bản lưu trong hệ thống<\/span>\s*(<br\s*\/?>\s*)*/gi, "");
    value = value.replace(/@Bạn đang đọc bản lưu trong hệ thống(?:\s*<br\s*\/?>|\s*\n)*/gi, "");
    value = value.replace(/Bạn đang xem văn bản gốc chưa dịch, có thể kéo xuống cuối trang để chọn bản dịch\./gi, "");
    value = value.replace(/Vì vấn đề nội dung, nguồn này không hỗ trợ xem văn bản gốc\./gi, "");
    value = value.replace(/\(\s*Tấu chương xong\s*\)/gi, "");
    value = value.replace(/Người mua:\s*[^\n<]+/gi, "");
    return value;
}

function stvNormalizeParagraphMarkup(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/br\s*>/gi, "\n")
        .replace(/<\/?p\b[^>]*>/gi, "\n\n");
}

function stvStripChapterTags(html) {
    return String(html || "")
        .replace(/<\/?i\b[^>]*>/gi, "")
        .replace(/<\/?font\b[^>]*>/gi, "")
        .replace(/<\/?span\b[^>]*>/gi, "")
        .replace(/<[^>]+>/g, "");
}

function stvNormalizeCjkSpacing(text) {
    var value = String(text || "");
    var betweenTokens = new RegExp("([" + STV_CJK_TOKEN_CLASS + "])[ \\t]+([" + STV_CJK_TOKEN_CLASS + "])", "g");
    var previous = "";

    while (value !== previous) {
        previous = value;
        value = value.replace(betweenTokens, "$1$2");
        value = value.replace(/([（《「『【]) +/g, "$1");
        value = value.replace(/ +([）】》」』！？：；，。、])/g, "$1");
    }

    return value;
}

function stvStripFqCssPreamble(text) {
    var value = String(text || "");
    if (!value) return value;
    if (!/^\s*(?:\/\*|[@.\u3002])/.test(value)) return value;
    if (value.indexOf("{") === -1 || value.indexOf("}") === -1) return value;

    var depth = 0;
    var lastClosePos = -1;

    for (var i = 0; i < value.length; i++) {
        var ch = value.charCodeAt(i);
        if (ch === 123) {
            depth++;
        } else if (ch === 125) {
            if (depth > 0) depth--;
            if (depth === 0) lastClosePos = i;
        }
    }

    if (lastClosePos === -1) return value;

    var start = lastClosePos + 1;
    while (start < value.length && value.charCodeAt(start) <= 32) {
        start++;
    }

    return start < value.length ? value.substring(start) : value;
}

function stvCleanupChapterText(text) {
    var value = String(text || "");
    value = value.replace(/\r/g, "");
    value = value.replace(/[ \u00A0]+\n/g, "\n");
    value = value.replace(/\n[ \u00A0]+/g, "\n");
    value = value.replace(/\t+/g, " ");
    value = value.replace(/[ \u00A0]{2,}/g, " ");
    value = stvStripFqCssPreamble(value);
    value = value.replace(/,/g, "，");
    value = value.replace(/\./g, "。");
    value = value.replace(/\?/g, "？");
    value = value.replace(/!/g, "！");
    value = value.replace(/:/g, "：");
    value = stvNormalizeCjkSpacing(value);
    value = value.replace(/^\s*第\s*[\d零一二三四五六七八九十百千万]+\s*[章回节集卷][^\n]*(?:\n+|\s*)/i, "");
    value = value.replace(/\n{3,}/g, "\n\n");
    value = value.replace(/^\n+|\n+$/g, "");
    return stvTrim(value);
}

function stvFinalizeChapterHtml(text) {
    var parts = String(text || "").split(/\n{2,}/);
    var output = [];

    for (var i = 0; i < parts.length; i++) {
        var part = stvTrim(parts[i]);
        if (!part) continue;
        output.push(part.replace(/\n+/g, "<br>"));
    }

    return output.join("<br><br>");
}

function stvHasStvChapterNotice(text) {
    return /@Bạn đang đọc bản lưu trong hệ thống|Bạn đang xem văn bản gốc chưa dịch|Vì vấn đề nội dung, nguồn này không hỗ trợ xem văn bản gốc/i.test(String(text || ""));
}

function stvLooksLikeSimpleChapterHtml(text) {
    var value = String(text || "");
    if (!/<\w+[^>]*>/.test(value)) return false;
    if (/<(?:img|svg|video|audio|iframe|table)\b/i.test(value)) return false;
    return /<(?:br|p|div|span|font|i|article|section|blockquote)\b/i.test(value);
}

function stvNormalizePlainChapterText(rawText) {
    var text = stvStripStvChapterNotices(rawText);
    text = stvDecodeHtmlEntities(text);
    text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/br\s*>/gi, "\n");
    text = text.replace(/<[^>]+>/g, "");
    text = stvCleanupChapterText(text);
    if (!text) return "";
    return stvEscapeHtml(text).replace(/\n/g, "<br>");
}

function stvLooksLikeInterlinearHtml(text) {
    var sample = stvTrim(text);
    if (!sample) return false;
    return /<i\b[^>]*\b(?:t|v|p)\s*=\s*['"][^'"]*['"][^>]*>/i.test(sample);
}

function stvNormalizeInterlinearChapter(rawText) {
    var text = rawText === null || typeof rawText === "undefined" ? "" : String(rawText);
    if (!text) return "";

    var marker = "__STV_I_GAP__";

    text = stvStripStvChapterNotices(text);
    text = text.replace(/\(\s*\)/g, "");
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<div[^>]*class=['"][^'"]*text-center[^>]*>[\s\S]*?<\/div>/i, "");
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    text = stvNormalizeParagraphMarkup(text);

    // Remove visual line breaks right before punctuation after an <i> block.
    text = text.replace(/<\/i>\s*\n+\s*(?=[,.;:!?%\)\]\}\u3002\uff0c\u3001\uff01\uff1f\uff1b\uff1a\u201d\u2019\u300d\u300f\u3011\u300b])/gi, "</i>");

    // Consecutive <i> blocks should have one space between them.
    text = text.replace(/<\/i>\s*<i\b/gi, "</i>" + marker + "<i");

    text = text.replace(/<i\b([^>]*)>([\s\S]*?)<\/i>/gi, function (_, attrs, inner) {
        var attrText = attrs === null || typeof attrs === "undefined" ? "" : String(attrs);
        var match = attrText.match(/\bt\s*=\s*(["'])([\s\S]*?)\1/i);
        return match && match[2] ? match[2] : inner;
    });

    // Preserve coarse block boundaries before stripping the rest of HTML.
    text = text.replace(/<\/?(p|div|article|section|li|tr|h[1-6]|blockquote|ul|ol)[^>]*>/gi, "\n");
    text = stvStripChapterTags(text);
    text = text.replace(/[<>]/g, "");
    text = stvDecodeHtmlEntities(text);

    text = text.replace(new RegExp(marker, "g"), " ");
    text = stvCleanupChapterText(text);
    if (!text) return "";

    return stvFinalizeChapterHtml(text);
}

function stvNormalizeChapterHtml(host, base, rawContent) {
    var hostKey = stvTrim(host).toLowerCase();
    var text = rawContent === null || typeof rawContent === "undefined" ? "" : String(rawContent);
    if (!text) return "";

    text = stvStripStvChapterNotices(text);

    if (hostKey === "fanqie") {
        text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
        text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
        text = text.replace(/<\/?article>/gi, "");
        text = text.replace(/\sidx=\"\d+\"/g, "");
        if (stvLooksLikeInterlinearHtml(text) || stvLooksLikeSimpleChapterHtml(text)) {
            return stvNormalizeInterlinearChapter(text);
        }
        return text;
    }

    if (hostKey === "sangtac" || hostKey === "dich") {
        text = giaiMaChuoi(text);
        if (stvLooksLikeInterlinearHtml(text) || stvLooksLikeSimpleChapterHtml(text)) {
            return stvNormalizeInterlinearChapter(text);
        }
        var isHtml = /<\w+[^>]*>/.test(text);
        if (!isHtml) {
            text = stvNormalizePlainChapterText(text);
        }
        return text;
    }

    if (!/<\w+[^>]*>/.test(text)) {
        return stvNormalizePlainChapterText(text);
    }

    if (stvLooksLikeInterlinearHtml(text) || stvHasStvChapterNotice(text) || stvLooksLikeSimpleChapterHtml(text)) {
        return stvNormalizeInterlinearChapter(text);
    }

    return text;
}

function stvExtractChapterKeyByBrowser(base, grantBody) {
    var code = stvTrim(grantBody);
    if (!code) {
        return {
            chapterkey: "",
            error: ""
        };
    }

    if (typeof Engine === "undefined" || !Engine || typeof Engine.newBrowser !== "function") {
        return {
            chapterkey: "",
            error: "Engine.newBrowser không khả dụng"
        };
    }

    var browser = null;

    try {
        browser = Engine.newBrowser();
        if (!browser || typeof browser.loadHtml !== "function" || typeof browser.callJs !== "function") {
            return {
                chapterkey: "",
                error: "Browser API không khả dụng"
            };
        }

        if (typeof browser.setUserAgent === "function") {
            browser.setUserAgent(STV_CONFIG.USER_AGENT);
        }

        var shell = "<html><head><meta charset='utf-8'></head><body><pre id='stv_chapterkey_out'></pre></body></html>";
        browser.loadHtml(base, shell);

        var runScript = "window.Capacitor=window.Capacitor||{};"
            + "window.UWNgB=true;"
            + "window.document=window.document||{}; window.document.hidden=false;"
            + "window.navigator=window.navigator||{};"
            + "window.app=window.app||{}; window.app.tcYCI=true; window.app.reader=window.app.reader||{};"
            + "var __err='';"
            + "try{eval(" + JSON.stringify(code) + ");}"
            + "catch(e){__err=String(e&&e.message?e.message:e);};"
            + "var __k='';"
            + "try{__k=String((window.app&&window.app.reader&&window.app.reader.chapterkey)||'');}"
            + "catch(e2){__err=__err+'|read:'+String(e2&&e2.message?e2.message:e2);}"
            + "document.getElementById('stv_chapterkey_out').innerText=(__k?('__KEY__:'+__k):('__ERR__:'+__err));";

        var doc = browser.callJs(runScript, 6000);
        var output = "";

        try {
            var outNode = doc ? doc.select("#stv_chapterkey_out").first() : null;
            output = outNode ? stvTrim(outNode.text()) : "";
        } catch (_) {
            output = "";
        }

        if (output.indexOf("__KEY__:") === 0) {
            return {
                chapterkey: stvTrim(output.substring(8)),
                error: ""
            };
        }

        if (output.indexOf("__ERR__:") === 0) {
            return {
                chapterkey: "",
                error: stvTrim(output.substring(8))
            };
        }

        return {
            chapterkey: "",
            error: stvTrim(output)
        };
    } catch (e) {
        return {
            chapterkey: "",
            error: stvTrim(e && e.message ? e.message : e)
        };
    } finally {
        try {
            if (browser && typeof browser.close === "function") browser.close();
        } catch (_) {
            // Ignore browser close errors.
        }
    }
}

function stvGrantContext(base, host, bookid) {
    var path = "/io/grantcontext/context?hostid=" + stvEncode(host) + "&bookid=" + stvEncode(bookid);
    var url = stvBuildUrl(base, path);
    var referer = stvBuildBookUrl(base, host, bookid, 1);
    function requestGrant() {
        var cookie = stvBuildCookie("mac_tt=true", base);
        var requestHeaders = {
            "Referer": referer
        };
        if (cookie) requestHeaders["Cookie"] = cookie;

        return stvFetchGrantText(url, {
            method: "GET",
            headers: stvHeaders(requestHeaders)
        });
    }

    var result = requestGrant();
    if (stvIsCloudflareBlockedResponse(result)) {
        var synced = stvSyncCloudflareCookie(base, referer);
        if (synced) {
            result = requestGrant();
        }
    }

    if (!result.ok || !result.text) {
        var blocked = stvIsCloudflareBlockedResponse(result);
        return {
            chapterkey: "",
            readcontextid: "",
            grantErr: blocked
                ? "Bị Cloudflare chặn khi xin quyền đọc chương. Đã thử tự đồng bộ cookie nhưng chưa thành công."
                : "Không tải được grantcontext."
        };
    }

    var browserResult = stvExtractChapterKeyByBrowser(base, result.text);
    var setCookie = stvExtractSetCookie(result.headers);
    var readcontextid = stvFindReadContextId(setCookie);

    return {
        chapterkey: stvTrim(browserResult.chapterkey),
        readcontextid: readcontextid,
        grantErr: stvTrim(browserResult.error)
    };
}

function execute(input) {
    if (typeof Response !== "undefined" && Response && typeof Response.success === "function") {
        return Response.success("");
    }
    return "";
}
