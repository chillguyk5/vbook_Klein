load("config.js");

// Chapter list API returns titleChinese for every chapter (verified 2026-09-03,
// 17/17 stories all sources) - no per-chapter scraping needed.
function execute(url) {
    if (!url) return Response.success([]);

    var storyId = extractStoryId(url);
    if (!storyId) return Response.success([]);

    var data = [];
    var page = 1;
    var total = null;
    var safety = 0;

    while (safety < 100) {
        safety++;
        var res = apiFetch("/api/models/chapter?storyId=" + encodeURIComponent(storyId) + "&page=" + page, {
            referer: BASE_URL + "/truyen/" + storyId
        });
        if (!res || !res.ok) break;

        var json = parseJson(res);
        if (!json || !json.chapters || !json.chapters.length) break;
        if (total == null && json.total != null) total = json.total;

        for (var i = 0; i < json.chapters.length; i++) {
            var c = json.chapters[i];
            if (!c || !c.id) continue;
            var cn = c.titleChinese ? String(c.titleChinese).trim() : "";
            var title = cn || (c.title ? String(c.title).trim() : ("Chương " + (c.number || "")));
            var price = Number(c.vipPrice);
            if (!isFinite(price) || price < 0) price = 0;
            var isVip = c.free === false || price > 0;
            // vBook renders a pay/lock icon in the chapter list from `pay: true`
            // (confirmed on device 2026-09-04) - name stays clean, no text tag.
            // ?su lets chap.js fetch via the light crawl endpoint (~6KB) instead of
            // /api/models/chapter/{id} (~120KB, 96KB of it unused translatedContent).
            var chUrl = BASE_URL + "/truyen/" + storyId + "/" + c.id;
            var src = c.sourceUrl || "";
            if (src && getSourceName(src)) chUrl += "?su=" + encodeURIComponent(src);
            data.push({
                name: title,
                url: chUrl,
                host: BASE_URL,
                pay: isVip ? true : undefined
            });
        }

        var limit = json.limit || json.chapters.length || 300;
        if (total != null && data.length >= total) break;
        if (json.chapters.length < limit) break;
        page++;
    }

    return Response.success(data);
}
