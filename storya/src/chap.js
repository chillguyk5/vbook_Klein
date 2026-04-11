load("config.js");

function execute(url) {
    var chapterUrl = toAbsoluteUrl(url);
    var response = fetch(chapterUrl);
    if (!response.ok) return Response.error("Không thể tải nội dung chương");

    var doc = response.html();

    var content = doc.select("#reading-content > .transition-all").first();
    if (!content) content = doc.select("#reading-content .transition-all").first();
    if (!content) {
        content = doc.select("#reading-content").first();
        if (content) {
            content.select(".mb-8.text-center").remove();
            content.select(".sr-only").remove();
        }
    }
    if (!content) return Response.error("Không tìm thấy nội dung chương");

    content.select("script").remove();
    content.select("noscript").remove();
    content.select("iframe").remove();

    var html = content.html();
    if (!html || !String(html).trim()) return Response.error("Nội dung chương trống");

    return Response.success(html);
}