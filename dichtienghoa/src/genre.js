load("config.js");

function execute() {
    var res = apiFetch("/api/models/category?pageSize=100");
    var json = parseJson(res);
    var cats = (json && json.data) || [];
    var list = [{ title: "Tất cả", input: "story:updatedAt", script: "gen.js" }];

    for (var i = 0; i < cats.length; i++) {
        var c = cats[i];
        if (!c || !c.id) continue;
        var name = c.name || "";
        if (!name || name.charAt(0) === "_") continue;
        list.push({
            title: c.nameChinese ? (name + " / " + c.nameChinese) : name,
            input: BASE_URL + "/?category=" + c.id,
            script: "gen.js"
        });
    }

    return Response.success(list);
}
