const fs = require('fs');
let text = fs.readFileSync('src/chap.js', 'utf8');

// remove readStvBrowserLlmProbeState
text = text.replace(/function readStvBrowserLlmProbeState[\s\S]+?return null;\r?\n}/, '');

// remove buildInjectedStvLlmProbe
text = text.replace(/function buildInjectedStvLlmProbe[\s\S]+?\}\)\(\)';\r?\n}/, '');

// update tryFetchStvChapterByBrowserWithUserAgent
let newFunc = `function tryFetchStvChapterByBrowserWithUserAgent(meta, userAgent, transmode) {
    let browser = Engine.newBrowser();
    let content = "";
    let retriedLoad = false;
    let maxRetries = 2;
    let delay = 700;
    let chapterCookie = buildStvChapterCookie(transmode, captureStvSessionCookie(meta, userAgent));

    try {
        if (browser.setUserAgent) {
            browser.setUserAgent(userAgent);
        }

        browser.launchAsync(buildStvChapterUrl(meta, meta.chapterId));
        browser.callJs(buildStvBrowserCookieScript(transmode, chapterCookie), 300);

        for (let retry = 0; retry < maxRetries; retry++) {
            sleep(delay);
            let doc = browser.html();
            content = extractStvChapterHtml(doc, meta);
            if (content) {
                break;
            }

            if (retry === 0 && !retriedLoad) {
                browser.callJs("if (typeof gotox === 'function') { gotox(); }", 400);
                retriedLoad = true;
            }
        }
    } catch (error) {
        traceStvChap("BROWSER_EXCEPTION", safeStvText(error && error.message ? error.message : String(error)));
    } finally {
        try {
            if (browser && typeof browser.close === "function") {
                browser.close();
            }
        } catch (error) {
        }
    }

    return content;
}`;

text = text.replace(/function tryFetchStvChapterByBrowserWithUserAgent[\s\S]+?return content;\r?\n}/, newFunc);

// explainStvChapterFailure
text = text.replace(/function explainStvChapterFailure[\s\S]+?return message;\r?\n}/, `function explainStvChapterFailure(meta, transmode) {
    let message = "Không tải được nội dung chương từ Sáng Tác Việt.";
    let isVip = STV_CHAP_TRACE.join(" ").indexOf("userinfo code=400") > 0;
    
    if (isVip) {
        message = "Chương này có thể yêu cầu VIP hoặc đăng nhập (Code 400).";
    }

    return message;
}`);

fs.writeFileSync('src/chap.js', text);
console.log('Done cleaning chap.js');
