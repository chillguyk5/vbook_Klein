load("config.js");

function execute(key, page) {
    page = page || "1";
    var res = apiFetch("/api/models/story?q=" + encodeURIComponent(key) +
        "&sort=updatedAt:desc&fast=1&page=" + encodeURIComponent(page) + "&pageSize=48");
    if (!res || !res.ok) return Response.error("API lỗi (" + (res ? res.status : "") + ") khi tìm kiếm");

    var json = parseJson(res);
    var list = (json && json.data) || [];
    var data = [];
    for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it) continue;
        data.push({
            name: it.titleChinese || it.nameChinese || it.title || it.name || "",
            link: BASE_URL + "/truyen/" + it.id,
            cover: it.imgUrl || it.img || it.cover || "",
            description: (it.author && it.author.name) || it.authorName || it.author || "N/A",
            host: BASE_URL
        });
    }

    var p = json && json.pagination;
    var hasMore = p ? (p.hasMore === true || (p.totalPages && parseInt(page, 10) < p.totalPages)) : (list.length >= 48);
    return Response.success(data, hasMore ? String(parseInt(page, 10) + 1) : null);
}
