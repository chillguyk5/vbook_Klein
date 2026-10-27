// DcnCipher — crypto thuần ES5 cho cơ chế phân phối ảnh cipher của Dâm Cô Nương.
// Thuật toán (đã đối chiếu với decoder của site):
//   token  = b64url([0x01] + HMAC-SHA256(HMAC-SHA256(secret,"tok"), path)[0..15])
//   aesKey = HMAC-SHA256(HMAC-SHA256(secret,"enc"), token)
//   payload{e} = b64url(IV(12) || ciphertext || tag(16)), AES-256-GCM, AAD = path
// Response giải mã: JSON {p:[url...], s:[key...]}

var DCN_SECRET_B64 = "YVdGuT8RjDWkeQjt7s7mv53smMpLrcKBuGMs8erg8Bs";
var DCN_B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function dcnBytesFromBase64(input) {
    var clean = String(input).replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = [];
    var acc = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
        var idx = alphabet.indexOf(clean.charAt(i));
        if (idx < 0) break;
        acc = ((acc << 6) | idx) >>> 0;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((acc >>> bits) & 0xff);
        }
    }
    return out;
}

function dcnBytesToBase64Url(bytes) {
    var out = "";
    var acc = 0, bits = 0;
    for (var i = 0; i < bytes.length; i++) {
        acc = ((acc << 8) | (bytes[i] & 0xff)) >>> 0;
        bits += 8;
        while (bits >= 6) {
            bits -= 6;
            out += DCN_B64URL.charAt((acc >>> bits) & 0x3f);
        }
    }
    if (bits > 0) {
        out += DCN_B64URL.charAt((acc << (6 - bits)) & 0x3f);
    }
    return out;
}

function dcnUtf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        } else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
            var c2 = str.charCodeAt(++i);
            var cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }
    return out;
}

function dcnBytesToUtf8(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
        var b = bytes[i];
        var cp;
        if (b < 0x80) {
            cp = b; i += 1;
        } else if (b < 0xe0) {
            cp = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2;
        } else if (b < 0xf0) {
            cp = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3;
        } else {
            cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4;
        }
        if (cp < 0x10000) {
            out += String.fromCharCode(cp);
        } else {
            cp -= 0x10000;
            out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        }
    }
    return out;
}

