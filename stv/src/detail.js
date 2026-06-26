load("config.js");

function execute(url) {
    let meta = parseStvUrl(url);
    let canonicalUrl = meta ? buildStvBookUrl(meta) : normalizeStvUrl(url);
    let response = fetch(canonicalUrl, {
        headers: getStvHeaders()
    });
    if (!response.ok) {
        return null;
    }

    let doc = response.html();
    let detailLines = buildStvDetailLines(doc);
    let htmlContent = doc.html() || "";

    let bName = firstStvText(doc, ["#book_name2", "h1", ".book_name"]);
    let mName = htmlContent.match(/"name(?:vi)?"\s*:\s*"([^"]+)"/);
    if (!bName && mName) {
        bName = mName[1];
    }
    if (!bName) {
        bName = "Truyện SangTacViet " + (meta ? meta.bookId : "");
    }



    let bAuthor = pickStvBookAuthor(doc, detailLines, htmlContent);

    let cover = resolveCover(doc, htmlContent);
    // jjwxc fallback: construct cover URL from bookId when all extraction methods fail
    if (meta && meta.host === "jjwxc" && cover.indexOf("favicon") !== -1) {
        cover = "https://i9-static.jjwxc.net/novelimage.php?novelid=" + meta.bookId;
    }

    let statusText = firstStvText(doc, ["#bookstatus"]);
    let detailData = {
        name: bName,
        cover: cover,
        author: bAuthor,
        description: extractStvDescription(doc),
        detail: detailLines.join("<br>"),
        ongoing: !/Hoàn thành|Tạm ngưng|已完结/i.test(safeStvText(statusText || detailLines.join(" ") || doc.text())),
        genres: buildStvGenres(doc, detailLines),
        host: STV_ORIGIN,
        url: canonicalUrl
    };

    if (meta) {
        decorateStvDetail(detailData, meta, bAuthor);
        // LLM mode disabled: registerStvLlmBook call removed
    }

    return Response.success(detailData);
}

function pickStvBookAuthor(doc, detailLines, htmlContent) {
    var bAuthor = extractStvDetailValue(detailLines, "作者") || extractStvDetailValue(detailLines, "Tác giả") || extractStvHeroAuthor(doc) || firstStvText(doc, ["i[t='Tác giả']", "i[t='作者']", ".author"]);
    var mAuthor = htmlContent.match(/"author"\s*:\s*"([^"]+)"/);
    if ((!bAuthor || bAuthor === "Unknown") && mAuthor) {
        bAuthor = mAuthor[1];
    }
    if (!bAuthor) {
        bAuthor = "Unknown";
    }

    var chineseMatch = bAuthor.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/g);
    if (chineseMatch) {
        bAuthor = chineseMatch.join("");
    } else if (mAuthor) {
        var inlineChinese = mAuthor[1].match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/g);
        if (inlineChinese) bAuthor = inlineChinese.join("");
    }

    return safeStvText(bAuthor) || "Unknown";
}

function decorateStvDetail(detailData, meta, author) {
    // Thêm bình luận từ STV
    detailData.comment = {
        title: "Bình luận trên STV",
        input: STV_ORIGIN + "/mobile/comment.php?act=readcomment&host=" + meta.host + "&bookid=" + meta.bookId + "&start=0&order=new",
        script: "comment_stv.js"
    };

    detailData.suggests = [];
    if (author && author !== "Unknown") {
        detailData.suggests.push({
            title: "Cùng tác giả",
            input: JSON.stringify({ author: author, bookId: meta.bookId }),
            script: "suggest.js"
        });
    }

    if (meta.host === "fanqie") {
        detailData.comment = {
            title: "Bình luận Fanqie",
            input: JSON.stringify({ bookId: meta.bookId, sort: "time" }),
            script: "comment.js"
        };
        
        detailData.suggests = [
            {
                title: "Có thể bạn sẽ thích",
                input: meta.bookId,
                script: "suggest_fq.js"
            }
        ];
    } else {
        if (author && author !== "Unknown") {
            detailData.suggests = [
                {
                    title: "Truyện cùng tác giả",
                    input: JSON.stringify({ author: author, bookId: meta.bookId }),
                    script: "suggest.js"
                }
            ];
        }
    }
}

function buildStvDetailLines(doc) {
    let lines = [];
    let viewCount = firstStvText(doc, ["span.blk-item[title]"]);
    pushStvDetailLine(lines, "Lượt đọc", viewCount);

    let infoNodes = doc.select(".blk-body, .blk-body div, .blk-body span, .blk-body a");
    infoNodes.forEach(function(node) {
        let text = safeStvText(node.text());
        appendStvDetailLines(lines, extractStvLabeledLines(text));
    });

    let infoBlocks = doc.select(".blk .blk-body");
    infoBlocks.forEach(function(node) {
        appendStvDetailLines(lines, extractStvLabeledLines(node.text()));
    });

    return lines;
}

