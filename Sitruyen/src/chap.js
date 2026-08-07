var API = "https://api.sitruyencv.com";
var HOST = "https://sitruyencv.com";

function apiHeaders(referer) {
    return {
        "accept": "application/json, text/plain, */*",
        "origin": HOST,
        "referer": referer || (HOST + "/"),
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
}

function parseJson(res) {
    if (!res) return null;
    try {
        if (typeof res.json === "function") {
            var j = res.json();
            if (j) return j;
        }
    } catch (e) {}
    try {
        var t = res.text();
        if (t) return JSON.parse(t);
    } catch (e2) {}
    return null;
}

function parseReadUrl(url) {
    if (!url) return null;
    var s = String(url);

    var m = s.match(/read\/(\d+)\/(\d+)/);
    if (!m) return null;

    var storyId = m[1];
    var chapterNumber = m[2];
    var versionId = null;

    var vm = s.match(/[?&]v=(\d+)/);
    if (vm) versionId = vm[1];

    return {
        storyId: storyId,
        chapterNumber: chapterNumber,
        versionId: versionId
    };
}

function resolveVersionId(storyId) {
    var res = fetch(API + "/api/stories/" + storyId + "/translate-versions", {
        headers: apiHeaders()
    });
    if (!res || !res.ok) return null;
    var json = parseJson(res);
    if (!json || !json.data || !json.data.length) return null;
    return String(parseInt(json.data[0].id, 10));
}

function formatContent(content) {
    if (!content) return "";
    var html = String(content);
    // Nếu đã là HTML thì giữ nguyên, chỉ chuẩn hóa xuống dòng plain text
    if (html.indexOf("<p") < 0 && html.indexOf("<br") < 0 && html.indexOf("<div") < 0) {
        html = html
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/\n/g, "<br>");
    }
    return html;
}

function execute(url) {
    var info = parseReadUrl(url);
    if (!info) return null;

    var versionId = info.versionId;
    if (!versionId) {
        versionId = resolveVersionId(info.storyId);
        if (!versionId) return Response.error("Không lấy được bản dịch truyện.");
    }

    var api = API + "/api/chapters/" + versionId
        + "/read/" + info.chapterNumber
        + "?story_id=" + info.storyId;

    var res = fetch(api, {
        headers: apiHeaders(url)
    });
    if (!res || !res.ok) return null;

    var json = parseJson(res);
    if (!json || !json.data) return null;

    var d = json.data;

    if (d.has_access === false) {
        var msg = "Chương VIP/trả phí — cần đăng nhập hoặc mua trên sitruyencv.com.";
        if (d.vip_from_chapter) {
            msg = "Chương VIP (từ chương " + d.vip_from_chapter + ") — cần đăng nhập/mua trên sitruyencv.com.";
        }
        return Response.error(msg);
    }

    var content = d.content || "";
    if (!content) {
        return Response.error("Nội dung chương trống.");
    }

    return Response.success(formatContent(content));
}
