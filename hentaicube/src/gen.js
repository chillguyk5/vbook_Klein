load('config.js');

function storyLink(e) {
    var links = e.select("a[href]");
    for (var i = 0; i < links.size(); i++) {
        var a = links.get(i);
        if (isMangaUrl(a.attr("href"))) return a;
    }
    return null;
}

function itemDesc(e) {
    var parts = [];
    e.select(".list-chapter a, .chapter a, .chapter-item a, a[href*='/chap-']").forEach(function(a) {
        var h = a.attr("href"), t = cleanText(a.text());
        if (t && isChapterUrl(h) && parts.length < 3) parts.push(t);
    });
    return parts.join(" - ");
}

function comicItem(e) {
    var a = storyLink(e);
    if (!a) return null;
    var link = normalizeUrl(a.attr("href"));
    var name = firstText(e, [".post-title a", ".manga-title a", ".item-title a", "h3 a", "h4 a"]) || cleanText(a.attr("title") || a.text());
    if (!name || !link) return null;
    return {
        name: name,
        link: link,
        cover: coverField(imageFromNode(e.select("img").first())),
        description: itemDesc(e),
        host: BASE_URL
    };
}

function collectAll(doc) {
    var data = [], seen = {};
    doc.select(".page-item-detail, .c-tabs-item__content, .popular-item-wrap, .manga-item").forEach(function(e) {
        var item = comicItem(e);
        if (!item || !item.name || !item.link || seen[item.link]) return;
        seen[item.link] = true;
        data.push(item);
    });
    if (!data.length) {
        doc.select("a[href*='/read/']").forEach(function(a) {
            var h = a.attr("href");
            if (!isMangaUrl(h)) return;
            var link = normalizeUrl(h);
            if (seen[link]) return;
            var name = cleanText(a.attr("title") || a.text());
            if (!name) return;
            seen[link] = true;
            data.push({name: name, link: link, cover: "", description: "", host: BASE_URL});
        });
    }
    return data;
}

function pageUrl(url, page) {
    if (!page || page === "1") return normalizeUrl(url);
    var u = normalizeUrl(url);
    var qi = u.indexOf("?");
    var base = qi >= 0 ? u.substring(0, qi) : u;
    var qs = qi >= 0 ? u.substring(qi) : "";
    base = base.replace(/\/page\/\d+\/?$/i, "").replace(/\/+$/, "");
    return base + "/page/" + page + "/" + qs;
}

function hasNextPage(doc) {
    var selectors = [
        "a.nextpostslink[href]", ".wp-pagenavi a.nextpostslink[href]",
        ".nav-links a.next[href]", ".pagination a.next[href]",
        "a.page-numbers.next[href]", "a[rel=next][href]"
    ];
    for (var i = 0; i < selectors.length; i++) {
        if (doc.select(selectors[i]).size() > 0) return true;
    }
    return false;
}

function execute(url, page) {
    if (!page) page = "1";
    var p = parseInt(page, 10) || 1;
    var target = pageUrl(url, p);

    var doc = getDoc(target);
    if (!doc) return loadError();

    var data = collectAll(doc);
    if (!data.length) return loadError();

    var next = null;
    if (hasNextPage(doc) || data.length >= 12) {
        next = String(p + 1);
    }
    return Response.success(data, next);
}
