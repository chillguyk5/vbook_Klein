load("config.js");

function execute(url) {
    loginIfNeeded();
    var storyId = extractStoryId(url);
    if (!storyId) return null;

    var res = apiFetch("/api/models/story/" + storyId, {
        referer: BASE_URL + "/truyen/" + storyId
    });
    if (!res || !res.ok) return null;

    var json = parseJson(res);
    var d = (json && json.data) ? json.data : json;
    if (!d || !d.id) return null;

    var name = storyTitle(d);
    var author = authorName(d);
    var cover = d.imgUrl || d.img || d.cover || "";
    var description = d.description || d.intro || "";
    var status = d.status || "";
    var ongoing = String(status).toLowerCase() !== "completed" && String(status).toLowerCase() !== "complete";

    var detailParts = [];
    detailParts.push("Tác giả: " + author);
    if (status) detailParts.push("Trạng thái: " + status);
    if (d.sourceType) detailParts.push("Nguồn: " + d.sourceType);
    if (d._count && d._count.chapters != null) detailParts.push(d._count.chapters + " chương");

    var genres = [];
    if (d.categories && d.categories.length) {
        for (var i = 0; i < d.categories.length; i++) {
            var cat = d.categories[i];
            if (!cat) continue;
            var catName = cat.nameChinese || cat.name || cat.title || "";
            var catId = cat.id || "";
            if (!catName) continue;
            genres.push({
                title: catName,
                input: BASE_URL + "/?category=" + catId,
                script: "gen.js"
            });
        }
    }

    return Response.success({
        name: name,
        cover: cover,
        author: author,
        description: description,
        detail: detailParts.join("<br>"),
        ongoing: ongoing,
        host: BASE_URL,
        genres: genres
    });
}
