load("config.js");

function execute(url) {
    let meta = parseStvUrl(url);
    if (!meta || !meta.chapterId) {
        return Response.error("Không nhận diện được URL chương Sáng Tác Việt.");
    }

    if (!PROXY_URL) {
        return Response.error("Chưa cấu hình Proxy Server URL. Vào Cài đặt plugin để nhập URL.");
    }

    if (!PROXY_TOKEN) {
        return Response.error("Chưa nhập License Token. Vào Cài đặt plugin để nhập Token.");
    }

    let result = tryFetchChapterViaProxy(meta);
    if (result.error) {
        return Response.error(result.error);
    }

    return Response.success(result.data);
}

function captureStvProxyCookie(meta) {
    var urls = [];
    if (meta && meta.chapterId) {
        urls.push(buildStvChapterUrl(meta, meta.chapterId));
    }
    if (meta) {
        urls.push(buildStvBookUrl(meta));
    }
    for (var i = 0; i < urls.length; i++) {
        try {
            var probe = fetch(urls[i], { headers: { "User-Agent": STV_ANDROID_UA } });
            if (probe && probe.request && probe.request.headers && probe.request.headers.cookie) {
                var cookie = String(probe.request.headers.cookie || "").replace(/[\r\n]/g, "");
                if (cookie) {
                    return cookie;
                }
            }
        } catch (probeErr) {}
    }
    return "";
}

function requestChapterViaFetch(endpoint, headers, body) {
    try {
        var response = fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });
        var payload = null;
        try { payload = response.json(); } catch (e) {}
        return {
            status: Number(response.status || 0),
            ok: !!response.ok,
            payload: payload,
            networkError: false
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            payload: null,
            networkError: true,
            error: error
        };
    }
}

function isProxyChapterSuccess(result) {
    return !!(result && result.payload && Number(result.payload.code) === 0 && result.payload.data);
}

function isTransientProxyFailure(status, payload, result) {
    var code = Number(status || 0);
    var pCode = payload ? Number(payload.code || payload.reason || 0) : 0;
    var text = payload && payload.error ? String(payload.error).toLowerCase() : "";

    if (result && result.networkError) return true;
    if (!code && !pCode) return true;

    var transient = {
        0: true,
        408: true,
        425: true,
        429: true,
        500: true,
        502: true,
        503: true,
        504: true
    };

    if (transient[code] || transient[pCode]) return true;
    if (text.indexOf("timeout") >= 0 || text.indexOf("gateway") >= 0 || text.indexOf("upstream") >= 0) return true;

    return false;
}

function tryFetchChapterViaProxy(meta) {
    var stvCookie = captureStvProxyCookie(meta);
    var endpoint = PROXY_URL + "/stv/chapter";
    var body = {
        bookid: meta.bookId,
        cid:    meta.chapterId,
        host:   meta.host
    };

    if (stvCookie) {
        body.stvCookie = stvCookie;
    }

    var headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": STV_ANDROID_UA,
        "X-License-Token": PROXY_TOKEN
    };

    var maxAttempts = 1;
    var lastStatus = 0;
    var lastPayload = null;
    var hadNetworkError = false;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        var fetchResult = requestChapterViaFetch(endpoint, headers, body);

        lastStatus = fetchResult.status;
        lastPayload = fetchResult.payload;
        hadNetworkError = hadNetworkError || !!fetchResult.networkError;

        if (isProxyChapterSuccess(fetchResult)) {
            return { data: fetchResult.payload.data };
        }

        if (attempt >= maxAttempts || !isTransientProxyFailure(lastStatus, lastPayload, fetchResult)) {
            break;
        }

        sleep(Math.min(1200, 300 * attempt));
    }

    if (!lastPayload && !lastStatus && hadNetworkError) {
        return { error: "Lỗi kết nối tới Proxy Server. Kiểm tra lại mạng và URL server." };
    }

    return { error: buildErrorMsg(lastStatus, lastPayload) };
}

