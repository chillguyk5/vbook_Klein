load("config.js");

function execute(url) {
    let meta = parseStvUrl(url);
    if (!meta) {
        return null;
    }

    let payload = tryFetchTocPayload(meta);
    if (!payload) {
        return Response.error("Không tải được mục lục Sáng Tác Việt.");
    }

    let json;
    try {
        json = JSON.parse(payload);
    } catch (error) {
        return Response.error("Không đọc được dữ liệu mục lục Sáng Tác Việt.");
    }

    if (!json || String(json.code) !== "1" || !json.data) {
        return Response.error("Không đọc được dữ liệu mục lục Sáng Tác Việt.");
    }

    let chapters = parseStvChapterList(json.oridata || json.data);
    if (!chapters.length) {
        return Response.error("Không tìm thấy chương nào trong mục lục Sáng Tác Việt.");
    }

    let list = [];
    for (let i = 0; i < chapters.length; i++) {
        let chapter = chapters[i];
        list.push({
            name: chapter.name,
            url: buildStvChapterUrl(meta, chapter.chapterId),
            pay: chapter.pay,
            host: STV_ORIGIN
        });
    }

    return Response.success(list);
}

function tryFetchTocPayload(meta) {
    // Lv1: desktop UA + Referer — server kiểm tra Referer để xác thực request
    let payload = tryFetchTocDirect(meta, false);
    if (payload) return payload;

    // Lv2: force=true — xóa cache server, bắt tính lại danh sách chương
    payload = tryFetchTocDirect(meta, true);
    if (payload) return payload;

    // Lv3: browser XHR inject — browser tự gửi Referer đúng từ trang sách
    return tryFetchTocByBrowser(meta);
}

function tryFetchTocDirect(meta, force) {
    try {
        let endpoint = buildStvTocEndpoint(meta) + (force ? "&force=true" : "");
        let response = fetch(endpoint, { headers: getStvTocHeaders(meta) });
        if (!response.ok) return "";
        let text = response.text();
        return isValidTocPayload(text) ? text : "";
    } catch (error) {
        return "";
    }
}

function tryFetchTocByBrowser(meta) {
    let browser = Engine.newBrowser();
    try {
        if (browser.setUserAgent) {
            browser.setUserAgent(STV_DESKTOP_UA);
        }

        browser.launchAsync(buildStvBookUrl(meta));
        sleep(1200);
        browser.callJs(buildInjectedTocXhr(meta), 3000);

        let doc = browser.html();
        let node = doc.select("#vbook-stv-toc-xhr");
        let text = node && node.length > 0 ? node.first().text() : "";
        return isValidTocPayload(text) ? text : "";
    } catch (error) {
        return "";
    } finally {
        browser.close();
    }
}

function buildInjectedTocXhr(meta) {
    let endpoint = buildStvTocEndpoint(meta).replace(/'/g, "\\'");
    return "(function(){var n=document.getElementById('vbook-stv-toc-xhr');if(!n){n=document.createElement('div');n.id='vbook-stv-toc-xhr';n.style.display='none';document.body.appendChild(n);}var xhr=new XMLHttpRequest();xhr.open('GET','" + endpoint + "',true);xhr.onreadystatechange=function(){if(xhr.readyState===4){n.textContent=xhr.responseText||'';}};xhr.send();})();";
}

function isValidTocPayload(text) {
    if (!text) {
        return false;
    }

    return text.indexOf('"code"') >= 0 && text.indexOf('"data"') >= 0;
}
