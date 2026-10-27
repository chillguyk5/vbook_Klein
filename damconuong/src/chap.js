load('config.js');
load('dcn-crypto.js');

// Ảnh chương của site mới được phân phối qua cơ chế cipher:
// GET BASE_URL + /_c/mangas/{story}/chapters/{chap}/pages?_={token}
// (token HMAC-SHA256 tính trong dcn-crypto.js) → JSON {e: <b64>} → giải mã
// AES-256-GCM → {p: [url ảnh...], s: [key scramble nếu có]}

function splitChapterPath(url) {
    var cleaned = String(url || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
    var matched = /\/truyen\/([^\/?#]+)\/([^\/?#]+)$/i.exec(cleaned);
    if (!matched) return null;
    return {
        story: matched[1],
        chap: matched[2]
    };
}

function fetchCipherPages(cipherPath) {
    try {
        var sep = cipherPath.indexOf("/");
        if (sep <= 0 || sep >= cipherPath.length - 1) return null;

        var token = DcnCipher.makeToken(cipherPath);
        var requestUrl = BASE_URL + "/_c/mangas/" + encodeURIComponent(cipherPath.substring(0, sep)) +
            "/chapters/" + encodeURIComponent(cipherPath.substring(sep + 1)) +
            "/pages?_=" + token;
        var response = fetch(requestUrl, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json"
            }
        });
        if (!response.ok) return null;

        var body = response.json();
        if (!body || !body.e) return null;

        var payload = DcnCipher.decryptPayload(cipherPath, token, body.e);
        if (!payload || !payload.p || !payload.p.length) return null;

        var data = [];
        payload.p.forEach(function(src) {
            var link = normalizeUrl(String(src));
            if (link) data.push({ link: link });
        });
        return data.length ? data : null;
    } catch (error) {
        return null;
    }
}

function parseLegacyImages(doc) {
    var data = [];
    doc.select("img.chapter-img").forEach(function(e) {
        var img = normalizeUrl(e.attr("data-src"));
        if (!img) {
            img = normalizeUrl(e.attr("src"));
        }
        if (img) {
            data.push({
                link: img
            });
        }
    });
    return data;
}

function execute(url) {
    url = normalizeUrl(url);

    var parts = splitChapterPath(url);
    if (parts) {
        var pages = fetchCipherPages(parts.story + "/" + parts.chap);
        if (pages && pages.length) return Response.success(pages);
    }

    // Fallback: đọc HTML chương (path cipher khác URL hoặc cơ chế cũ img.chapter-img)
    var response = fetch(url);
    if (response.ok) {
        var doc = response.html();

        var cipherNode = doc.select("#chapter-content").first();
        if (cipherNode && parts) {
            var cipherPath = cleanText(cipherNode.attr("data-cipher-path"));
            if (cipherPath && cipherPath !== parts.story + "/" + parts.chap) {
                var pagesRetry = fetchCipherPages(cipherPath);
                if (pagesRetry && pagesRetry.length) return Response.success(pagesRetry);
            }
        }

        var legacy = parseLegacyImages(doc);
        if (legacy.length) return Response.success(legacy);
    }

    return null;
}
