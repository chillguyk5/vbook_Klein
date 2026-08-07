load('config.js');

function mangaSlug(url) {
    var m = /\/(?:read|manga)\/([^/]+)/i.exec(pathOf(url));
    return m ? m[1].toLowerCase() : "";
}

function expandCdn(firstUrl, count) {
    if (!firstUrl || !count) return null;
    var m = /^(https?:\/\/cdn\.hentaicube\.xyz\/(?:ext|cube)\/.+\/)(\d+)(\.[a-zA-Z0-9]+)$/i.exec(firstUrl.split("?")[0]);
    if (!m) return null;
    var prefix = m[1], pad = (m[2] + "").length, start = parseInt(m[2], 10), ext = m[3];
    if (isNaN(start)) return null;
    var list = [];
    for (var i = 0; i < count; i++) { var n = start + i, ns = "" + n; while (ns.length < pad) ns = "0" + ns; list.push(prefix + ns + ext); }
    return list;
}

// Fast: launch chapter directly (no warm), poll with callJs, expand CDN
function fastChapterImages(url) {
    var slug = mangaSlug(url);
    var count = 0;

    // 1) fetch HTML for data-count
    try {
        var resp = request(url);
        if (resp && resp.ok) {
            var t = resp.text() || "";
            if (!isBlockedText(t)) {
                var dc = (/data-count\s*=\s*["'](\d+)["']/i.exec(t) || []);
                count = parseInt(dc[1] || "0", 10);
            }
        }
    } catch(e) {}

    // 2) browser nhanh
    var b = null;
    try {
        b = Engine.newBrowser();
        try { b.setUserAgent(getUa()); } catch(e) { try { b.setUserAgent(UserAgent.android()); } catch(e2) {} }

        b.launch(normalizeUrl(url), 20000);
        try { sleep(600); } catch(e) {}

        var imgs = [];
        for (var p = 0; p < 4; p++) {
            try { sleep(p === 0 ? 0 : 400); } catch(e) {}
            var js = "(function(){var r=document.querySelector('#manga-secure-reader,.manga-secure-reader');var a=[];if(r){var imgs=r.querySelectorAll('img');for(var i=0;i<imgs.length;i++){a.push(imgs[i].getAttribute('data-src')||imgs[i].getAttribute('data-lazy-src')||imgs[i].src||'');}}var c=[];for(var k=0;k<a.length;k++){var u=a[k];if(u.indexOf('http')===0&&u.indexOf('data:')!==0&&u.indexOf('blank')<0)c.push(u);}return c.join('|||');})()";
            try {
                var raw = (b.callJs(js, 3000) + "").replace(/<[^>]+>/g, " ").trim();
                var parts = raw.split("|||");
                for (var i = 0; i < parts.length; i++) {
                    var u = (parts[i] || "").replace(/\?.*$/, "").trim();
                    if (u && u.indexOf("http") === 0 && u.indexOf(CDN) >= 0 && imgs.indexOf(u) < 0) imgs.push(u);
                }
            } catch(e2) {}
            if (imgs.length > 0) break;
        }

        if (imgs.length > 0) {
            // filter by slug
            if (slug) {
                var filtered = [];
                for (var i = 0; i < imgs.length; i++) { if (imgs[i].toLowerCase().indexOf("/" + slug + "/") >= 0) filtered.push(imgs[i]); }
                if (filtered.length) imgs = filtered;
            }
            var total = count > 0 ? count : (imgs.length >= 3 ? imgs.length + 10 : 40);
            if (total > imgs.length && imgs[0]) {
                var exp = expandCdn(imgs[0], total);
                if (exp) return exp;
            }
            return imgs;
        }
    } catch(e) {}
    finally { try { if (b) b.close(); } catch(e2) {} }
    return null;
}

function collectImages(doc) {
    var data = [], seen = {};
    function add(link) {
        link = normalizeImage(link);
        if (!link || seen[link]) return;
        if (link.indexOf(CDN) >= 0 && /\.(?:jpg|jpeg|png|webp)/i.test(link)) { seen[link] = true; data.push(link); return; }
        if (link.indexOf("wp-content/uploads") >= 0 && /\.(?:jpg|jpeg|png|webp)/i.test(link)) { seen[link] = true; data.push(link); }
    }
    doc.select("#chapter_content img, .reading-content .page-break img, .reading-content img, #manga-secure-reader img, img.wp-manga-chapter-img").forEach(function(e) { add(imageAttr(e)); });
    return data;
}

function execute(url) {
    url = normalizeUrl(url);

    // 1) fast CDN expand (browser direct, 1-2s)
    var fast = fastChapterImages(url);
    if (fast && fast.length) return Response.success(fast);

    // 2) getDoc full browser (warm + navigate)
    var doc = getDoc(url);
    if (!doc) return loadError();

    var data = collectImages(doc);
    if (data.length) return Response.success(data);

    return Response.error(LAST_ERROR || "Không tìm thấy ảnh chap.");
}
