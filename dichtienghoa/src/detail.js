load("config.js");

function execute(url) {
    var idM = url ? url.match(/truyen\/(\d+)/) : null;
    if (!idM) return null;
    var storyId = idM[1];

    var res = apiFetch("/api/models/story/" + storyId, { referer: BASE_URL + "/truyen/" + storyId });
    if (!res) return null;
    if (!res.ok) return Response.error("API lỗi (" + res.status + ") khi tải thông tin truyện");

    var json = parseJson(res);
    var d = (json && json.data) ? json.data : json;
    if (!d || !d.id) return null;

    var detailParts = [
        "Tác giả: " + ((d.author && d.author.name) || d.authorName || d.author || "N/A")
    ];
    if (d.status) detailParts.push("Trạng thái: " + d.status);
    if (d.sourceType) detailParts.push("Nguồn: " + d.sourceType);
    if (d._count && d._count.chapters != null) detailParts.push(d._count.chapters + " chương");

    var cached = getCachedUser();
    if (!cached || !cached.username) cached = syncAuthFromCookie();
    if (cached && cached.username) {
        var wallet = getUserWallet();
        var balText = (wallet && wallet.balance !== undefined) ? (wallet.balance + " coin") : "đã kết nối";
        detailParts.push("Tài khoản: " + cached.username + " (" + balText + ")");
    } else if (hasCredentials()) {
        detailParts.push("Tài khoản: " + configText("username"));
    }

    var genres = [];
    if (d.categories) {
        for (var i = 0; i < d.categories.length; i++) {
            var cat = d.categories[i];
            if (cat && cat.id) {
                var catName = cat.nameChinese || cat.name || cat.title || "";
                if (catName) {
                    genres.push({ title: catName, input: BASE_URL + "/?category=" + cat.id, script: "gen.js" });
                }
            }
        }
    }

    return Response.success({
        name: d.titleChinese || d.nameChinese || d.title || d.name || "",
        cover: d.imgUrl || d.img || d.cover || "",
        author: (d.author && d.author.name) || d.authorName || d.author || "N/A",
        description: d.description || d.intro || "",
        detail: detailParts.join("<br>"),
        ongoing: d.status ? (d.status.toLowerCase() !== "completed" && d.status.toLowerCase() !== "complete") : true,
        host: BASE_URL,
        genres: genres
    });
}
