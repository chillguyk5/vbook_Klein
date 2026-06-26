load("config.js");

function execute() {
    return Response.success([
        { title: "FQ nam nổi bật", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=-1&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "Top Tuần", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&sort=viewweek&tag=", script: "gen.js" },
        // STV nội bộ
        { title: "Cập Nhật", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&sort=update&tag=", script: "gen.js" },
        { title: "Nhiều Like", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&sort=upvote&tag=", script: "gen.js" },
        { title: "Top Ngày", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&sort=viewday&tag=", script: "gen.js" },
        // Fanqienovel.com API (nguồn fanqie chính thức)
        { title: "FQ nổi bật", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=-1&category_id=-1&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "FQ nữ nổi bật", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=0&category_id=-1&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "FQ mới nhất", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=-1&category_id=-1&creation_status=1&word_count=-1&book_type=-1&sort=1", script: "gen_fq.js" },
        { title: "FQ hoàn thành", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=-1&category_id=-1&creation_status=0&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        // Qidian.com (m.qidian.com mobile API)
        { title: "Qidian Nguyệt phiếu", input: "https://m.qidian.com/majax/rank/yuepiaolist?gender=male", script: "gen_qd.js" },
        { title: "Qidian Top tuần", input: "https://m.qidian.com/majax/rank/reclist?gender=male", script: "gen_qd.js" }
    ]);
}
