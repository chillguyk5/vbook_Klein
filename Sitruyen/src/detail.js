var API = "https://api.sitruyencv.com";
var HOST = "https://sitruyencv.com";

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

function categoryText(cats) {
    if (!cats || !cats.length) return "";
    var parts = [];
    for (var i = 0; i < cats.length; i++) {
        if (cats[i] && cats[i].name) parts.push(cats[i].name);
    }
    return parts.join(", ");
}

function execute(url) {
    var id = extractStoryId(url);
    if (!id) return null;

    var res = fetch(API + "/api/stories/" + id, { headers: apiHeaders() });
    if (!res || !res.ok) return null;

    var json = parseJson(res);
    if (!json || !json.data) return null;

    var e = json.data;
    var author = "";
    if (e.author && e.author.name) author = e.author.name;

    var cat = categoryText(e.categories);
    var chapters = e.total_chapters != null ? e.total_chapters : 0;
    var views = e.total_views != null ? e.total_views : 0;
    var status = (e.status || "").toLowerCase();
    var ongoing = status !== "completed" && status !== "complete";

    var detailParts = [];
    if (cat) detailParts.push(cat);
    detailParts.push(chapters + " chương");
    detailParts.push(views + " lượt xem");
    if (e.status) detailParts.push(e.status);

    return Response.success({
        name: e.title || "",
        cover: e.cover_image_url || "",
        author: author,
        description: e.description || "",
        detail: detailParts.join("<br>"),
        ongoing: ongoing,
        host: HOST
    });
}
