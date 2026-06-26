load("config.js");

// input: JSON string { author, bookId }
// Tìm truyện của cùng tác giả trên STV — áp dụng cho mọi host
function execute(input, page) {
    if (!page) page = "1";

    var data;
    try { data = JSON.parse(input); } catch (e) { return null; }

    var author = (data.author || "").trim();
    var currentBookId = data.bookId || "";
    if (!author) return null;

    var pageNum = parseInt(page, 10);

    // find=&findinname=AUTHOR → tìm theo tên tác giả trên STV
    var url = STV_ORIGIN + "/io/searchtp/searchBooks?find=&findinname=" + encodeURIComponent(author)
        + "&minc=0&sort=viewweek&tag=&page=" + pageNum;

    var response = fetch(url, { headers: getStvHeaders() });
    if (!response.ok) return null;

    var doc = response.html();
    var items = parseStvListing(doc);

    // Loại bỏ chính cuốn sách đang xem
    if (currentBookId) {
        items = items.filter(function (item) {
            return item.link.indexOf("/" + currentBookId + "/") === -1;
        });
    }

    var next = items.length > 0 ? String(pageNum + 1) : "";
    return Response.success(items, next);
}
