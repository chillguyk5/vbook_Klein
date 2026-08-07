load('config.js');

function execute(url) {
    var target = storyUrlFromAny(url);

    // 1) home cache nhanh
    var idx = loadHomeIndex(false);
    var hit = findInIndex(idx, target);
    if (hit) {
        return Response.success({
            name: hit.name,
            cover: hit.cover,
            author: "",
            description: hit.description || "",
            detail: hit.description ? "Chap: " + hit.description : "",
            ongoing: true,
            genres: [],
            host: BASE_URL
        });
    }

    // 2) getDoc từ detail page (fetch → browser fallback)
    var doc = getDoc(target);
    if (!doc) return loadError();

    var name = firstText(doc, [".post-title h1", "h1"]);
    if (!name) name = metaContent(doc, "meta[property=og:title]").replace(/\s+[|-]\s+HentaiCB/i, "").replace(/\s+[|-]\s+HentaiCube/i, "");
    if (!name) return Response.error("Không tìm thấy thông tin truyện.");

    var cover = metaContent(doc, "meta[property=og:image]");
    if (!cover) cover = imageFromNode(doc.select(".summary_image img, .profile-manga img").first());
    cover = coverField(cover);

    var author = cleanText(doc.select(".author-content a, .artist-content a").text());
    var status = "";
    doc.select(".post-content_item").forEach(function(row) {
        var lbl = cleanText(row.select("h5, .summary-heading").text());
        if (lbl.indexOf("Tình trạng") >= 0 || lbl.toLowerCase().indexOf("status") >= 0) {
            status = cleanText(row.select(".summary-content").text());
        }
    });
    var statusFold = foldText(status);
    var description = firstHtml(doc, [".description-summary .summary__content", ".description-summary", ".summary__content"]);
    if (!description) description = metaContent(doc, "meta[name=description]");

    var genres = [], seen = {};
    doc.select(".genres-content a[href*='/theloai/']").forEach(function(a) {
        var t = cleanText(a.text()), h = normalizeUrl(a.attr("href"));
        if (!t || !h || seen[h]) return;
        seen[h] = true;
        genres.push({title: t, input: h, script: "gen.js"});
    });

    var detail = [];
    if (author) detail.push("Tác giả: " + author);
    if (status) detail.push("Tình trạng: " + status);

    return Response.success({
        name: name,
        cover: cover,
        author: author,
        description: description,
        detail: detail.join("<br>"),
        ongoing: statusFold.indexOf("hoan thanh") < 0 && statusFold.indexOf("complete") < 0,
        genres: genres,
        host: BASE_URL
    });
}