function appendStvDetailLines(lines, nextLines) {
    nextLines.forEach(function(line) {
        if (lines.indexOf(line) === -1) {
            lines.push(line);
        }
    });
}

function extractStvLabeledLines(text) {
    let normalizedText = safeStvText(text);
    if (!normalizedText) {
        return [];
    }

    let labels = ["Tên gốc", "Hán việt", "Tác giả", "Thể loại", "Nguồn truyện", "Loại truyện", "Nhập thời", "作者", "类别", "小说来源", "输入时间"];
    let escapedLabels = labels.map(escapeStvRegex);
    let matcher = new RegExp("(" + escapedLabels.join("|") + ")\\s*:\\s*([\\s\\S]*?)(?=(" + escapedLabels.join("|") + ")\\s*:|$)", "gi");
    let lines = [];
    let match;

    while ((match = matcher.exec(normalizedText)) !== null) {
        let label = safeStvText(match[1]);
        let value = safeStvText(match[2]);
        if (label && value) {
            lines.push(label + ": " + value);
        }
    }

    if (lines.length === 0 && /^(Tên gốc|Hán việt|Tác giả|Thể loại|Nguồn truyện|Loại truyện|Nhập thời|作者|类别|小说来源|输入时间)\s*:/i.test(normalizedText)) {
        lines.push(normalizedText);
    }

    return lines;
}

function escapeStvRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pushStvDetailLine(lines, label, value) {
    value = safeStvText(value);
    if (!value) {
        return;
    }

    lines.push(label + ": " + value);
}

function extractStvDetailValue(lines, label) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(label + ":") === 0 || lines[i].indexOf(label + " :") === 0) {
            return safeStvText(lines[i].substring(lines[i].indexOf(":") + 1));
        }
    }

    return "";
}

function extractStvDescription(doc) {
    let metaDescription = firstStvAttr(doc, ["meta[property='og:description']", "meta[name='description']", "meta[itemprop='description']"], "content");
    if (metaDescription) {
        return metaDescription.replace(/\r?\n/g, "<br>");
    }

    let summaryHtml = firstStvHtml(doc, ["#book-sumary .textzoom", "#book-sumary", ".summary .textzoom", ".summary"]);
    if (summaryHtml) {
        return summaryHtml;
    }

    let best = "";
    let blocks = doc.select(".blk .blk-body");
    blocks.forEach(function(node) {
        let text = safeStvText(node.text());
        if (!text) {
            return;
        }

        if (/^(Hán việt|Tác giả|Thể loại|Nguồn truyện|Loại truyện|Nhập thời|作者|类别|小说来源|输入时间):/i.test(text)) {
            return;
        }

        if (text.indexOf("Nguồn:") === 0 || text.indexOf("来源:") === 0) {
            return;
        }

        if ((text.match(/\b\d{3}\s/g) || []).length > 5) {
            return;
        }

        if (text.length > safeStvText(best.replace(/<[^>]+>/g, " ")).length) {
            best = node.html();
        }
    });

    return best;
}

function extractStvHeroAuthor(doc) {
    return firstStvText(doc, ["#book_name2 + div", "#book_name2 + span", "h1 + div", "h1 + span", ".book_name + div", ".book_name + span"]);
}

function firstStvHtml(doc, selectors) {
    for (let i = 0; i < selectors.length; i++) {
        let nodes = doc.select(selectors[i]);
        if (nodes && nodes.length > 0) {
            let html = nodes.first().html();
            if (safeStvText(html.replace(/<[^>]+>/g, " "))) {
                return html;
            }
        }
    }

    return "";
}

function buildStvGenres(doc, detailLines) {
    let genres = [];
    let seen = {};

    pushStvGenres(genres, seen, firstStvAttr(doc, ["meta[property='og:novel:category']"], "content"));
    pushStvGenres(genres, seen, extractStvDetailValue(detailLines, "Thể loại"));
    pushStvGenres(genres, seen, extractStvDetailValue(detailLines, "类别"));

    return genres;
}

function pushStvGenres(genres, seen, rawValue) {
    if (!rawValue) {
        return;
    }

    let parts = String(rawValue).split(/[,;|\/、，]+/);
    for (let i = 0; i < parts.length; i++) {
        let title = safeStvText(parts[i]);
        let key = title.toLowerCase();
        if (!title || seen[key]) {
            continue;
        }

        seen[key] = true;
        genres.push({
            title: title,
            input: title,
            script: "search.js"
        });
    }
}

