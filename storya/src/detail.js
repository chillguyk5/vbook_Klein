load("config.js");

function execute(url) {
    var slug = extractStorySlug(url);
    if (!slug) return Response.error("Không tìm thấy slug truyện từ URL");

    var response = fetch(API_BASE + "/stories/" + slug);
    if (!response.ok) return Response.error("Không thể lấy thông tin truyện");

    var json = response.json();
    var story = json && json.data ? json.data : json;
    if (!story) return Response.error("Không có dữ liệu truyện");

    var genres = [];
    (story.genres || []).forEach(function (genre) {
        if (!genre || !genre.slug) return;
        genres.push({
            title: genre.name || genre.slug,
            input: BASE_URL + "/the-loai/" + genre.slug,
            script: "list.js"
        });
    });

    var statusLabel = String(story.status || "").toUpperCase() === "COMPLETED" ? "Hoàn thành" : "Đang cập nhật";
    var detail = [
        "Trạng thái: " + statusLabel,
        "Số chương: " + (story.totalChapters || 0),
        "Lượt xem: " + (story.viewCount || 0),
        "Đánh giá: " + (story.ratingScore || 0) + " (" + (story.ratingCount || 0) + " lượt)"
    ].join("<br>");

    return Response.success({
        name: story.title || "",
        cover: story.coverUrl || "",
        author: (story.author && story.author.name) ? story.author.name : "Đang cập nhật",
        description: story.rewrittenDescription || story.description || "",
        detail: detail,
        ongoing: String(story.status || "").toUpperCase() !== "COMPLETED",
        host: BASE_URL,
        genres: genres
    });
}