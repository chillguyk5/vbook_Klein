load('config.js');

function execute(url) {
    url = normalizeUrl(url);

    var matched = /\/truyen\/([^/?#]+)/i.exec(url);
    if (!matched) return null;

    var storySlug = matched[1];
    var response = fetch(url);
    if (response.ok) {
        var doc = response.html();
        var seen = {};
        var data = [];

        // Ưu tiên gom link từ #md-chapter-list (layout mới) để tránh ăn nhầm
        // link rút gọn ở md-stat-latest hoặc nút header.
        var pool = doc.select("#md-chapter-list a[href*='/truyen/" + storySlug + "/']");
        if (pool.size() === 0) {
            pool = doc.select("a[href*='/truyen/" + storySlug + "/']");
        }

        pool.forEach(function(e) {
            var href = normalizeUrl(e.attr("href"));
            if (!href || seen[href]) return;

            // Layout mới: tên chương nằm gọn ở .md-ch-title (không dính metadata thời gian/lượt xem)
            var titleNode = e.select(".md-ch-title").first();
            var name = titleNode ? cleanText(titleNode.text()) : "";
            if (!name) {
                var divNode = e.select("div").first();
                if (divNode) name = cleanText(divNode.text());
            }
            if (!name) {
                // Layout cũ: cắt đuôi " 14.6K 7 tháng trước" nhưng không cắt số chương
                // chỉ cắt sau dấu cách + số + dấu cách + từ thời gian (giờ|ngày|tháng|năm|phút) hoặc ký hiệu K/M
                name = cleanText(e.text())
                    .replace(/\s+·\s+.*$/, "")
                    .replace(/\s+\d[\d,.]*[KMkm]?\s+(?:giờ|ngày|tháng|năm|phút|truoc|trước).*$/i, "")
                    .replace(/\s+\d[\d,.]*[KMkm]\s*$/i, "");
            }
            if (!name) return;
            if (name.indexOf("Đọc từ đầu") === 0 || name.indexOf("Đọc mới nhất") === 0 || name.indexOf("Chương mới nhất") === 0) return;
            if (name === "Home" || name === "Chương trước" || name === "Chương sau" || name === "List") return;

            seen[href] = true;
            data.push({
                name: name,
                url: href,
                host: BASE_URL
            });
        });

        data.reverse();
        return Response.success(data);
    }

    return null;
}