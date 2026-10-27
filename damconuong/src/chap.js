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

var LAST_CHAP_ERROR = "";

function fetchCipherPages(cipherPath) {
    try {
        var sep = cipherPath.indexOf("/");
        if (sep <= 0 || sep >= cipherPath.length - 1) return null;

        var token = DcnCipher.makeToken(cipherPath);
        var requestUrl = BASE_URL + "/_c/mangas/" + encodeURIComponent(cipherPath.substring(0, sep)) +
            "/chapters/" + encodeURIComponent(cipherPath.substring(sep + 1)) +
            "/pages?_=" + token;
        var response = dcnFetch(requestUrl, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json"
            }
        });
        if (!response.ok) {
            try {
                var errJson = response.json();
                if (errJson && errJson.code === "login_required") {
                    LAST_CHAP_ERROR = "Chương này yêu cầu đăng nhập trên Damconuong để đọc.";
                }
            } catch (e) {}
            return null;
        }

        var body = response.json();
        if (!body || !body.e) return null;

        var payload = DcnCipher.decryptPayload(cipherPath, token, body.e);
        if (!payload || !payload.p || !payload.p.length) return null;

        var data = [];
        var keys = payload.s || [];
        for (var i = 0; i < payload.p.length; i++) {
            var src = payload.p[i];
            var link = normalizeUrl(String(src));
            if (!link) continue;
            var key = keys[i] || "";
            if (key && String(key).indexOf("x1.") === 0) {
                data.push({
                    link: link + " " + key,
                    script: "image.js"
                });
            } else {
                data.push({
                    link: link,
                    headers: {
                        "Referer": BASE_URL + "/",
                        "User-Agent": getDcnUa()
                    }
                });
            }
        }
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
                link: img,
                headers: {
                    "Referer": BASE_URL + "/",
                    "User-Agent": getDcnUa()
                }
            });
        }
    });
    return data;
}

function execute(url) {
    LAST_CHAP_ERROR = "";
    url = normalizeUrl(url);

    var parts = splitChapterPath(url);
    if (parts) {
        var pages = fetchCipherPages(parts.story + "/" + parts.chap);
        if (pages && pages.length) return Response.success(pages);
    }

    // Fallback: đọc HTML chương (path cipher khác URL hoặc cơ chế cũ img.chapter-img)
    var response = dcnFetch(url);
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

        var contentText = doc.select("#chapter-content").text() || "";
        if (contentText.indexOf("Nội dung bị hạn chế") >= 0 || contentText.indexOf("đăng nhập") >= 0) {
            return Response.error("Nội dung bị hạn chế: Vui lòng đăng nhập trên trang nguồn để xem chương này.");
        }
    }

    if (LAST_CHAP_ERROR) return Response.error(LAST_CHAP_ERROR);
    return null;
}
