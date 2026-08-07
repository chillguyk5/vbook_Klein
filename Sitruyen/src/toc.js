var API = "https://api.sitruyencv.com";
var HOST = "https://sitruyencv.com";
var CHAP_LIMIT = 100;

function apiHeaders() {
    return {
        "accept": "application/json, text/plain, */*",
        "origin": HOST,
        "referer": HOST + "/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
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

function extractStoryId(url) {
    if (!url) return null;
    var m = String(url).match(/story\/(\d+)/);
    return m ? m[1] : null;
}

function execute(url) {
    var storyId = extractStoryId(url);
    if (!storyId) return null;

    var vRes = fetch(API + "/api/stories/" + storyId + "/translate-versions", {
        headers: apiHeaders()
    });
    if (!vRes || !vRes.ok) return null;

    var vJson = parseJson(vRes);
    if (!vJson || !vJson.data || !vJson.data.length) {
        return Response.success([]);
    }

    var versionId = parseInt(vJson.data[0].id, 10);
    if (!versionId) return Response.success([]);

    var chapters = [];
    var page = 1;
    var totalPages = 1;

    while (page <= totalPages && page <= 500) {
        var api = API + "/api/chapters/" + versionId
            + "?page=" + page
            + "&limit=" + CHAP_LIMIT
            + "&story_id=" + storyId
            + "&sort_order=asc";

        var res = fetch(api, { headers: apiHeaders() });
        if (!res || !res.ok) break;

        var json = parseJson(res);
        if (!json || !json.data || !json.data.items) break;

        var list = json.data.items;
        if (!list.length) break;

        if (json.data.metadata && json.data.metadata.total_pages) {
            totalPages = json.data.metadata.total_pages;
        }

        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (!c) continue;

            var num = c.chapter_number != null ? c.chapter_number : (chapters.length + 1);
            var rawTitle = c.title ? String(c.title) : "";
            var title = rawTitle;
            if (!title) {
                title = "Chương " + num;
            } else if (title.toLowerCase().indexOf("chương") < 0 && title.toLowerCase().indexOf("chuong") < 0) {
                title = "Chương " + num + ": " + title;
            }

            chapters.push({
                name: title,
                url: HOST + "/read/" + storyId + "/" + num + "?v=" + versionId,
                host: HOST,
                pay: c.is_paid === true ? true : undefined
            });
        }

        if (list.length < CHAP_LIMIT) break;
        page++;
    }

    return Response.success(chapters);
}
