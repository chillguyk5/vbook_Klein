load("config.js");

function execute(key, page) {
    if (!page) page = "1";

    var apiUrl = API_BASE + "/stories/search?q=" + encodeURIComponent(key || "") + "&page=" + encodeURIComponent(page) + "&limit=20";
    var response = fetch(apiUrl);
    if (!response.ok) return null;

    var json = response.json();
    var data = (json && json.data) ? json.data : [];
    var list = [];

    data.forEach(function (story) {
        if (!story || !story.slug) return;
        list.push({
            name: story.title || "",
            link: "/truyen/" + story.slug,
            description: (story.author && story.author.name) ? story.author.name : "",
            cover: story.coverUrl || "",
            host: BASE_URL
        });
    });

    var next = "";
    if (json && json.meta && json.meta.page < json.meta.totalPages) {
        next = String(json.meta.page + 1);
    }

    return Response.success(list, next);
}