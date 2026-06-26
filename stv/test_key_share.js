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
    
    console.log("=== Tài khoản A lấy Key ===");
    let resA = await fetch(grantUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    let codeA = resA.text();
    let keyMatch = codeA.match(/chapterkey\s*[:=]\s*[\"']([A-Za-z0-9_\-=+\/]+)[\"']/i);
    if (!keyMatch) return console.log('Không tìm thấy key trong grant context của A!');
    let keyA = keyMatch[1];
    
    let setCookieA = resA.headers['set-cookie'] ? resA.headers['set-cookie'][0] : '';
    let cookieA = setCookieA ? setCookieA.split(';')[0] : '';
    console.log('Key A:', keyA);
    console.log('Cookie A:', cookieA);
    
    // Tạo request đọc chương
    let parts = ('bookid=1047325017&c=875301696&h=qidian&key=' + keyA + '&sajax=readchapter').split('&').sort();
    let sign = stv_md5(parts.join('&') + '&' + 'erogh982^%*%^*');
    let readUrl = 'https://dns1.stv-appdomain-00000001.org/index.php?' + parts.join('&');
    
    console.log("\n=== Tài khoản B dùng Key A nhưng không có Cookie A (hoặc Cookie B) ===");
    console.log("Fetching: " + readUrl);
    let resB = await fetch(readUrl, {
        headers: {
            'X-STV-Sign': sign,
            'User-Agent': 'Mozilla/5.0'
            // Không truyền Cookie A vào đây để giả lập Tài khoản B
        }
    });
    
    let textB = resB.text();
    console.log("Status B:", resB.status);
    console.log("Response B (đoạn đầu):", textB.substring(0, 200));

    console.log("\n=== Tài khoản A tự dùng Key A + Cookie A ===");
    let resA2 = await fetch(readUrl, {
        headers: {
            'X-STV-Sign': sign,
            'User-Agent': 'Mozilla/5.0',
            'Cookie': cookieA
        }
    });
    let textA2 = resA2.text();
    console.log("Status A:", resA2.status);
    console.log("Response A (đoạn đầu):", textA2.substring(0, 200));

})();
