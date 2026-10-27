// Thuật toán descramble ảnh xáo dải (ReaderScramble) của Dâm Cô Nương (damconuong.win).
// Dựa trên reverse-engineering bookmark.js của web gốc:
// Key dạng x1.<base64url_32bytes>
// Sử dụng HMAC-SHA256 làm PRNG để sinh số ngẫu nhiên xác định:
//   n = 8 + rand(13) dải ngang (8 <= n <= 20)
//   h = floor(height / (16 * n)) * 16 (chiều cao mỗi dải)
//   Fisher-Yates shuffle sinh hoán vị dải perm[0..n-1]
//   Mỗi dải: sy = p * h, dy = perm[p] * h, chiều cao h. Phần thừa ở đuôi giữ nguyên.

function dcnDecodeBase64Url(str) {
    return dcnBytesFromBase64(str);
}

function dcnCreatePrng(keyBytes) {
    var counter = 0;
    var buffer = [];
    var offset = 0;

    return function nextUint32() {
        if (offset >= buffer.length) {
            var counterBytes = [
                (counter >>> 24) & 0xff,
                (counter >>> 16) & 0xff,
                (counter >>> 8) & 0xff,
                counter & 0xff
            ];
            counter++;
            buffer = dcnHmacSha256(keyBytes, counterBytes);
            offset = 0;
        }
        var val = ((buffer[offset] << 24) |
                   (buffer[offset + 1] << 16) |
                   (buffer[offset + 2] << 8) |
                   buffer[offset + 3]) >>> 0;
        offset += 4;
        return val;
    };
}

function dcnRandRange(prng, n) {
    var limit = Math.floor(0x100000000 / n) * n;
    var val = prng();
    while (val >= limit) {
        val = prng();
    }
    return val % n;
}

function dcnGetSlices(key, height) {
    if (!key || key.indexOf("x1.") !== 0) return null;
    var rawKey = key.slice(3);
    var keyBytes = dcnDecodeBase64Url(rawKey);
    if (!keyBytes || keyBytes.length !== 32) return null;
    var prng = dcnCreatePrng(keyBytes);

    var n = 8 + dcnRandRange(prng, 20 - 8 + 1);
    var h = Math.floor(height / (16 * n)) * 16;
    if (h < 16) return null;

    var perm = [];
    for (var i = 0; i < n; i++) perm.push(i);
    for (var j = n - 1; j >= 1; j--) {
        var k = dcnRandRange(prng, j + 1);
        var tmp = perm[j];
        perm[j] = perm[k];
        perm[k] = tmp;
    }

    // Format slice: [sx, sy, sw, sh, dx, dy, dw, dh]
    // sw và dw sẽ được gán bằng imgWidth trong image.js
    var slices = [];
    var totalH = n * h;
    for (var p = 0; p < n; p++) {
        slices.push([
            0, p * h, 0, h,
            0, perm[p] * h, 0, h
        ]);
    }
    if (height > totalH) {
        slices.push([
            0, totalH, 0, height - totalH,
            0, totalH, 0, height - totalH
        ]);
    }

    return slices;
}

if (typeof module !== "undefined") {
    module.exports = {
        dcnGetSlices: dcnGetSlices
    };
}
