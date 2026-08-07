load("config.js");

function execute() {
    loginIfNeeded();

    var list = [{ title: "Tất cả", input: BASE_URL + "/tim-kiem", script: "gen.js" }];
    var res = apiFetch("/api/models/category?pageSize=100");
    var json = parseJson(res);
    var cats = (json && json.data) ? json.data : [];

    for (var i = 0; i < cats.length; i++) {
        var c = cats[i];
        if (!c || !c.id) continue;
        var name = String(c.name || "");
        if (!name || name.indexOf("__") === 0) continue;
        var title = c.nameChinese ? (name + " / " + c.nameChinese) : name;
        list.push({
            title: title,
            input: BASE_URL + "/?category=" + c.id,
            script: "gen.js"
        });
    }

    return Response.success(list);
}
