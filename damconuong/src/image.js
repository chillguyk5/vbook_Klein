load('config.js');
load('dcn-crypto.js');
load('dcn-decoder.js');

function execute(url) {
    var parts = url.split(" ");
    var imgUrl = parts[0];
    var meta = parts[1]; // có thể là JSON slices hoặc key scramble "x1.*"

    var response = dcnFetch(imgUrl);
    if (!response || !response.ok) return null;

    var imageb64 = response.base64();
    var image = Graphics.createImage(imageb64);
    if (!image) return null;

    var imgWidth = image.width;
    var imgHeight = image.height;

    // Nếu không có thông tin giải mã thì trả về ảnh nguyên bản
    if (!meta) {
        return image;
    }

    var slices = null;
    try {
        if (meta.indexOf("x1.") === 0) {
            // meta là key scramble, tính slices từ chiều cao ảnh
            slices = dcnGetSlices(meta, imgHeight);
        } else if (meta.indexOf("[") === 0) {
            // meta là mảng slices JSON đã tính sẵn
            slices = JSON.parse(meta);
        }
    } catch (e) {
        slices = null;
    }

    if (!slices || !slices.length) {
        return image;
    }

    var canvas = Graphics.createCanvas(imgWidth, imgHeight);

    for (var i = 0; i < slices.length; i++) {
        var part = slices[i];
        var sx = part[0];
        var sy = part[1];
        var sHeight = part[3];
        var dx = part[4];
        var dy = part[5];
        var dHeight = part[7];
        canvas.drawImage(image, sx, sy, imgWidth, sHeight, dx, dy, imgWidth, dHeight);
    }

    return canvas.capture();
}
