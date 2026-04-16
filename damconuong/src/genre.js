load('config.js');

function execute() {
    var response = fetch(BASE_URL + "/tim-kiem");
    if (response.ok) {
        var doc = response.html();
        var seen = {};
        var genres = [];
        doc.select("a[href*='/the-loai/']").forEach(function(e) {
            var title = cleanText(e.text());
            var input = normalizeUrl(e.attr("href"));
            if (!title || !input || seen[input]) return;
            seen[input] = true;
            genres.push({
                title: title,
                input: input,
                script: "gen.js"
            });
        });
        return Response.success(genres);
    }
    return null;
}