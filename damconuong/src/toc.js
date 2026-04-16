load('config.js');

function execute(url) {
    url = normalizeUrl(url);

    var matched = /\/truyen\/([^/?#]+)/i.exec(url);
    if (!matched) return null;

    var storySlug = matched[1];
    var response = fetch(url);
    if (response.ok) {
        var doc = response.html();
        var seen = {};
        var data = [];
        doc.select("a[href*='/truyen/" + storySlug + "/']").forEach(function(e) {
            var href = normalizeUrl(e.attr("href"));
            var name = cleanText(e.select("div").first().text());
            if (!name) {
                name = cleanText(e.text()).replace(/\s+\d[\d,]*\s+.*$/, "");
            }
            if (!href || !name) return;
            if (name.indexOf("Đọc từ đầu") === 0 || name.indexOf("Đọc mới nhất") === 0) return;
            if (name === "Home" || name === "Chương trước" || name === "Chương sau" || name === "List") return;
            if (seen[href]) return;
            seen[href] = true;
            data.push({
                name: name,
                url: href,
                host: BASE_URL
            });
        });

        data.reverse();
        return Response.success(data);
    }

    return null;
}