load("config.js");

function execute() {
    return Response.success([
        {
            title: "Truyện mới cập nhật",
            input: BASE_URL + "/danh-sach/truyen-moi",
            script: "list.js"
        },
        {
            title: "Truyện hot",
            input: BASE_URL + "/danh-sach/truyen-hot",
            script: "list.js"
        },
        {
            title: "Truyện full",
            input: BASE_URL + "/danh-sach/truyen-full",
            script: "list.js"
        }
    ]);
}