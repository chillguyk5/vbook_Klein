load("config.js");

function execute(key, page) {
    if (!page) {
        page = "1";
    }

    let response = fetch(STV_ORIGIN + "/io/searchtp/searchBooks?find=&findinname=" + encodeURIComponent(key) + "&minc=0&sort=&tag=&page=" + page, {
        headers: getStvHeaders()
    });
    if (!response.ok) {
        return null;
    }

    let doc = response.html();
    let items = parseStvListing(doc);
    let next = items.length > 0 ? String(parseInt(page, 10) + 1) : "";

    return Response.success(items, next);
}