function resolveCover(doc, text) {
    let directCover = firstStvAttr(doc, ["meta[property='og:image']", "meta[itemprop='image']", "meta[name='thumbnail']"], "content");
    if (isUsableStvCover(directCover)) {
        return normalizeStvImageUrl(directCover);
    }

    // Regex fallback: og:image (xử lý khi CSS [property] selector không hoạt động được)
    let ogMatch = text.match(/<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']+)["']/i) ||
                  text.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:image["']/i);
    if (ogMatch && ogMatch[1] && isUsableStvCover(ogMatch[1])) {
        return normalizeStvImageUrl(ogMatch[1]);
    }

    // Regex fallback: meta name=thumbnail
    let thumbMetaMatch = text.match(/<meta\b[^>]*\bname=["']thumbnail["'][^>]*\bcontent=["']([^"']+)["']/i) ||
                         text.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']thumbnail["']/i);
    if (thumbMetaMatch && thumbMetaMatch[1] && isUsableStvCover(thumbMetaMatch[1])) {
        return normalizeStvImageUrl(thumbMetaMatch[1]);
    }

    let inlineCover = pickStvInlineCover(text, /"thumb"\s*:\s*"([^"]+)"/);
    if (inlineCover) {
        return inlineCover;
    }

    inlineCover = pickStvInlineCover(text, /bookinfo\.thumb\s*=\s*['"](.*?)['"]/);
    if (inlineCover) {
        return inlineCover;
    }

    inlineCover = pickStvInlineCover(text, /var\s+t\s*=\s*['"]([^'"]+)['"]/);
    if (inlineCover) {
        return inlineCover;
    }

    let img = firstStvAttr(doc, ["#thumb-prop", ".container img", ".blk img"], "data-src") || firstStvAttr(doc, ["#thumb-prop", ".container img", ".blk img"], "src");
    if (isUsableStvCover(img)) {
        return normalizeStvImageUrl(img);
    }

    return STV_ORIGIN + "/favicon.png";
}

function pickStvInlineCover(text, pattern) {
    let match = text.match(pattern);
    if (!match || !match[1]) {
        return "";
    }

    let cover = normalizeStvImageUrl(match[1].replace(/\\\//g, "/"));
    return isUsableStvCover(cover) ? cover : "";
}

function isUsableStvCover(url) {
    url = safeStvText(url);
    return !!url && url.toLowerCase().indexOf("favicon") === -1;
}

function executeFqDetail(bookId, stvUrl) {
    let response = fetch("https://fanqienovel.com/page/" + bookId + "?force_mobile=1");
    if (!response.ok) return null;
    let html = response.text();
    let match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    let state;
    try {
        state = JSON.parse(match[1].replace(/:\s*undefined/g, ':null'));
    } catch (e) {
        return null;
    }
    let b = state.page;
    if (!b) return null;

    let score = "";
    try {
        let sr = fetch("https://api5-normal-sinfonlinec.fqnovel.com/reading/user/share/info/v/?group_id=" + bookId + "&aid=1967&version_code=513");
        if (sr.ok) {
            let sj = sr.json();
            if (sj && sj.data && sj.data.book_info) score = sj.data.book_info.score;
        }
    } catch (e) {}

    let genres = [];
    try {
        let cats = JSON.parse(b.categoryV2 || "[]");
        cats.forEach(function(c) {
            genres.push({
                title: c.Name,
                input: "https://fanqienovel.com/api/author/library/book_list/v0/?category_id=" + c.ObjectId + "&book_type=-1&page_count=18&page_index=0",
                script: "gen_fq.js"
            });
        });
    } catch (e) {}

    let ongoing = (b.creationStatus == "1");
    let detailParts = [];
    if (score) detailParts.push("评分: " + score + "分");
    if (b.chapterTotal) detailParts.push("章节数: " + b.chapterTotal);
    if (b.wordNumber) detailParts.push("字数: " + b.wordNumber);
    if (b.readCount) detailParts.push("查看次数: " + b.readCount);
    if (b.lastPublishTime) detailParts.push("更新: " + fqFormatDate(b.lastPublishTime));
    if (b.lastChapterTitle) detailParts.push("最后章节: " + b.lastChapterTitle);

    return Response.success({
        name: b.bookName || "",
        cover: replaceFqCover((b.thumbUrl || "").replace(/\\u002F/g, "/")),
        author: b.author || "",
        description: (b.abstract || "").replace(/\n/g, "<br>"),
        genres: genres,
        detail: detailParts.join("<br>"),
        comment: {
            input: bookId,
            script: "comment.js"
        },
        suggests: [
            {
                title: "Có thể bạn sẽ thích",
                input: bookId,
                script: "suggest_fq.js"
            }
        ],
        ongoing: ongoing,
        url: stvUrl
    });
}

function replaceFqCover(u) {
    if (!u) return null;
    if (u.indexOf("https://") === 0) u = u.substring(8);
    else if (u.indexOf("http://") === 0) u = u.substring(7);
    else return null;
    var parts = u.split("/");
    parts[0] = "https://i0.wp.com/p6-novel.byteimg.com/origin";
    return parts.map(function(x) { return x.split("~")[0].split("?")[0]; }).filter(Boolean).join("/");
}

function fqFormatDate(ts) {
    var d = new Date(ts * 1000);
    var pad = function(n) { return n < 10 ? "0" + n : n; };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}