load('config.js');

function execute() {
    return Response.success([
        {title: "Truyện mới", input: BASE_URL + "/read/?m_orderby=new-manga", script: "gen.js"},
        {title: "Đọc nhiều", input: BASE_URL + "/read/?m_orderby=views", script: "gen.js"},
        {title: "HOT", input: BASE_URL + "/hot/", script: "gen.js"},
        {title: "Hoàn thành", input: BASE_URL + "/?s=&post_type=wp-manga&status%5B%5D=end", script: "gen.js"},
        {title: "Danh sách truyện", input: BASE_URL + "/read/", script: "gen.js"},
        {title: "Truyện màu", input: BASE_URL + "/theloai/full-color/", script: "gen.js"},
        {title: "Không che", input: BASE_URL + "/theloai/khong-che/", script: "gen.js"},
        {title: "Webtoon", input: BASE_URL + "/theloai/webtoon/", script: "gen.js"},
        {title: "Manhwa", input: BASE_URL + "/theloai/manhwa/", script: "gen.js"}
    ]);
}
