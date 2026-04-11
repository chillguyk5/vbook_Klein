load("config.js");

function parseGenresFromHome() {
    var response = fetch(BASE_URL);
    if (!response.ok) return [];

    var doc = response.html();
    var genres = [];
    var seen = {};

    doc.select('a[href^="/the-loai/"]').forEach(function (el) {
        var href = el.attr("href") || "";
        if (!/^\/the-loai\/[a-z0-9-]+$/i.test(href)) return;
        if (seen[href]) return;
        seen[href] = true;

        genres.push({
            title: el.text() || href.replace("/the-loai/", ""),
            input: BASE_URL + href,
            script: "list.js"
        });
    });

    return genres;
}

function execute() {
    var response = fetch(API_BASE + "/genres");
    if (!response.ok) {
        var fallback = parseGenresFromHome();
        return fallback.length ? Response.success(fallback) : null;
    }

    var json = response.json();
    var genres = [];
    var data = (json && json.data) ? json.data : [];

    data.forEach(function (item) {
        if (!item || !item.slug) return;
        genres.push({
            title: item.name || item.slug,
            input: BASE_URL + "/the-loai/" + item.slug,
            script: "list.js"
        });
    });

    if (!genres.length) genres = parseGenresFromHome();

    return Response.success(genres);
}