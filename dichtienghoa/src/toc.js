load("config.js");

function extractQqBid(sourceUrl) {
    if (!sourceUrl) return null;
    var m = String(sourceUrl).match(/(?:book\.qq\.com|m\.novel\.qq\.com)\/book-(?:read|detail|chapter)\/(\d+)/i);
    if (m) return m[1];
    m = String(sourceUrl).match(/book-read\/(\d+)/i);
    return m ? m[1] : null;
}

function extractSourceIndex(sourceUrl) {
    if (!sourceUrl) return null;
    var m = String(sourceUrl).match(/book-read\/\d+\/(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
}

function isQqSource(sourceUrl) {
    if (!sourceUrl) return false;
    var u = String(sourceUrl).toLowerCase();
    return u.indexOf("book.qq.com") >= 0 || u.indexOf("m.novel.qq.com") >= 0;
}

function fetchQqTitleMapByUrlIndex(bid) {
    var map = {};
    if (!bid) return map;
    var urls = [
        "https://book.qq.com/book-chapter/" + bid,
        "https://book.qq.com/book-detail/" + bid
    ];
    var headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://book.qq.com/"
    };
    for (var u = 0; u < urls.length; u++) {
        var res = fetch(urls[u], { headers: headers });
        if (!res || !res.ok) continue;
        var html = "";
        try { html = res.text() || ""; } catch (e) { continue; }
        if (!html) continue;

        var reTitleHref = new RegExp(
            "title=\"[^\"]*?(第\\s*\\d+\\s*章[^\"']{0,80})\"[^>]*href=\"[^\"]*book-read\\/" + bid + "\\/(\\d+)",
            "g"
        );
        var m;
        var found = 0;
        while ((m = reTitleHref.exec(html)) !== null) {
            var idx = parseInt(m[2], 10);
            var title = cleanCnTitleText(m[1]);
            if (idx && title) {
                map[idx] = title;
                found++;
            }
        }
        if (found < 10) {
            var reHrefName = new RegExp(
                "book-read\\/" + bid + "\\/(\\d+)[\\s\\S]{0,300}?第\\s*(\\d+)\\s*章\\s*([^<\"']{0,80})",
                "g"
            );
            while ((m = reHrefName.exec(html)) !== null) {
                var idx2 = parseInt(m[1], 10);
                var title2 = cleanCnTitleText("第" + m[2] + "章 " + m[3]);
                if (idx2 && title2 && !map[idx2]) {
                    map[idx2] = title2;
                    found++;
                }
            }
        }
        var count = 0;
        for (var k in map) if (map.hasOwnProperty(k)) count++;
        if (count > 5) break;
    }
    return map;
}

function resolveSourceName(sourceUrl) {
    var name = getSourceName(sourceUrl);
    if (name) return name;
    if (!sourceUrl) return "";
    var res = apiFetch("/api/models/source?pageSize=100");
    var json = parseJson(res);
    var list = (json && json.data) ? json.data : [];
    for (var i = 0; i < list.length; i++) {
        var src = list[i];
        if (src && src.baseUrl && sourceUrl.indexOf(src.baseUrl) === 0) return src.name || "";
    }
    return "";
}

function getChapterContent(chapterId, storyId) {
    var res = apiFetch("/api/models/chapter/" + chapterId, {
        referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId
    });
    if (!res || !res.ok) return "";
    var json = parseJson(res);
    if (!json) return "";
    if (json.data && json.data.content) return json.data.content;
    return json.content || "";
}

function crawlContent(sourceUrl, sourceName, storyId, chapterId) {
    if (!sourceUrl || !sourceName) return "";
    var res = apiFetch(
        "/api/models/crawl/" + encodeURIComponent(sourceName) + "/content?url=" + encodeURIComponent(sourceUrl),
        { referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId }
    );
    if (!res || !res.ok) return "";
    var json = parseJson(res);
    if (!json) return "";
    return json.chapterConent || json.chapterContent || json.content ||
        (json.data && (json.data.chapterConent || json.data.chapterContent || json.data.content)) || "";
}

function applyQqMap(data, sampleSource) {
    var bid = extractQqBid(sampleSource);
    if (!bid) return 0;
    var cnMap = fetchQqTitleMapByUrlIndex(bid);
    var mapped = 0;
    for (var j = 0; j < data.length; j++) {
        var item = data[j];
        var idx = item._srcIdx;
        var cn = null;
        if (idx != null) cn = cnMap[idx] || cnMap[String(idx)] || null;
        if (cn) {
            item.name = cn;
            item._cnDone = true;
            mapped++;
        }
    }
    return mapped;
}

/**
 * Non-QQ sources: title often first line of CN body.
 * - 69shuba / uukanshu / trxs / 82zg: 第N章 ...
 * - piaotia: 第一章 ...
 * - fanqienovel / bookqq content: often NO title line → keep VI
 */
function applyContentTitles(data, storyId, sampleSource) {
    var sourceName = resolveSourceName(sampleSource);
    var mapped = 0;

    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (item._cnDone) {
            mapped++;
            continue;
        }
        var cn = extractTitleFromContent(getChapterContent(item._chapterId, storyId));
        if (!cn && item._sourceUrl) {
            if (!sourceName) sourceName = resolveSourceName(item._sourceUrl);
            // skip crawl for sources known to lack title line if we already know
            // still try once — fanqie/bookqq return empty title, harmless
            cn = extractTitleFromContent(crawlContent(item._sourceUrl, sourceName, storyId, item._chapterId));
        }
        if (cn) {
            item.name = cn;
            item._cnDone = true;
            mapped++;
        }
    }
    return mapped;
}

