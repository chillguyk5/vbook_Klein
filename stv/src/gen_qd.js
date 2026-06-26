load("config.js");

// Lấy _csrfToken từ cookie của qidian.com
// Lần 1: fetch rank page → Qidian set cookie _csrfToken
// Lần 2: fetch lại → cookie được gửi trong request, đọc ra từ response.request.headers.cookie
function getQdCsrfToken() {
    var RANK_URL = "https://m.qidian.com/rank/";
    var hdrs = {
        "User-Agent": STV_ANDROID_UA,
        "Referer": "https://www.qidian.com/"
    };
    fetch(RANK_URL, { headers: hdrs });
    var r = fetch(RANK_URL, { headers: hdrs });
    var cookie = "";
    try { cookie = r.request.headers.cookie || ""; } catch (e) {}
    var m = cookie.match(/_csrfToken=([^;& ]+)/);
    return m ? m[1] : "";
}

// url: full API URL, e.g. "https://m.qidian.com/majax/rank/yuepiaolist?gender=male"
// page: page number (string or int), starts from 1
function execute(url, page) {
    if (!page) page = 1;
    page = parseInt(String(page), 10);
    if (isNaN(page) || page < 1) page = 1;

    var token = getQdCsrfToken();
    if (!token) return null;

    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    var targetUrl = url + sep + "pageNum=" + page + "&_csrfToken=" + token;

    var response = fetch(targetUrl, {
        headers: {
            "User-Agent": STV_ANDROID_UA,
            "Referer": "https://m.qidian.com/rank/"
        }
    });
    if (!response.ok) return null;

    var json = response.json();
    if (!json || json.code !== 0 || !json.data) return null;

    var records = json.data.records || [];
    var items = [];

    records.forEach(function(e, idx) {
        var i = (page - 1) * 20 + idx + 1;
        var info = [e.rankCnt, e.cat].filter(Boolean).join(" | ");
        items.push({
            name: "<" + i + "> " + (e.bName || ""),
            link: STV_ORIGIN + "/truyen/qidian/1/" + e.bid + "/",
            cover: "https://bookcover.yuewen.com/qdbimg/349573/" + e.bid + "/150.webp",
            description: (e.bAuth || "") + (info ? " — " + info : "")
        });
    });

    var next = (records.length > 0 && !json.data.isLast) ? String(page + 1) : "";
    return Response.success(items, next);
}
