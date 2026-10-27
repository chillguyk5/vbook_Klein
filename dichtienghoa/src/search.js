load("config.js");

function mapStory(item) {
    return {
        name: storyTitle(item),
        link: BASE_URL + "/truyen/" + item.id,
        cover: item.imgUrl || item.img || item.cover || "",
        description: authorName(item),
        host: BASE_URL
    };
}

function execute(key, page) {
    if (!page) page = "1";

    var qs = "q=" + encodeURIComponent(key) +
        "&sort=updatedAt:desc&fast=1&page=" + encodeURIComponent(page) +
        "&pageSize=48";

    var res = apiFetch("/api/models/story?" + qs);
    if (!res) return null;
    if (!res.ok) return Response.error("API lỗi (" + res.status + ") khi tìm kiếm");

    var json = parseJson(res);
    if (!json || !json.data || !json.data.length) return Response.success([], null);

    var data = [];
    for (var i = 0; i < json.data.length; i++) {
        data.push(mapStory(json.data[i]));
    }

    var hasMore = false;
    if (json.pagination) {
        hasMore = json.pagination.hasMore === true ||
            (json.pagination.totalPages != null && parseInt(page) < json.pagination.totalPages);
    } else {
        hasMore = json.data.length >= 48;
    }

    return Response.success(data, hasMore ? String(parseInt(page) + 1) : null);
}
