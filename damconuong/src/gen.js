load('config.js');

function execute(url, page) {
    if (!page) page = "1";

    var requestUrl = buildPagedUrl(url, page);
    var response = fetch(requestUrl);
    if (response.ok) {
        var doc = response.html();
        var data = parseMangaCards(doc);
        var next = getNextPage(doc, page);
        return Response.success(data, next);
    }

    return null;
}