function buildTokenStatusInfo(tokenInfo) {
    if (!tokenInfo) {
        return "";
    }

    var state = tokenInfo.active ? (tokenInfo.isExpired ? "Hết hạn" : "Đang hoạt động") : "Đã bị khóa";
    var stats = tokenInfo.stats || {};
    var parts = [];

    parts.push("Trạng thái: " + state);

    if (tokenInfo.tokenHint) {
        parts.push("Token: " + tokenInfo.tokenHint);
    }
    if (tokenInfo.dailyLimit != null || tokenInfo.monthlyLimit != null) {
        var dayPart = (stats.todayCount || 0) + "/" + (tokenInfo.dailyLimit != null ? tokenInfo.dailyLimit : "∞");
        var monthPart = (stats.monthCount || 0) + "/" + (tokenInfo.monthlyLimit != null ? tokenInfo.monthlyLimit : "∞");
        parts.push("Quota: ngày " + dayPart + ", tháng " + monthPart);
    }
    if (tokenInfo.proxyDisplay || tokenInfo.upstreamOrigin) {
        parts.push("Route: " + (tokenInfo.proxyDisplay || "direct") + " -> " + (tokenInfo.upstreamOrigin || "-"));
    }
    if (tokenInfo.lastClientIp) {
        parts.push("IP gần nhất: " + tokenInfo.lastClientIp);
    }
    if (stats.lastSeen) {
        parts.push("Lần gọi cuối: " + String(stats.lastSeen).replace("T", " ").replace(/\.\d+Z$/, "Z"));
    }

    return parts.length ? "\n\n[Token Info]\n" + parts.join("\n") : "";
}

function buildErrorMsg(httpStatus, p) {
    var tokenInfoText = buildTokenStatusInfo(p && p.tokenInfo ? p.tokenInfo : null);

    var statusCode = httpStatus || 0;
    var pCode = p && (p.code || p.reason) ? (Number(p.code) || 0) : 0;
    if (!statusCode && pCode >= 400) {
        statusCode = pCode;
    }

    if (statusCode === 401 || (p && p.code === 401)) {
        return "[Token] Token không hợp lệ hoặc đã hết hạn.\nKiểm tra lại License Token trong Cài đặt plugin." + tokenInfoText;
    }

    if (statusCode === 429 || (p && p.code === 429)) {
        let errText = (p && p.error) ? String(p.error) : "";

        if (p && p.cooldown && p.retryAfter) {
            let mins = Math.ceil(p.retryAfter / 60);
            return "[Rate Limit] Token bị tạm khóa " + mins + " phút do gửi quá nhiều request liên tục.\nThử lại sau " + mins + " phút." + tokenInfoText;
        }
        if (errText.indexOf("ngày") !== -1) {
            return "[Quota] Đã đạt giới hạn request trong ngày. Thử lại vào ngày mai." + tokenInfoText;
        }
        if (errText.indexOf("tháng") !== -1) {
            return "[Quota] Đã đạt giới hạn request trong tháng. Thử lại vào tháng sau." + tokenInfoText;
        }
        return "[Rate Limit] Quá nhiều request. Chờ một chút rồi thử lại." + tokenInfoText;
    }

    if (statusCode === 500) {
        return "[Server] Lỗi nội bộ proxy server. Thử lại sau." + tokenInfoText;
    }
    if (statusCode === 503) {
        return "[Server] Proxy server đang bảo trì hoặc token chưa được gán proxy khả dụng. Thử lại sau." + tokenInfoText;
    }

    if (p && p.error) {
        return "[STV] " + p.error + tokenInfoText;
    }

    if (statusCode && statusCode !== 200) {
        return "[HTTP " + statusCode + "] Không kết nối được proxy server." + tokenInfoText;
    }

    return "Không tải được nội dung chương. Kiểm tra Proxy Server URL và License Token." + tokenInfoText;
}
