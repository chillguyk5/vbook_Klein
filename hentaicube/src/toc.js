load('config.js');

function parseChapters(doc, storyUrl) {
    var data = [], seen = {};
    var story = storyUrl ? storyUrlFromAny(storyUrl) : "";
    doc.select("#manga-chapters-holder li.wp-manga-chapter a[href], .listing-chapters_wrap li.wp-manga-chapter a[href], ul.main.version-chap li.wp-manga-chapter a[href]").forEach(function(a) {
        if (isNavLink(a)) return;
        var href = a.attr("href");
        if (!isChapterUrl(href)) return;
        var link = normalizeUrl(href);
        if (story && storyUrlFromAny(link) !== story) return;
        var name = cleanText(a.text()) || cleanText(a.attr("title"));
        if (!name || isNavLabel(name) || seen[link]) return;
        seen[link] = true;
        data.push({name: name, url: link, host: BASE_URL});
    });
    return data;
}

function fetchAjaxText(url, referer) {
    var text = "";
    try {
        var r = request(url, { method: "POST", headers: {
            "Accept": "text/html, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": BASE_URL, "Referer": referer || BASE_URL + "/",
            "X-Requested-With": "XMLHttpRequest"
        }, body: "" });
        if (r && r.ok) { var t = r.text(); if (t && !isBlockedText(t)) text = t; }
    } catch(e) {}
    return text;
}

function collectAjaxPages(target) {
    var pages = [];
    var seenSig = {};

    for (var pg = 1; pg <= 100; pg++) {
        var ajaxUrl = storyUrlFromAny(target) + "ajax/chapters/";
        if (pg > 1) ajaxUrl += "?t=" + pg;
        var text = fetchAjaxText(ajaxUrl, target);
        if (!text) break;
        var batch = parseChapters(Html.parse(text), target);
        if (!batch.length) break;
        var sig = batch.length + "|" + batch[0].url + "|" + batch[batch.length - 1].url;
        if (seenSig[sig]) break;
        seenSig[sig] = true;
        pages.push(text);
        if (batch.length < 20) break;
    }
    return pages;
}

function execute(url) {
    var target = storyUrlFromAny(url);
    var data = [], seen = {};

    // 1) AJAX chapter pages
    var pages = collectAjaxPages(target);
    for (var i = 0; i < pages.length; i++) {
        var batch = parseChapters(Html.parse(pages[i]), target);
        for (var j = 0; j < batch.length; j++) {
            if (!seen[batch[j].url]) { seen[batch[j].url] = true; data.push(batch[j]); }
        }
    }

    // 2) fallback: fetch detail page
    if (!data.length) {
        var doc = getDoc(target);
        if (!doc) return loadError();
        data = parseChapters(doc, target);
        if (!data.length) {
            doc.select("li.wp-manga-chapter a[href]").forEach(function(a) {
                if (isNavLink(a)) return;
                var href = a.attr("href");
                if (!isChapterUrl(href)) return;
                var link = normalizeUrl(href);
                if (storyUrlFromAny(link) !== target) return;
                var name = cleanText(a.text());
                if (!name || isNavLabel(name) || seen[link]) return;
                seen[link] = true;
                data.push({name: name, url: link, host: BASE_URL});
            });
        }
    }

    if (!data.length) return Response.error("Không tìm thấy chapter nào.");

    // sort by number
    data.sort(function(a, b) {
        var ma = (a.name + " " + a.url).match(/(?:chap|ch)\s*-?\s*(\d+)/i);
        var mb = (b.name + " " + b.url).match(/(?:chap|ch)\s*-?\s*(\d+)/i);
        var na = ma ? parseInt(ma[1]) : 0;
        var nb = mb ? parseInt(mb[1]) : 0;
        if (na && nb) return na - nb;
        return 0;
    });

    return Response.success(data);
}
