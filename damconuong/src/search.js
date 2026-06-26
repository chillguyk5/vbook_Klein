load('config.js');

function execute(key, page) {
    if (!page) page = "1";

    if (page !== "1") return Response.success([]);

    var requestUrl = BASE_URL + "/live-search?q=" + encodeURIComponent(key);
    var response = fetch(requestUrl);
    if (response.ok) {
        var res = response.json();
        var data = [];
        res.forEach(function(item) {
            data.push({
                name: cleanText(item.name),
                link: BASE_URL + "/truyen/" + item.slug,
                cover: item.cover_full_url || "",
                description: item.latest_chapter ? cleanText(item.latest_chapter.name) : "",
                host: BASE_URL
            });
        });
        return Response.success(data, "");
    }

    return null;
}