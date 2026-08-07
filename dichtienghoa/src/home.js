load("config.js");

function execute() {
    loginIfNeeded();
    return Response.success([
        { title: "Mới cập nhật", input: "home:recent", script: "gen.js" },
        { title: "Truyện mới", input: "story:createdAt", script: "gen.js" },
        { title: "Hoàn thành", input: "home:completed", script: "gen.js" },
        { title: "BXH tháng", input: "rank:monthly", script: "gen.js" },
        { title: "BXH cập nhật", input: "rank:updated", script: "gen.js" },
        { title: "BXH hoàn thành", input: "rank:completed", script: "gen.js" },
        { title: "BXH theo dõi", input: "rank:continued", script: "gen.js" },
        { title: "Yêu thích", input: "story:likes", script: "gen.js" },
        { title: "Lượt xem", input: "story:views", script: "gen.js" },
        { title: "Thể loại", input: "genre", script: "genre.js" }
    ]);
}
