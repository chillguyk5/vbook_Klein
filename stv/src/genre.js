load("config.js");

function execute() {
    return Response.success([
        // STV — thể loại tiếng Việt
        { title: "Huyền huyễn", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=hh&sort=viewweek&tag=", script: "gen.js" },
        { title: "Đô thị", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=dt&sort=viewweek&tag=", script: "gen.js" },
        { title: "Ngôn tình", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=nt&sort=viewweek&tag=", script: "gen.js" },
        { title: "Võng du", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=vd&sort=viewweek&tag=", script: "gen.js" },
        { title: "Khoa học viễn tưởng", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=kh&sort=viewweek&tag=", script: "gen.js" },
        { title: "Lịch sử", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=lsa&sort=viewweek&tag=", script: "gen.js" },
        { title: "Đồng nhân", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=dn&sort=viewweek&tag=", script: "gen.js" },
        { title: "Dị năng", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=dna&sort=viewweek&tag=", script: "gen.js" },
        { title: "Linh dị", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=ld&sort=viewweek&tag=", script: "gen.js" },
        { title: "Light Novel", input: STV_ORIGIN + "/io/searchtp/searchBooks?minc=0&category=ln&sort=viewweek&tag=", script: "gen.js" },
        // Fanqienovel.com API — thể loại nam (gender=1)
        { title: "♂ FQ Khoa học viễn tưởng", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=8&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Đô thị thường nhật", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=261&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Đô thị tu tiên", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=124&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Kỳ ảo tiên hiệp", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=259&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Lịch sử cổ đại", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=273&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Chiến thần", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=27&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♂ FQ Võng du", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=1&category_id=746&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        // Fanqienovel.com API — thể loại nữ (gender=0)
        { title: "♀ FQ Ngôn tình hiện đại", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=0&category_id=21&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♀ FQ Cổ đại ngôn tình", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=0&category_id=9&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♀ FQ Xuyên không cổ đại", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=0&category_id=126&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" },
        { title: "♀ FQ Tiên hiệp nữ", input: "https://fanqienovel.com/api/author/library/book_list/v0/?page_count=18&page_index=0&gender=0&category_id=93&creation_status=-1&word_count=-1&book_type=-1&sort=0", script: "gen_fq.js" }
    ]);
}
