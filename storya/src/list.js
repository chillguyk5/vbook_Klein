load("config.js");

function withPage(url, page) {
    if (!page || String(page) === "1") return url;
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + encodeURIComponent(page);
}

function firstText(root, selector) {
    var el = root.select(selector).first();
    return el ? el.text() : "";
}

function firstAttr(root, selector, attr) {
    var el = root.select(selector).first();
    return el ? (el.attr(attr) || "") : "";
}

function titleFromSlug(href) {
    var slug = String(href || "").replace(/^\/truyen\//, "");
    return slug.replace(/-/g, " ");
}

function execute(url, page) {
    var targetUrl = toAbsoluteUrl(url);
    targetUrl = withPage(targetUrl, page);

    var response = fetch(targetUrl);
    if (!response.ok) return null;

    var doc = response.html();
    var novelMap = {};

    // Parse by story links directly so layout/class changes do not break list results.
    doc.select('a[href^="/truyen/"]').forEach(function (linkEl) {
        var href = linkEl.attr("href") || "";
        if (!/^\/truyen\/[^/?#]+$/.test(href)) return;

        if (!novelMap[href]) {
            novelMap[href] = {
                name: "",
                link: href,
                description: "",
                cover: "",
                host: BASE_URL
            };
        }

        var item = novelMap[href];
        var text = (linkEl.text() || "").trim();
        if (text && text.length > item.name.length) item.name = text;

        var cover = firstAttr(linkEl, "img", "src");
        if (cover && !item.cover) item.cover = toAbsoluteUrl(cover);
    });

    var novelList = [];
    Object.keys(novelMap).forEach(function (href) {
        var item = novelMap[href];
        if (!item.name) item.name = titleFromSlug(href);
        if (!item.cover) {
            // Try one more time from the full document for this href.
            var coverLink = doc.select('a[href="' + href + '"]').first();
            if (coverLink) item.cover = toAbsoluteUrl(firstAttr(coverLink, "img", "src"));
        }

        novelList.push(item);
    });

    if (!novelList.length) return Response.error("Không tìm thấy danh sách truyện");

    return Response.success(novelList);
}