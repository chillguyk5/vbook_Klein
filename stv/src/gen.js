load("config.js");

function execute(url, page) {
    let pageNumber = parseInt(String(page || "1"), 10);
    if (!pageNumber || pageNumber < 1) {
        pageNumber = 1;
    }

    let pageText = String(pageNumber);

    let targetUrl = normalizeStvUrl(url);
    let separator = targetUrl.indexOf("?") >= 0 ? "&" : "?";
    let response = fetch(targetUrl + separator + "p=" + pageText + "&page=" + pageText, {
        headers: getStvHeaders()
    });
    if (!response.ok) {
        return null;
    }

    let doc = response.html();
    let items = parseStvListing(doc);
    let next = items.length > 0 ? String(pageNumber + 1) : "";

    return Response.success(items, next);
}
