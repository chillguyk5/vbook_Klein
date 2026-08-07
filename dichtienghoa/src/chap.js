load("config.js");

function pullContent(json) {
    if (!json) return "";
    if (json.data && json.data.content) return json.data.content;
    if (json.content) return json.content;
    if (json.chapterContent) return json.chapterContent;
    if (json.chapterConent) return json.chapterConent;
    return "";
}

function stripLeadingTitle(content) {
    if (!content) return "";
    var text = String(content).replace(/^\uFEFF/, "");
    var lines = text.split(/\r?\n/);
    var start = 0;
    while (start < lines.length && !String(lines[start]).replace(/^[\s\u3000\u00a0]+|[\s\u3000\u00a0]+$/g, "")) {
        start++;
    }
    if (start < lines.length) {
        var first = String(lines[start]).replace(/^[\s\u3000\u00a0]+|[\s\u3000\u00a0]+$/g, "");
        if (/^第\s*\d+\s*章/.test(first) || /^(序章|楔子|终章|終章|番外)/.test(first)) {
            lines.splice(start, 1);
            // drop one blank line after title
            if (start < lines.length && !String(lines[start]).replace(/^[\s\u3000\u00a0]+$/, "")) {
                lines.splice(start, 1);
            }
        }
    }
    return lines.join("\n");
}

function crawlContent(sourceUrl, storyId, chapterId) {
    if (!sourceUrl) return "";
    var sourceName = getSourceName(sourceUrl);
    if (!sourceName) {
        var srcRes = apiFetch("/api/models/source?pageSize=100", {
            referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId
        });
        var srcJson = parseJson(srcRes);
        var list = (srcJson && srcJson.data) ? srcJson.data : [];
        for (var i = 0; i < list.length; i++) {
            var src = list[i];
            if (src && src.baseUrl && sourceUrl.indexOf(src.baseUrl) === 0) {
                sourceName = src.name;
                break;
            }
        }
    }
    if (!sourceName) return "";

    var crawlRes = apiFetch(
        "/api/models/crawl/" + encodeURIComponent(sourceName) + "/content?url=" + encodeURIComponent(sourceUrl),
        { referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId }
    );
    if (!crawlRes || !crawlRes.ok) return "";
    var crawlJson = parseJson(crawlRes);
    return pullContent(crawlJson);
}

function execute(url) {
    if (!url) return null;
    loginIfNeeded();

    var ids = extractChapterIds(url);
    if (!ids) return null;
    var storyId = ids.storyId;
    var chapterId = ids.chapterId;

    var res = apiFetch("/api/models/chapter/" + chapterId, {
        referer: BASE_URL + "/truyen/" + storyId + "/" + chapterId
    });

    if (!res) return null;
    if (res.status === 401) return Response.error("Chương VIP yêu cầu đăng nhập.");
    if (res.status === 402) return Response.error("Bạn cần mua chương VIP này trước khi đọc.");
    if (res.status === 403) return Response.error("Truy cập bị chặn (403). Thử đăng nhập lại.");
    if (!res.ok) return null;

    var json = parseJson(res);
    if (!json) return null;

    var content = pullContent(json);
    if (!content && json.sourceUrl) {
        content = crawlContent(json.sourceUrl, storyId, chapterId);
    }
    if (!content && json.data && json.data.sourceUrl) {
        content = crawlContent(json.data.sourceUrl, storyId, chapterId);
    }

    if (!content) return Response.error("Không lấy được nội dung chương.");
    content = stripLeadingTitle(content);
    return Response.success(formatContent(content));
}
