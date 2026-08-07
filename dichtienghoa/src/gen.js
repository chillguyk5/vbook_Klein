load("config.js");

function mapItem(item) {
    if (!item) return null;
    var id = item.id;
    if (id == null) return null;
    var name = storyTitle(item);
    if (!name && item.title) name = String(item.title).trim();
    var cover = item.imgUrl || item.img || item.cover || "";
    var desc = item.authorName || authorName(item);
    if (item.categoryNames) {
        var cats = Array.isArray(item.categoryNames)
            ? item.categoryNames.join(", ")
            : String(item.categoryNames);
        if (cats) desc = desc && desc !== "N/A" ? (desc + " · " + cats) : cats;
    }
    return {
        name: name,
        link: BASE_URL + "/truyen/" + id,
        cover: cover,
        description: desc || "",
        host: BASE_URL
    };
}

function mapList(arr) {
    var data = [];
    if (!arr || !arr.length) return data;
    for (var i = 0; i < arr.length; i++) {
        var m = mapItem(arr[i]);
        if (m) data.push(m);
    }
    return data;
}

function parseInput(url) {
    var s = String(url || "");
    if (s.indexOf("home:recent") === 0) return { mode: "home", section: "recent" };
    if (s.indexOf("home:completed") === 0) return { mode: "home", section: "completed" };
    if (s.indexOf("rank:") === 0) {
        return { mode: "rank", section: s.split(":")[1] || "monthly" };
    }
    if (s.indexOf("story:") === 0) {
        return { mode: "story", sort: s.split(":")[1] || "updatedAt" };
    }
    if (s.indexOf("xep-hang") !== -1) return { mode: "rank", section: "monthly" };
    if (s.indexOf("status=completed") !== -1) return { mode: "home", section: "completed" };
    if (s.indexOf("sort=createdAt") !== -1) return { mode: "story", sort: "createdAt" };
    if (s.indexOf("sort=views") !== -1) return { mode: "story", sort: "views" };
    if (s.indexOf("sort=likes") !== -1) return { mode: "story", sort: "likes" };
    if (s.indexOf("category=") !== -1) {
        var category = s.split("category=")[1].split("&")[0];
        return { mode: "story", sort: "updatedAt", category: category };
    }
    return { mode: "home", section: "recent" };
}

function fromHomeBootstrap(section) {
    var res = apiFetch("/api/home/bootstrap", { referer: BASE_URL + "/" });
    if (!res || !res.ok) return null;
    var json = parseJson(res);
    var root = (json && json.data) ? json.data : json;
    if (!root) return null;
    var block = root[section];
    var arr = [];
    if (block && block.data && Array.isArray(block.data)) arr = block.data;
    else if (Array.isArray(block)) arr = block;
    return Response.success(mapList(arr), null);
}

function fromRankingBootstrap(section) {
    var res = apiFetch("/api/ranking/bootstrap", { referer: BASE_URL + "/xep-hang" });
    if (!res || !res.ok) return null;
    var json = parseJson(res);
    var root = (json && json.data) ? json.data : json;
    if (!root || !root.rankings) return null;
    var arr = root.rankings[section] || root.rankings.monthly || [];
    return Response.success(mapList(arr), null);
}

function fromStoryApi(opt, page) {
    var qs = "page=" + encodeURIComponent(page) + "&pageSize=48";
    if (opt.sort === "createdAt") qs += "&sort=createdAt:desc";
    else if (opt.sort === "views") qs += "&sort=views:desc";
    else if (opt.sort === "likes") qs += "&sort=likes:desc";
    else if (opt.sort === "completed") qs += "&sort=updatedAt:desc&status=completed";
    else qs += "&sort=updatedAt:desc";

    if (opt.category) qs += "&categories=" + encodeURIComponent(opt.category);

    var res = apiFetch("/api/models/story?" + qs);
    if (!res || !res.ok) return null;
    var json = parseJson(res);
    if (!json || !json.data) return Response.success([], null);

    var data = mapList(json.data);
    var hasMore = false;
    if (json.pagination) {
        hasMore = json.pagination.hasMore === true ||
            (json.pagination.totalPages != null && parseInt(page) < json.pagination.totalPages);
    } else {
        hasMore = json.data.length >= 40;
    }
    return Response.success(data, hasMore ? String(parseInt(page) + 1) : null);
}

function execute(url, page) {
    if (!page) page = "1";
    loginIfNeeded();

    var opt = parseInput(url);

    if (opt.mode === "home") {
        var homeRes = fromHomeBootstrap(opt.section);
        if (homeRes) return homeRes;
        if (opt.section === "completed") return fromStoryApi({ sort: "completed" }, page);
        return fromStoryApi({ sort: "updatedAt" }, page);
    }

    if (opt.mode === "rank") {
        var rankRes = fromRankingBootstrap(opt.section);
        if (rankRes) return rankRes;
        return fromStoryApi({ sort: "likes" }, page);
    }

    return fromStoryApi(opt, page);
}
