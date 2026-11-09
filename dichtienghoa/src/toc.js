load("config.js");

function execute(url) {
    if (!url) return Response.success([]);
    var idM = url.match(/truyen\/(\d+)/);
    if (!idM) return Response.success([]);
    var storyId = idM[1];

    var purchasedMap = {};
    if (isUserAuthenticated()) {
        var purchRes = apiFetch("/api/models/user/chapter-purchases?storyId=" + encodeURIComponent(storyId), {
            referer: BASE_URL + "/truyen/" + storyId
        });
        if (purchRes && purchRes.ok) {
            var pJson = parseJson(purchRes);
            var pList = (pJson && pJson.data) ? pJson.data : (Array.isArray(pJson) ? pJson : []);
            for (var p = 0; p < pList.length; p++) {
                var item = pList[p];
                if (item) {
                    var chId = item.chapterId || item.id;
                    if (chId != null) purchasedMap[chId] = true;
                }
            }
        }
    }

    var data = [];
    var page = 1;
    var total = null;

    for (var safety = 0; safety < 100; safety++) {
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
            var isVip = (c.free === false || Number(c.vipPrice) > 0);
            if (isVip && purchasedMap[c.id]) isVip = false;

            var chUrl = BASE_URL + "/truyen/" + storyId + "/" + c.id;
            var src = c.sourceUrl;
            if (!isVip && src && getSourceName(src)) chUrl += "?su=" + encodeURIComponent(src);

            data.push({
                name: c.titleChinese ? c.titleChinese.trim() : (c.title ? c.title.trim() : ("Chương " + (c.number || ""))),
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
