load("config.js");

// input: plain bookId (string) hoặc JSON {bookId, sort}
// sort: "new" (mới nhất, mặc định) | "smart_hot" (nóng nhất)
function execute(input, page) {
    if (!page) page = "0";
    // Comments are paged 10 items at a time.
    var offset = parseInt(page, 10) * 10;

    var bookId = input;
    var sort = "time";  // mặc định: comment mới nhất (sort=time)
    if (input && input.charAt(0) === "{") {
        try {
            var d = JSON.parse(input);
            bookId = d.bookId || input;
            sort = d.sort || "new";
        } catch (e) {}
    }

    var url = "https://api5-normal-sinfonlinec.fqnovel.com/reading/ugc/novel_comment/book/v/?book_id=" + bookId + "&aid=1967&offset=" + offset + "&count=10&sort=" + sort;

    var response = fetch(url);
    if (!response.ok) return null;
    var json = response.json();
    if (!json || !json.data || !json.data.comment) return null;

    var comments = [];
    json.data.comment.forEach(function(cmt) {
        // Convert score to a 5-star display for the UI.
        var scoreCount = Math.round((cmt.score || 0) / 2);
        var stars = "";
        for (var i = 0; i < 5; i++) stars += (i < scoreCount ? "⭐" : "☆");
        var cmtContent = stars + "<br>❤️ " + cmt.digg_count + "  🗨️ " + cmt.reply_count + "<br>" + (cmt.text || "").replace(/\n/g, "<br>");
        
        var replies = cmt.reply_list || [];
        if (replies.length > 0) {
            cmtContent += "<br><br>— Phản hồi —";
            replies.forEach(function(r) {
                var rName = (r.user_info && r.user_info.user_name) ? r.user_info.user_name : "Ẩn danh";
                var rContent = (r.text || "").replace(/\n/g, "<br>");
                cmtContent += "<br>↳ [" + rName + "] " + rContent;
            });
        }

        comments.push({
            name: cmt.user_info.user_name,
            content: cmtContent,
            description: fmtDate(cmt.create_timestamp)
        });
    });

    var next = String(parseInt(page, 10) + 1);
    return Response.success(comments, next);
}

function fmtDate(ts) {
    var d = new Date(ts * 1000);
    var p = function(n) { return n < 10 ? "0" + n : n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}
