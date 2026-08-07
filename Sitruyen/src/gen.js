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

function mapStory(e) {
    if (!e) return null;
    var id = e.id;
    var slug = e.slug || "";
    if (!id) return null;
    var cat = categoryText(e.categories);
    var chapters = e.total_chapters != null ? e.total_chapters : 0;
    var views = e.total_views != null ? e.total_views : 0;
    var desc = [];
    if (cat) desc.push(cat);
    desc.push(chapters + " chương");
    desc.push(views + " lượt xem");
    return {
        name: e.title || e.name || "",
        link: HOST + "/story/" + id + (slug ? "-" + slug : ""),
        cover: e.cover_image_url || "",
        description: desc.join(" | "),
        host: HOST
    };
}

function buildBody(url) {
    var body = { keyword: "" };
    if (!url) return body;

    var u = String(url);

    var cat = u.match(/\/category\/(\d+)/);
    if (cat) {
        body.category_ids = [parseInt(cat[1], 10)];
        return body;
    }

    var tag = u.match(/\/tag\/(\d+)/);
    if (tag) {
        body.tag_ids = [parseInt(tag[1], 10)];
        return body;
    }

    var type = u.match(/\/type\/([A-Za-z]+)/);
    if (type) {
        var t = type[1].toLowerCase();
        if (t === "convert") body.story_type = "Convert";
        else if (t === "dich" || t === "dichthuat") body.story_type = "Dịch";
        return body;
    }

    if (u.indexOf("completed") >= 0) {
        body.status = "Completed";
    } else if (u.indexOf("popular") >= 0) {
        body.sort_by = "Views";
    } else if (u.indexOf("updated") >= 0) {
        body.sort_by = "Updated";
    } else if (u.indexOf("recommended") >= 0) {
        body.sort_by = "Recommended";
    }

    return body;
}

function execute(url, page) {
    if (!page) page = "1";

    var body = buildBody(url);

    var res = fetch(API + "/api/stories/search?page=" + page + "&limit=24", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(body)
    });
    if (!res || !res.ok) return null;

    var json = parseJson(res);
    if (!json || !json.data || !json.data.items) {
        return Response.success([], null);
    }

    var list = json.data.items;
    var data = [];
    for (var i = 0; i < list.length; i++) {
        var item = mapStory(list[i]);
        if (item) data.push(item);
    }

    var next = null;
    var meta = json.data.metadata;
    if (meta && meta.current_page < meta.total_pages) {
        next = String(meta.current_page + 1);
    }

    return Response.success(data, next);
}
