function execute() {
    return Response.success([
        { title: "Truyện Đề Cử", input: "https://sitruyencv.com/recommended", script: "gen.js" },
        { title: "Truyện Hot", input: "https://sitruyencv.com/popular", script: "gen.js" },
        { title: "Truyện Hoàn Thành", input: "https://sitruyencv.com/completed", script: "gen.js" },
        { title: "Truyện Mới Cập Nhật", input: "https://sitruyencv.com/updated", script: "gen.js" },
        { title: "Convert", input: "https://sitruyencv.com/type/Convert", script: "gen.js" },
        { title: "Dịch", input: "https://sitruyencv.com/type/Dich", script: "gen.js" }
    ]);
}
