load('config.js');

function execute(key, page) {
    if (!page) page = "1";

    var requestUrl = BASE_URL + "/tim-kiem?keyword=" + encodeURIComponent(key) + "&page=" + page;
    var response = fetch(requestUrl);
    if (response.ok) {
        var doc = response.html();
        var data = parseMangaCards(doc);
        var next = getNextPage(doc, page);
        return Response.success(data, next);
    }

    return null;
}