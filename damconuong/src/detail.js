load('config.js');

function getDetailCard(doc) {
    var card = null;

    doc.select("main div").forEach(function(node) {
        if (card) return;
        if (node.select("h1").size() === 0) return;
        if (node.select("img").size() === 0) return;
        if (node.select("a[href*='/the-loai/']").size() === 0) return;
        if (node.select("h2, h3").size() > 0) return;

        card = node;
    });

    return card;
}

function getMetaValue(card, label) {
    var value = "";
    var matchedNode = null;
    if (!card) return value;

    card.select("div").forEach(function(node) {
        var text = cleanText(node.text());
        if (!text || text.indexOf(label) !== 0) return;

        if (!matchedNode || text.length < cleanText(matchedNode.text()).length) {
            matchedNode = node;
        }
    });

    if (!matchedNode) return value;

    var text = cleanText(matchedNode.text());
    var spans = matchedNode.select("span");
    if (spans.size() > 1) {
        value = cleanText(spans.last().text());
    } else {
        value = cleanText(text.substring(label.length));
    }

    return value;
}

function getDescription(doc, card, title) {
    var description = "";

    doc.select("main div").forEach(function(node) {
        if (description) return;
        if (node.select("h1").size() > 0 || node.select("h3").size() > 0) return;
        if (node.select("h2").size() !== 1) return;
        if (cleanText(node.select("h2").first().text()) !== "Nội dung") return;

        var contentNode = node.select(".prose").first();
        if (!contentNode) return;

        var text = cleanText(contentNode.text());
        if (!text) return;

        description = text;
    });

    if (!description && card) {
        card.select("p,div").forEach(function(node) {
            if (description) return;

            var text = cleanText(node.text());
            if (!text || text === title) return;
            if (text.indexOf("Tên khác:") === 0) return;
            if (text.indexOf("Thể loại:") === 0) return;
            if (text.indexOf("Author:") === 0) return;
            if (text.indexOf("Tình trạng:") === 0) return;
            if (text.indexOf("Lần cuối:") === 0) return;
            if (text.indexOf("Lượt xem:") === 0) return;
            if (text.indexOf("Theo dõi") === 0) return;
            if (text === "Đọc từ đầu" || text === "Đọc mới nhất") return;
            if (text.length < 30) return;
            if (node.select("img").size() > 0) return;
            if (node.select("a").size() > 3) return;

            description = text;
        });
    }

    if (!description) {
        doc.select("script[type='application/ld+json']").forEach(function(node) {
            if (description) return;

            var raw = cleanText(node.html());
            if (!raw || raw.indexOf('"@type":"Article"') < 0) return;

            try {
                var data = JSON.parse(raw);
                var schemaDescription = cleanText(data.description);
                if (!schemaDescription) return;
                if (title && schemaDescription.toLowerCase().indexOf(title.toLowerCase()) < 0) return;

                description = schemaDescription;
            } catch (error) {
                var match = /"@type":"Article"[\s\S]*?"description":"([^"]+)"/.exec(raw);
                if (!match) return;

                var schemaText = cleanText(match[1].replace(/\\u([0-9a-fA-F]{4})/g, function(_, code) {
                    return String.fromCharCode(parseInt(code, 16));
                }).replace(/\\\//g, "/"));

                if (!schemaText) return;
                if (title && schemaText.toLowerCase().indexOf(title.toLowerCase()) < 0) return;

                description = schemaText;
            }
        });
    }

    if (!description) {
        var metaDescription = cleanText(doc.select("meta[property='og:description']").attr("content"));
        if (metaDescription && title && metaDescription.toLowerCase().indexOf(title.toLowerCase()) >= 0) {
            description = metaDescription;
        }
    }

    return description;
}

function getGenres(card) {
    var genres = [];
    var seen = {};

    if (!card) return genres;

    card.select("a[href*='/the-loai/']").forEach(function(node) {
        var genreTitle = cleanText(node.text());
        var genreUrl = normalizeUrl(node.attr("href"));
        if (!genreTitle || !genreUrl || seen[genreUrl]) return;

        seen[genreUrl] = true;
        genres.push({
            title: genreTitle,
            input: genreUrl,
            script: "gen.js"
        });
    });

    return genres;
}

function getSuggestSectionHtml(doc) {
    var html = "";

    doc.select("main div").forEach(function(node) {
        if (html || node.select("h3").size() === 0) return;
        if (cleanText(node.select("h3").first().text()).toLowerCase() !== "đề cử") return;

        html = node.html();
    });

    return html;
}

function getFirstText(root, selector) {
    if (!root) return "";

    var node = root.select(selector).first();
    return node ? cleanText(node.text()) : "";
}

function execute(url) {
    url = normalizeUrl(url);

    var response = fetch(url);
    if (response.ok) {
        var doc = response.html();
        var detailCard = getDetailCard(doc);
        var title = cleanText(doc.select("main h1").last().text());
        var coverNode = detailCard ? detailCard.select("img.cover").first() : doc.select("img.cover").first();
        if (!coverNode && detailCard) {
            coverNode = detailCard.select("img").first();
        }

        var cover = coverNode ? normalizeUrl(coverNode.attr("src")) : "";
        var author = getFirstText(detailCard, "a[href*='/tac-gia/']");
        var translator = getFirstText(detailCard, "a[href*='/nhom-dich/']");
        var alias = getMetaValue(detailCard, "Tên khác:");
        var status = getMetaValue(detailCard, "Tình trạng:");
        var updatedAt = getMetaValue(detailCard, "Lần cuối:");
        var views = getMetaValue(detailCard, "Lượt xem:");
        var description = getDescription(doc, detailCard, title);
        var genres = getGenres(detailCard);
        var suggestHtml = getSuggestSectionHtml(doc);

        var detail = [];
        if (alias) detail.push("Tên khác: " + alias);
        if (author) detail.push("Author: " + author);
        if (translator) detail.push("Nhóm dịch: " + translator);
        if (status) detail.push("Tình trạng: " + status);
        if (updatedAt) detail.push("Lần cuối: " + updatedAt);
        if (views) detail.push("Lượt xem: " + views);

        var result = {
            name: title,
            cover: cover,
            author: author,
            description: description,
            detail: detail.join("<br>"),
            ongoing: status.indexOf("Đang tiến hành") >= 0,
            genres: genres,
            host: BASE_URL
        };

        if (suggestHtml) {
            result.suggests = [{
                title: "Đề cử",
                input: suggestHtml,
                script: "suggest.js"
            }];
        }

        return Response.success(result);
    }

    return null;
}