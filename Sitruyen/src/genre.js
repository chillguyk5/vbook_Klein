var API = "https://api.sitruyencv.com";
var HOST = "https://sitruyencv.com";

function apiHeaders() {
    return {
        "accept": "application/json, text/plain, */*",
        "origin": HOST,
        "referer": HOST + "/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
}

function parseJson(res) {
    if (!res) return null;
    try {
        if (typeof res.json === "function") {
            var j = res.json();
            if (j) return j;
        }
    } catch (e) {}
    try {
        var t = res.text();
        if (t) return JSON.parse(t);
    } catch (e2) {}
    return null;
}

function execute() {
    var list = [];

    list.push({ title: "Convert", input: HOST + "/type/Convert", script: "gen.js" });
    list.push({ title: "Dịch", input: HOST + "/type/Dich", script: "gen.js" });

    var res = fetch(API + "/api/categories?page=1&limit=100", {
        headers: apiHeaders()
    });
    if (res && res.ok) {
        var json = parseJson(res);
        var items = [];
        if (json && json.data && json.data.items) items = json.data.items;
        else if (json && Array.isArray(json.data)) items = json.data;

        items.sort(function (a, b) {
            var na = (a && a.name) ? a.name : "";
            var nb = (b && b.name) ? b.name : "";
            return na.localeCompare ? na.localeCompare(nb, "vi") : (na > nb ? 1 : na < nb ? -1 : 0);
        });

        for (var i = 0; i < items.length; i++) {
            var c = items[i];
            if (!c || !c.id) continue;
            var name = c.name || c.slug || String(c.id);
            var count = c.story_count != null ? " (" + c.story_count + ")" : "";
            list.push({
                title: name + count,
                input: HOST + "/category/" + c.id,
                script: "gen.js"
            });
        }
    }

    if (list.length <= 2) {
        var fallback = [
            { id: 1, name: "Đô Thị" },
            { id: 2, name: "Tiên Hiệp" },
            { id: 3, name: "Khoa Huyễn" },
            { id: 4, name: "Huyền Huyễn" },
            { id: 5, name: "Võng Du" },
            { id: 6, name: "Đồng Nhân" },
            { id: 7, name: "Dã Sử" },
            { id: 9, name: "Huyền Nghi" },
            { id: 10, name: "Kiếm Hiệp" },
            { id: 13, name: "Hệ Thống" },
            { id: 32, name: "Ngôn Tình" },
            { id: 39, name: "Hiện Đại Ngôn Tình" },
            { id: 42, name: "Cổ Đại Ngôn Tình" }
        ];
        for (var j = 0; j < fallback.length; j++) {
            list.push({
                title: fallback[j].name,
                input: HOST + "/category/" + fallback[j].id,
                script: "gen.js"
            });
        }
    }

    return Response.success(list);
}
