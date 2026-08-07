load('config.js');

function isStoryUrl(url) {
    return /\/truyen\/[^\/?#]+\/?$/i.test(url || "");
}

function isChapterUrl(url) {
    return /\/truyen\/[^\/?#]+\/[^\/?#]+\/?$/i.test(url || "");
}

function execute(input) {
    var doc = Html.parse(input);
    var books = [];
    var seen = {};

    doc.select("div.group").forEach(function(card) {
        var link = "";
        var name = "";
        var chapterText = "";
        var views = "";
        var coverNode = card.select("img").first();

        card.select("a[href*='/truyen/']").forEach(function(node) {
            var href = normalizeUrl(node.attr("href"));
            if (!link && isStoryUrl(href)) {
                link = href;
                name = cleanText(node.text()) || (coverNode ? cleanText(coverNode.attr("alt")) : "");
                return;
            }

            if (!chapterText && isChapterUrl(href)) {
                chapterText = cleanText(node.text());
            }
        });

        card.select("span").forEach(function(node) {
            var text = cleanText(node.text());
            if (text && /^\d[\d.,]*$/.test(text)) {
                views = text;
            }
        });

        if (!link || seen[link]) return;

        seen[link] = true;
        books.push({
            name: name,
            link: link,
            cover: coverNode ? normalizeUrl(coverNode.attr("src")) : "",
            description: chapterText ? (views ? chapterText + " - " + views : chapterText) : views,
            host: BASE_URL
        });
    });

    return Response.success(books);
}