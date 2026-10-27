load('config.js');

// Layout mới (2026-10, damconuong.win): h1.md-title, p.md-alt, .md-badges
// (tình trạng), .md-stats (views/follows), .md-synopsis (mô tả), info dạng
// <dl><dt>Tác giả</dt><dd><a class="md-chip">…</a></dd></dl>. Ảnh bìa không
// còn img.cover — dùng og:image. Giữ toàn bộ nhánh layout cũ làm fallback.

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

// Layout mới: giá trị info nằm trong <div><dt>label</dt><dd>…</dd></div>.
// Quét div chứa dt đúng nhãn rồi lấy nội dung dd (div trong cùng cùng khớp,
// nhưng dd.first() vẫn là dd của dt đó nên kết quả như nhau).
function getDlValue(doc, label) {
    var found = "";

    doc.select("div").forEach(function(node) {
        if (found) return;
        var dt = node.select("dt").first();
        if (!dt || cleanText(dt.text()) !== label) return;
        var dd = node.select("dd").first();
        if (!dd) return;

        var link = dd.select("a").first();
        found = cleanText(link ? link.text() : dd.text());
    });

    return found;
}

// Thể loại: dd của dt "Thể loại" chứa nhiều a.md-chip → /the-loai/…
function getDlGenres(doc, label) {
    var genres = [];
    var seen = {};

    doc.select("div").forEach(function(node) {
        if (genres.length) return;
        var dt = node.select("dt").first();
        if (!dt || cleanText(dt.text()) !== label) return;

        node.select("dd a[href*='/the-loai/']").forEach(function(a) {
            var genreTitle = cleanText(a.text());
            var genreUrl = normalizeUrl(a.attr("href"));
            if (!genreTitle || !genreUrl || seen[genreUrl]) return;
            seen[genreUrl] = true;
            genres.push({
                title: genreTitle,
                input: genreUrl,
                script: "gen.js"
            });
        });
    });

    return genres;
}

// .md-stats: <li><strong>2.8K</strong><span>lượt xem</span></li>
function getStatValue(doc, keyword) {
    var value = "";

    doc.select(".md-stats li").forEach(function(li) {
        if (value) return;
        var text = cleanText(li.text());
        if (text.indexOf(keyword) < 0) return;
        var strong = li.select("strong").first();
        value = strong ? cleanText(strong.text()) : "";
    });

    return value;
}

function getDescription(doc, card, title) {
    var description = "";

    doc.select("main div").forEach(function(node) {
        if (description) return;
        if (node.select("h1").size() > 0 || node.select("h3").size() > 0) return;
        if (node.select("h2").size() !== 1) return;
        var h2Node = node.select("h2").first();
        if (!h2Node || cleanText(h2Node.text()) !== "Nội dung") return;

        var contentNode = node.select(".prose").first();
        if (!contentNode) return;

        var text = cleanText(contentNode.text());
        if (!text) return;

        description = text;
    });

    if (!description) {
        var synopsis = doc.select(".md-synopsis").first();
        if (synopsis) {
            var p = synopsis.select("p").first();
            description = cleanText(p ? p.text() : synopsis.text());
        }
    }

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

// Ảnh bìa: og:image luôn có trên trang mới; fallback meta thumbnail /
// img có alt trùng tên truyện / img.cover kiểu cũ.
function getCover(doc, card, title) {
    var ogImage = cleanText(doc.select("meta[property='og:image']").attr("content"));
    if (ogImage) return normalizeUrl(ogImage);

    var thumb = cleanText(doc.select("meta[name='thumbnail']").attr("content"));
    if (thumb) return normalizeUrl(thumb);

    if (title) {
        var byAlt = null;
        doc.select("img[alt]").forEach(function(img) {
            if (byAlt || !cleanText(img.attr("alt"))) return;
            if (cleanText(img.attr("alt")) === title) byAlt = img;
        });
        if (byAlt) return normalizeUrl(byAlt.attr("src"));
    }

    var coverNode = card ? card.select("img.cover").first() : doc.select("img.cover").first();
    if (!coverNode && card) {
        coverNode = card.select("img").first();
    }
    return coverNode ? normalizeUrl(coverNode.attr("src")) : "";
}

function getGenres(doc, card) {
    var genres = getDlGenres(doc, "Thể loại");
    if (genres.length) return genres;

    var seen = {};
    var pool = card || doc;

    pool.select("a[href*='/the-loai/']").forEach(function(node) {
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
        var h3Node = node.select("h3").first();
        if (!h3Node || cleanText(h3Node.text()).toLowerCase() !== "đề cử") return;

        html = node.html();
    });

    return html;
}

function getFirstText(root, selector) {
    if (!root) return "";

    var node = root.select(selector).first();
    return node ? cleanText(node.text()) : "";
}

// Lần cuối cập nhật: ld+json "@type":"Book" -> dateModified (layout mới).
function getLastUpdated(doc) {
    var out = "";

    doc.select("script[type='application/ld+json']").forEach(function(node) {
        if (out) return;
        var raw = cleanText(node.html());
        if (!raw || raw.indexOf('"@type":"Book"') < 0) return;

        var m = /"dateModified":"([^"]+)"/.exec(raw);
        if (m) out = cleanText(m[1]).replace("T", " ").slice(0, 16);
    });

    return out;
}

function execute(url) {
    url = normalizeUrl(url);

    var response = dcnFetch(url);
    if (response.ok) {
        var doc = response.html();
        var detailCard = getDetailCard(doc);
        var title = cleanText(doc.select("main h1").last().text());

        var author = getDlValue(doc, "Tác giả") ||
            getFirstText(detailCard, "a[href*='/tac-gia/']") ||
            getFirstText(doc, "a[href*='/tac-gia/']");
        var translator = getDlValue(doc, "Nhóm dịch") ||
            getFirstText(detailCard, "a[href*='/nhom-dich/']") ||
            getFirstText(doc, "a[href*='/nhom-dich/']");
        var altNode = doc.select("p.md-alt").first();
        var alias = (altNode ? cleanText(altNode.text()) : "") || getMetaValue(detailCard, "Tên khác:");
        var status = getFirstText(doc, ".md-badges .md-badge") || getMetaValue(detailCard, "Tình trạng:");
        var updatedAt = getLastUpdated(doc) || getMetaValue(detailCard, "Lần cuối:");
        var views = getStatValue(doc, "lượt xem") || getMetaValue(detailCard, "Lượt xem:");
        var description = getDescription(doc, detailCard, title);
        var genres = getGenres(doc, detailCard);
        var suggestHtml = getSuggestSectionHtml(doc);

        var detail = [];
        if (alias) detail.push("Tên khác: " + alias);
        if (author) detail.push("Author: " + author);
        if (translator) detail.push("Nhóm dịch: " + translator);
        if (status) detail.push("Tình trạng: " + status);
        if (updatedAt) detail.push("Lần cuối: " + updatedAt);
        if (views) detail.push("Lượt xem: " + views);

        var ongoing;
        if (status) {
            ongoing = status.toLowerCase().indexOf("hoàn thành") < 0;
        } else {
            // layout mới không có badge → coi như đang ra; layout cũ không
            // đọc được status thì giữ hành vi cũ (false khi có detail card)
            ongoing = !detailCard;
        }

        var result = {
            name: title,
            cover: getCover(doc, detailCard, title),
            author: author,
            description: description,
            detail: detail.join("<br>"),
            ongoing: ongoing,
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
