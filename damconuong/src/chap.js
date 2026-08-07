load('config.js');

function execute(url) {
    url = normalizeUrl(url);

    var response = fetch(url);
    if (response.ok) {
        var doc = response.html();
        var data = [];
        doc.select("img.chapter-img").forEach(function(e) {
            var img = normalizeUrl(e.attr("data-src"));
            if (!img) {
                img = normalizeUrl(e.attr("src"));
            }
            if (img) {
                data.push({
                    link: img
                });
            }
        });
        return Response.success(data);
    }

    return null;
}