const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

function stv_md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                text: () => data
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    let grantUrl = 'https://dns1.stv-appdomain-00000001.org/io/grantcontext/context?hostid=qidian&bookid=1047325017';
    let res = await fetch(grantUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    let code = res.text();
    let keyMatch = code.match(/chapterkey\s*[:=]\s*[\"']([A-Za-z0-9_\-=+\/]+)[\"']/i);
    if (!keyMatch) return console.log('No static key in grant context!');
    let key = keyMatch[1];
    
    let parts = ('bookid=1047325017&c=875301696&h=qidian&key=' + key + '&sajax=readchapter').split('&').sort();
    let sign = stv_md5(parts.join('&') + '&' + 'erogh982^%*%^*');
    let readUrl = 'https://dns1.stv-appdomain-00000001.org/index.php?' + parts.join('&');
    let setCookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '';
    let cookie = setCookie ? setCookie.split(';')[0] : '';
    
    console.log("Fetching: " + readUrl);
    let res2 = await fetch(readUrl, {
        headers: {
            'X-STV-Sign': sign,
            'User-Agent': 'Mozilla/5.0',
            'Cookie': cookie
        }
    });
    console.log(res2.text());
})();
