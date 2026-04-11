load("config.js");

function execute(url) {
    var slug = extractStorySlug(url);
    if (!slug) return Response.error("Không tìm thấy slug truyện từ URL");

    var chapters = [];
    var page = 1;
    var maxPage = 200;

    while (page <= maxPage) {
        var apiUrl = API_BASE + "/chapters/story/" + slug + "?page=" + page + "&limit=100&minimal=true";
        var response = fetch(apiUrl);
        if (!response.ok) {
            if (page === 1) return Response.error("Không thể tải danh sách chương");
            break;
        }

        var json = response.json();
        var data = (json && json.data) ? json.data : [];
        if (!data.length) break;

        data.forEach(function (chapter) {
            if (!chapter || !chapter.slug) return;
            chapters.push({
                name: chapter.title || ("Chương " + (chapter.order || "")),
                url: "/truyen/" + slug + "/" + chapter.slug,
                host: BASE_URL
            });
        });

        if (!json.meta || page >= json.meta.totalPages) break;
        page += 1;
    }

    return Response.success(chapters);
}