function execute(url) {
    if (!url) return Response.success([]);
    loginIfNeeded();

    var storyId = extractStoryId(url);
    if (!storyId) return Response.success([]);

    var data = [];
    var page = 1;
    var total = null;
    var safety = 0;
    var sampleSource = "";

    while (safety < 100) {
        safety++;
        var res = apiFetch(
            "/api/models/chapter?storyId=" + encodeURIComponent(storyId) + "&page=" + page,
            { referer: BASE_URL + "/truyen/" + storyId }
        );
        if (!res || !res.ok) break;

        var json = parseJson(res);
        if (!json || !json.chapters || !json.chapters.length) break;
        if (total == null && json.total != null) total = json.total;

        for (var i = 0; i < json.chapters.length; i++) {
            var c = json.chapters[i];
            if (!c || !c.id) continue;
            if (!sampleSource && c.sourceUrl) sampleSource = c.sourceUrl;
            var title = c.title ? String(c.title).trim() : ("Chương " + (c.number || ""));
            var isVip = c.free === false || (c.vipPrice != null && c.vipPrice > 0);
            data.push({
                name: title,
                url: BASE_URL + "/truyen/" + storyId + "/" + c.id,
                host: BASE_URL,
                pay: isVip ? true : undefined,
                _chapterId: String(c.id),
                _sourceUrl: c.sourceUrl || "",
                _srcIdx: extractSourceIndex(c.sourceUrl),
                _cnDone: false
            });
        }

        var limit = json.limit || json.chapters.length || 300;
        if (total != null && data.length >= total) break;
        if (json.chapters.length < limit) break;
        if (json.numberTo != null && total != null && json.numberTo >= total) break;
        page++;
    }

    // Strategy by source:
    // book.qq.com → catalog map by URL index (1 request)
    // 69shuba/uukanshu/piaotia/trxs/82zg → first line of content/crawl
    // fanqienovel → no CN title in content → keep Vietnamese
    if (isQqSource(sampleSource)) {
        applyQqMap(data, sampleSource);
        // fill gaps only for unmapped rows
        var needFill = false;
        for (var x = 0; x < data.length; x++) {
            if (!data[x]._cnDone) { needFill = true; break; }
        }
        if (needFill) applyContentTitles(data, storyId, sampleSource);
    } else {
        applyContentTitles(data, storyId, sampleSource);
    }

    for (var j = 0; j < data.length; j++) {
        delete data[j]._chapterId;
        delete data[j]._sourceUrl;
        delete data[j]._srcIdx;
        delete data[j]._cnDone;
    }

    return Response.success(data);
}