// ===== SHA-256 =====
var DCN_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function dcnSha256(msgBytes) {
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var len = msgBytes.length;
    var bitLenHi = Math.floor(len / 0x20000000);
    var bitLenLo = (len << 3) >>> 0;
    var padded = msgBytes.slice(0);
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    padded.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff);
    padded.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff);

    var w = new Array(64);
    for (var off = 0; off < padded.length; off += 64) {
        for (var t = 0; t < 16; t++) {
            w[t] = ((padded[off + t * 4] << 24) | (padded[off + t * 4 + 1] << 16) |
                    (padded[off + t * 4 + 2] << 8) | padded[off + t * 4 + 3]) >>> 0;
        }
        for (var t2 = 16; t2 < 64; t2++) {
            var s0 = ((w[t2 - 15] >>> 7) | (w[t2 - 15] << 25)) ^ ((w[t2 - 15] >>> 18) | (w[t2 - 15] << 14)) ^ (w[t2 - 15] >>> 3);
            var s1 = ((w[t2 - 2] >>> 17) | (w[t2 - 2] << 15)) ^ ((w[t2 - 2] >>> 19) | (w[t2 - 2] << 13)) ^ (w[t2 - 2] >>> 10);
            w[t2] = (w[t2 - 16] + (s0 >>> 0) + w[t2 - 7] + (s1 >>> 0)) >>> 0;
            w[t2] = w[t2] >>> 0;
        }
        var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
        for (var t3 = 0; t3 < 64; t3++) {
            var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            var ch = (e & f) ^ (~e & g);
            var temp1 = (hh + S1 + ch + DCN_K[t3] + w[t3]) >>> 0;
            var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            var maj = (a & b) ^ (a & c) ^ (b & c);
            var temp2 = (S0 + maj) >>> 0;
            hh = g; g = f; f = e;
            e = (d + temp1) >>> 0;
            d = c; c = b; b = a;
            a = (temp1 + temp2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7];
}

function dcnWordsToBytes(words) {
    var out = [];
    for (var i = 0; i < words.length; i++) {
        out.push((words[i] >>> 24) & 0xff, (words[i] >>> 16) & 0xff, (words[i] >>> 8) & 0xff, words[i] & 0xff);
    }
    return out;
}

function dcnHmacSha256(keyBytes, msgBytes) {
    var block = 64;
    var k = keyBytes.slice(0);
    if (k.length > block) {
        k = dcnWordsToBytes(dcnSha256(k));
    }
    while (k.length < block) k.push(0);
    var ipad = [], opad = [];
    for (var i = 0; i < block; i++) {
        ipad.push(k[i] ^ 0x36);
        opad.push(k[i] ^ 0x5c);
    }
    var inner = dcnWordsToBytes(dcnSha256(ipad.concat(msgBytes)));
    return dcnWordsToBytes(dcnSha256(opad.concat(inner)));
}

// ===== AES-256 (chỉ cần mã hóa xuôi cho GCM) =====
var DCN_SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

function dcnXtime(a) {
    var h = a & 0x80 ? 0x1b : 0;
    return ((a << 1) ^ h) & 0xff;
}

function dcnAes256Expand(keyBytes) {
    // 60 words, mỗi word = 4 byte (mảng phẳng 240 byte)
    var w = keyBytes.slice(0, 32);
    var rcon = 0x01;
    while (w.length < 240) {
        var base = w.length - 32; // vị trí word w[i-8] (tham chiếu cố định)
        var last = w.slice(w.length - 4);
        if (w.length % 32 === 0) {
            var t = [last[1], last[2], last[3], last[0]];
            for (var i = 0; i < 4; i++) t[i] = DCN_SBOX[t[i]];
            t[0] ^= rcon;
            rcon = dcnXtime(rcon);
            for (var j = 0; j < 4; j++) w.push((w[base + j] ^ t[j]) & 0xff);
        } else if (w.length % 32 === 16) {
            for (var k = 0; k < 4; k++) {
                var s = DCN_SBOX[last[k]];
                w.push((w[base + k] ^ s) & 0xff);
            }
        } else {
            for (var m = 0; m < 4; m++) {
                w.push((w[base + m] ^ last[m]) & 0xff);
            }
        }
    }
    return w;
}

function dcnAes256EncryptBlock(w, block) {
    var s = block.slice(0, 16);
    var r, c;
    // AddRoundKey 0
    for (c = 0; c < 16; c++) s[c] ^= w[c];
    for (r = 1; r <= 14; r++) {
        // SubBytes + ShiftRows (state cột-major: byte i = hàng i%4, cột i/4)
        var t = new Array(16);
        for (c = 0; c < 16; c++) t[c] = DCN_SBOX[s[c]];
        var u = new Array(16);
        for (var row = 0; row < 4; row++) {
            for (var col = 0; col < 4; col++) {
                u[row + 4 * col] = t[row + 4 * ((col + row) % 4)];
            }
        }
        for (c = 0; c < 16; c++) s[c] = u[c];
        // MixColumns (bỏ qua ở vòng cuối)
        if (r < 14) {
            for (var col = 0; col < 4; col++) {
                var a0 = s[col * 4], a1 = s[col * 4 + 1], a2 = s[col * 4 + 2], a3 = s[col * 4 + 3];
                var x0 = dcnXtime(a0) ^ (a1 ^ dcnXtime(a1)) ^ a2 ^ a3;
                var x1 = a0 ^ dcnXtime(a1) ^ (a2 ^ dcnXtime(a2)) ^ a3;
                var x2 = a0 ^ a1 ^ dcnXtime(a2) ^ (a3 ^ dcnXtime(a3));
                var x3 = (a0 ^ dcnXtime(a0)) ^ a1 ^ a2 ^ dcnXtime(a3);
                s[col * 4] = x0; s[col * 4 + 1] = x1; s[col * 4 + 2] = x2; s[col * 4 + 3] = x3;
            }
        }
        for (c = 0; c < 16; c++) s[c] ^= w[r * 16 + c];
    }
    return s;
}

// ===== GCM =====
function dcnGfMult(x, y) {
    // x, y: mảng 16 byte (bit MSB-first)
    var z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var v = y.slice(0, 16);
    for (var i = 0; i < 128; i++) {
        if ((x[i >> 3] >> (7 - (i & 7))) & 1) {
            for (var b = 0; b < 16; b++) z[b] ^= v[b];
        }
        var lsb = v[15] & 1;
        for (var s = 15; s > 0; s--) {
            v[s] = ((v[s] >>> 1) | (v[s - 1] << 7)) & 0xff;
        }
        v[0] = v[0] >>> 1;
        if (lsb) v[0] ^= 0xe1;
    }
    return z;
}

function dcnInc32(counter) {
    var out = counter.slice(0, 16);
    var v = ((out[12] << 24) | (out[13] << 16) | (out[14] << 8) | out[15]) >>> 0;
    v = (v + 1) >>> 0;
    out[12] = (v >>> 24) & 0xff; out[13] = (v >>> 16) & 0xff; out[14] = (v >>> 8) & 0xff; out[15] = v & 0xff;
    return out;
}

function dcnAesGcmDecrypt(w, iv, ct, aad, tag) {
    var h = dcnAes256EncryptBlock(w, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    var j0 = iv.slice(0, 16);
    j0[12] = 0; j0[13] = 0; j0[14] = 0; j0[15] = 1; // IV 96-bit

    // GHASH(aad || pad, ct || pad, lenBlock)
    function padTo16(list) {
        while (list.length % 16 !== 0) list.push(0);
        return list;
    }
    var aadPad = padTo16(aad.slice(0));
    var ctPad = padTo16(ct.slice(0));
    var aadBits = aad.length * 8, ctBits = ct.length * 8;
    // 64-bit big-endian length: 8 byte cho AAD + 8 byte cho ciphertext
    var hi = Math.floor(aadBits / 0x100000000);
    var lo = aadBits >>> 0;
    var ctHi = Math.floor(ctBits / 0x100000000);
    var ctLo = ctBits >>> 0;
    var lenBlock = [
        (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
        (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
        (ctHi >>> 24) & 0xff, (ctHi >>> 16) & 0xff, (ctHi >>> 8) & 0xff, ctHi & 0xff,
        (ctLo >>> 24) & 0xff, (ctLo >>> 16) & 0xff, (ctLo >>> 8) & 0xff, ctLo & 0xff
    ];

    var y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var all = aadPad.concat(ctPad).concat(lenBlock);
    for (var b = 0; b < all.length; b += 16) {
        var blk = all.slice(b, b + 16);
        for (var i2 = 0; i2 < 16; i2++) blk[i2] ^= y[i2];
        y = dcnGfMult(blk, h);
    }

    // Tag = GHASH XOR E(K, J0)
    var ej0 = dcnAes256EncryptBlock(w, j0);
    var computed = [];
    for (var t = 0; t < 16; t++) computed.push(y[t] ^ ej0[t]);
    for (var v2 = 0; v2 < 16; v2++) {
        if (computed[v2] !== (tag[v2] & 0xff)) return null; // sai auth
    }

    // CTR decrypt: counter bắt đầu J0+1
    var plain = [];
    var counter = dcnInc32(j0);
    for (var off = 0; off < ct.length; off += 16) {
        var ks = dcnAes256EncryptBlock(w, counter);
        var n = Math.min(16, ct.length - off);
        for (var k2 = 0; k2 < n; k2++) plain.push(ct[off + k2] ^ ks[k2]);
        counter = dcnInc32(counter);
    }
    return plain;
}

// ===== API công khai =====
var DcnCipher = (function () {
    var secretBytes = dcnBytesFromBase64(DCN_SECRET_B64);
    var hmacTok = null;
    var hmacEnc = null;

    function ensureKeys() {
        if (!hmacTok) {
            hmacTok = dcnHmacSha256(secretBytes, dcnUtf8Bytes("tok"));
            hmacEnc = dcnHmacSha256(secretBytes, dcnUtf8Bytes("enc"));
        }
    }

    return {
        makeToken: function (path) {
            ensureKeys();
            var mac = dcnHmacSha256(hmacTok, dcnUtf8Bytes(path)).slice(0, 16);
            var payload = [1].concat(mac);
            return dcnBytesToBase64Url(payload);
        },
        // Trả về {p:[url...], s:[key...]} hoặc null nếu auth/decrypt lỗi
        decryptPayload: function (path, token, eB64) {
            ensureKeys();
            if (!eB64) return null;
            var data = dcnBytesFromBase64(eB64);
            if (data.length < 12 + 16) return null;
            var iv = data.slice(0, 12);
            var tag = data.slice(data.length - 16);
            var ct = data.slice(12, data.length - 16);
            var key = dcnHmacSha256(hmacEnc, dcnUtf8Bytes(token));
            var w = dcnAes256Expand(key);
            var plain = dcnAesGcmDecrypt(w, iv, ct, dcnUtf8Bytes(path), tag);
            if (!plain) return null;
            try {
                return JSON.parse(dcnBytesToUtf8(plain));
            } catch (e) {
                return null;
            }
        }
    };
})();
