load("config.js");

function mapStories(items) {
    var out = [];
    if (!items) return out;
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it || it.id == null) continue;
        var desc = it.authorName || (it.author && it.author.name) || it.author || "";
        if (it.categoryNames) {
            var c = Array.isArray(it.categoryNames) ? it.categoryNames.join(", ") : String(it.categoryNames);
            if (c) desc = desc && desc !== "N/A" ? (desc + " · " + c) : c;
        }
        out.push({
            name: it.titleChinese || it.nameChinese || it.title || it.name || "",
            link: BASE_URL + "/truyen/" + it.id,
            cover: it.imgUrl || it.img || it.cover || "",
            description: desc || "N/A",
            host: BASE_URL
        });
    }
    return out;
}

function execute(url, page) {
    page = page || "1";
    var s = String(url || "");

    // 1. Ranking bootstrap
    if (s.indexOf("rank:") === 0 || s.indexOf("xep-hang") >= 0) {
        var sec = s.indexOf("rank:") === 0 ? (s.split(":")[1] || "monthly") : "monthly";
        var rRes = apiFetch("/api/ranking/bootstrap", { referer: BASE_URL + "/xep-hang" });
        if (rRes && rRes.ok) {
            var rJson = parseJson(rRes);
            var root = (rJson && rJson.data) ? rJson.data : rJson;
            if (root && root.rankings) {
                var arr = root.rankings[sec] || root.rankings.monthly || [];
                return Response.success(mapStories(arr), null);
            }
        }
        s = "story:likes";
    }

    // 2. Story API lists
    var qs = "page=" + encodeURIComponent(page) + "&pageSize=48";
    if (s === "story:createdAt" || s.indexOf("sort=createdAt") >= 0) qs += "&sort=createdAt:desc";
    else if (s === "story:views" || s.indexOf("sort=views") >= 0) qs += "&sort=views:desc";
    else if (s === "story:likes" || s.indexOf("sort=likes") >= 0) qs += "&sort=likes:desc";
    else if (s === "home:completed" || s.indexOf("status=completed") >= 0) qs += "&sort=updatedAt:desc&status=completed";
    else qs += "&sort=updatedAt:desc";

    if (s.indexOf("category=") >= 0) {
        var catM = s.match(/category=([^&]+)/);
        if (catM) qs += "&categories=" + encodeURIComponent(catM[1]);
    }

    var res = apiFetch("/api/models/story?" + qs);
    if (!res || !res.ok) return Response.error("API lỗi (" + (res ? res.status : "") + ") khi tải truyện");

    var json = parseJson(res);
    var list = (json && json.data) || [];
    var p = json && json.pagination;
    var hasMore = p ? (p.hasMore === true || (p.totalPages && parseInt(page, 10) < p.totalPages)) : (list.length >= 48);

    return Response.success(mapStories(list), hasMore ? String(parseInt(page, 10) + 1) : null);
}
