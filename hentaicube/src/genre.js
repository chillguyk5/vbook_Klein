load('config.js');

function fallbackGenres() {
    return [
        {title: "Truyện màu", input: normalizeUrl("/theloai/full-color/"), script: "gen.js"},
        {title: "Không che", input: normalizeUrl("/theloai/khong-che/"), script: "gen.js"},
        {title: "Webtoon", input: normalizeUrl("/theloai/webtoon/"), script: "gen.js"},
        {title: "Manhwa", input: normalizeUrl("/theloai/manhwa/"), script: "gen.js"}
    ];
}

function execute() {
    var doc = getDoc(BASE_URL + "/the-loai-genres/");
    if (!doc) return Response.success(fallbackGenres());

    var data = [];
    var seen = {};
    doc.select("a[href*='/theloai/']").forEach(function(a) {
        var title = cleanText(a.text());
        var href = normalizeUrl(a.attr("href"));
        if (!title || !href || seen[href]) return;
        seen[href] = true;
        data.push({title: title, input: href, script: "gen.js"});
    });

    return Response.success(data.length > 0 ? data : fallbackGenres());
}
