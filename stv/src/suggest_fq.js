load("config.js");

function execute(input, page) {
    if (!page) page = "0";
    var url = "https://api5-normal-sinfonlinea.fqnovel.com/reading/reader/book/lastpage/recommend/v?limit=50&change_type=3&from=detailpage&book_id=" + input + "&type=0&aid=1967&version_code=62332&version_name=6.2.3.32&device_platform=android&os=android";
    var response = fetch(url);
    if (!response.ok) return null;
    var json = response.json();
    if (!json || !json.data) return null;

    var items = [];
    var filtered = json.data.filter(function(el) {
        var score = parseFloat(el.score) || 0;
        var readCount = parseInt(el.read_count) || 0;
        return score >= 8.0 || readCount >= 50000;
    });

    filtered.sort(function(a, b) {
        return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
    });

    filtered.slice(0, 20).forEach(function(el) {
        if (!el.book_id) return;
        var bookId = String(el.book_id);
        var scoreDesc = el.score ? ("⭐ " + el.score + " ") : "";
        items.push({
            name: el.book_name || bookId,
            link: STV_ORIGIN + "/truyen/fanqie/1/" + bookId + "/",
            cover: replaceFqCover((el.thumb_url || "")),
            description: scoreDesc + (el.author || ""),
            host: STV_ORIGIN
        });
    });

    return Response.success(items, "");
}

function replaceFqCover(u) {
    if (!u) return null;
    if (u.indexOf("https://") === 0) u = u.substring(8);
    else if (u.indexOf("http://") === 0) u = u.substring(7);
    else return null;
    var parts = u.split("/");
    parts[0] = "https://i0.wp.com/p6-novel.byteimg.com/origin";
    return parts.map(function(x) { return x.split("~")[0].split("?")[0]; }).filter(Boolean).join("/");
}
