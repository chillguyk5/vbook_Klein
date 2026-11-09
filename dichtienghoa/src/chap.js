load("config.js");

function stripLeadingTitle(content) {
    if (!content) return "";
    var lines = String(content).replace(/^\uFEFF/, "").split(/\r?\n/);
    var start = 0;
    while (start < lines.length && !lines[start].trim()) start++;
    if (start < lines.length && (/^第\s*\d+\s*章/.test(lines[start].trim()) || /^(序章|楔子|终章|終章|番外)/.test(lines[start].trim()))) {
        lines.splice(start, 1);
        if (start < lines.length && !lines[start].trim()) lines.splice(start, 1);
    }
    return lines.join("\n");
}

function pullContent(json) {
    if (!json) return "";
    var d = json.data;
    return (d && (d.content || d.text)) || json.content || json.chapterContent || json.chapterConent || json.text || "";
}

function crawlContent(sourceUrl, storyId, chapterId, isVip) {
    if (!sourceUrl) return "";
    var srcName = getSourceName(sourceUrl);
    if (!srcName) {
        var srcRes = apiFetch("/api/models/source?pageSize=100", { referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId });
        var srcJson = parseJson(srcRes);
        var list = (srcJson && srcJson.data) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].baseUrl && sourceUrl.indexOf(list[i].baseUrl) === 0) {
                srcName = list[i].name;
                break;
            }
        }
    }
    if (!srcName) return "";
    var path = (isVip && srcName === "bookqq") ? "/api/models/crawl/bookqq/contentVip" : ("/api/models/crawl/" + encodeURIComponent(srcName) + "/content");
    var res = apiFetch(path + "?url=" + encodeURIComponent(sourceUrl), { referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId });
    return res && res.ok ? pullContent(parseJson(res)) : "";
}

function execute(url) {
    if (!url) return null;
    var m = url.match(/truyen\/(\d+)\/(\d+)/);
    if (!m) return null;
    var storyId = m[1];
    var chapterId = m[2];

    // Fast-path crawl from ?su=
    var suM = url.match(/[?&]su=([^&]+)/);
    if (suM) {
        var crawled = crawlContent(decodeURIComponent(suM[1]), storyId, chapterId, false);
        if (crawled && crawled.length >= 150) {
            return Response.success(formatContent(stripLeadingTitle(crawled)));
        }
    }

    loginIfNeeded();
    var referer = BASE_URL + "/truyen/" + storyId + "/" + chapterId;
    var res = apiFetch("/api/models/chapter/" + chapterId, { referer: referer });
    if (!res) return null;

    if (res.status === 401 || res.status === 402) {
        if (isUserAuthenticated()) {
            var mode = getBuyMode();
            if (mode === "on") {
                var buy = buyChapter(chapterId, referer);
                if (!buy.ok) return Response.error("Không tự mua chương: " + buy.message);
                res = apiFetch("/api/models/chapter/" + chapterId, { referer: referer });
                if (!res || !res.ok) return Response.error("Đã mua nhưng chương vẫn bị khóa, thử lại sau.");
            } else if (mode === "confirm") {
                var pKey = "dth_pending_buy_" + chapterId;
                var pTime = typeof localStorage !== "undefined" ? parseInt(localStorage.getItem(pKey) || "0", 10) : 0;
                if (pTime > 0 && (Date.now() - pTime < 45000)) {
                    if (typeof localStorage !== "undefined") localStorage.removeItem(pKey);
                    var buy2 = buyChapter(chapterId, referer);
                    if (!buy2.ok) return Response.error("Mua chương thất bại: " + buy2.message);
                    res = apiFetch("/api/models/chapter/" + chapterId, { referer: referer });
                    if (!res || !res.ok) return Response.error("Đã mua nhưng chương vẫn bị khóa, thử lại sau.");
                } else {
                    if (typeof localStorage !== "undefined") localStorage.setItem(pKey, String(Date.now()));
                    var errJ = parseJson(res) || {};
                    var chPrice = (errJ.data && errJ.data.vipPrice) || errJ.vipPrice || "";
                    var wallet = getUserWallet();
                    var balText = (wallet && wallet.balance !== undefined) ? ("Ví: " + wallet.balance + " coin") : "";
                    var priceText = chPrice ? ("Giá: " + chPrice + " coin") : "Chương VIP";
                    return Response.error("🔒 " + priceText + (balText ? " | " + balText : "") +
                        "\n\n👉 Nhấn nút [THỬ LẠI] bên dưới để XÁC NHẬN MUA chương này." +
                        "\n(Nếu không muốn mua, vui lòng quay lại hoặc chuyển chương)");
                }
            } else {
                return Response.error("Chương VIP (chưa mua). Hãy bật mua chương trong Cài đặt hoặc mở Web để đọc.");
            }
        } else if (res.status === 401) {
            return Response.error("Chương VIP yêu cầu đăng nhập (vào cài đặt hoặc đăng nhập web).");
        } else {
            return Response.error("Bạn cần mua chương VIP này trước khi đọc.");
        }
    }

    if (res.status === 403) return Response.error("Truy cập bị chặn (403). Thử đăng nhập lại.");
    if (!res.ok) return null;

    var json = parseJson(res);
    if (!json) return null;

    var chData = json.data || json;
    var content = pullContent(chData);
    var isVip = (chData.free === false || Number(chData.vipPrice) > 0);

    if (!content) {
        var src = json.sourceUrl || chData.sourceUrl;
        if (src) content = crawlContent(src, storyId, chapterId, isVip);
    }

    if (!content) return Response.error("Không lấy được nội dung chương.");
    return Response.success(formatContent(stripLeadingTitle(content)));
}
