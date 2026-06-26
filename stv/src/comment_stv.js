load("config.js");

function execute(input, page) {
    if (!page) page = "1";
    var pageNumber = parseInt(page, 10);
    var start = (pageNumber - 1) * 10;
    
    var url = input.replace(/&start=\d+/, "&start=" + start);
    var response = fetch(url, { headers: getStvHeaders() });
    if (!response.ok) return null;
    
    var json = response.json();
    if (!json || String(json.code) !== "100" || !json.list) return null;
    
    var comments = [];
    json.list.forEach(function(item) {
        var name = item.name || item.nickname || "Ẩn danh";
        var time = item.time || item.createdAt || "";
        var content = (item.content || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n/g, "<br>");
        
        var replies = item.reply || [];
        if (replies.length > 0) {
            content += "<br><br>— Phản hồi —";
            replies.forEach(function(reply) {
                var rName = reply.name || reply.nickname || "Ẩn danh";
                var rContent = (reply.content || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n/g, "<br>");
                content += "<br>↳ [" + rName + "] " + rContent;
            });
        }
        
        comments.push({
            name: protect(name),
            content: protect(content),
            description: protect(time)
        });
    });
    
    var next = json.list.length >= 10 ? String(pageNumber + 1) : "";
    return Response.success(comments, next);
}

function protect(text) {
    if (!text) return text;
    var result = '';
    var inTag = false;
    for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (c === '<') inTag = true;
        result += c;
        if (c === '>') inTag = false;
        else if (!inTag && c.trim() !== '') {
            result += '\u200B';
        }
    }
    return result;
}
