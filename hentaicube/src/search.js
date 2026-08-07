load('config.js');

function execute(key, page) {
    // AJAX search
    try {
        var res = request(BASE_URL + "/wp-admin/admin-ajax.php", {
            method: "POST",
            headers: {
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Origin": BASE_URL, "Referer": BASE_URL + "/",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: "action=wp-manga-search-manga&title=" + encodeURIComponent(key || "")
        });
        if (res && res.ok) {
            var text = res.text();
            if (text) {
                var result = JSON.parse(text);
                if (result && result.success && result.data) {
                    var data = [], seen = {};
                    for (var i = 0; i < result.data.length; i++) {
                        var item = result.data[i];
                        var link = normalizeUrl(item.url || "");
                        if (!link || !isMangaUrl(link) || seen[link]) continue;
                        seen[link] = true;
                        data.push({
                            name: cleanText(item.title || "").replace(/\s+[|-]\s+HentaiCB.*$/i, "").replace(/\s+[|-]\s+HentaiCube.*$/i, ""),
                            link: link,
                            cover: coverField(item.thumb || item.thumbnail || item.image || ""),
                            description: cleanText(item.type || ""),
                            host: BASE_URL
                        });
                    }
                    if (data.length) return Response.success(data, "");
                }
            }
        }
    } catch(e) {}

    // fallback HTML search
    var target = BASE_URL + "/?s=" + encodeURIComponent(key || "") + "&post_type=wp-manga";
    if (page && page !== "1") target += "&paged=" + page;
    var doc = getDoc(target);
    if (!doc) return loadError();

    var data = [], seen = {};
    doc.select(".page-item-detail, .c-tabs-item__content, .popular-item-wrap").forEach(function(e) {
        var a = e.select("a[href*='/read/']").first();
        if (!a) return;
        var link = normalizeUrl(a.attr("href"));
        if (!isMangaUrl(link) || seen[link]) return;
        var name = firstText(e, [".post-title a", ".item-title a", "h3 a"]) || cleanText(a.attr("title") || a.text());
        if (!name) return;
        seen[link] = true;
        data.push({
            name: name,
            link: link,
            cover: coverField(imageFromNode(e.select("img").first())),
            description: "",
            host: BASE_URL
        });
    });
    return Response.success(data, nextPageUrl(doc, target));
}
