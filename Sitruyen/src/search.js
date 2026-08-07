var API = "https://api.sitruyencv.com";
var HOST = "https://sitruyencv.com";

function apiHeaders() {
    return {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
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

function categoryText(cats) {
    if (!cats || !cats.length) return "";
    var parts = [];
    for (var i = 0; i < cats.length; i++) {
        if (cats[i] && cats[i].name) parts.push(cats[i].name);
    }
    return parts.join(", ");
}

function execute(key, page) {
    if (!page) page = "1";

    var res = fetch(API + "/api/stories/search?page=" + page + "&limit=24", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ keyword: key || "" })
    });
    if (!res || !res.ok) return null;

    var json = parseJson(res);
    if (!json || !json.data) return Response.success([], null);

    var list = [];
    if (json.data.items) list = json.data.items;
    else if (Array.isArray(json.data)) list = json.data;

    var data = [];
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || !e.id) continue;

        var slug = e.slug || "";
        var cat = categoryText(e.categories);
        var chapters = e.total_chapters != null ? e.total_chapters : 0;
        var views = e.total_views != null ? e.total_views : 0;
        var desc = [];
        if (cat) desc.push(cat);
        desc.push(chapters + " chương");
        desc.push(views + " lượt xem");

        var status = (e.status || "").toLowerCase();
        var ongoing = status !== "completed" && status !== "complete";

        data.push({
            name: e.title || e.name || "",
            link: HOST + "/story/" + e.id + (slug ? "-" + slug : ""),
            cover: e.cover_image_url || "",
            description: desc.join(" | "),
            ongoing: ongoing,
            host: HOST
        });
    }

    var next = null;
    var meta = json.data.metadata;
    if (meta && meta.current_page < meta.total_pages) {
        next = String(meta.current_page + 1);
    } else if (list.length >= 24) {
        next = String(parseInt(page, 10) + 1);
    }

    return Response.success(data, next);
}
