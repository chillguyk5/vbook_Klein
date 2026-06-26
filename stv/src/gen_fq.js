load("config.js");

// Fetch danh sách sách từ fanqienovel.com API (nguồn fanqie trên STV)
function execute(url, page) {
    if (!page) page = "0";

    let targetUrl = url.replace("page_index=0", "page_index=" + page);
    let response = fetch(targetUrl);
    if (!response.ok) return null;

    let json = response.json();
    if (!json || json.code !== 0 || !json.data) return null;

    let rows = json.data.book_list || json.data.publication_list || [];
    let items = [];

    rows.forEach(function(e) {
        let bookId = String(e.book_id || "");
        if (!bookId) return;
        items.push({
            name: fqDecode(e.book_name || ""),
            link: STV_ORIGIN + "/truyen/fanqie/1/" + bookId + "/",
            cover: buildFqCoverUrl(e.thumb_url),
            description: fqDecode(e.author || ""),
            host: STV_ORIGIN
        });
    });

    let next = items.length > 0 ? String(parseInt(page, 10) + 1) : "";
    return Response.success(items, next);
}

// Fanqienovel dùng mã hóa shift cipher cho title/author — decode theo fq3
var FQ_DECODE_TABLE = ['体', 'y', '十', '现', '快', '便', '话', '却', '月', '物', '水', '的', '放', '知', '爱', '万', '?', '表', '风', '理', 'O', '老', '也', 'p', '常', '克', '平', '几', '最', '主', '她', 's', '将', '法', '情', 'o', '光', 'a', '我', '呢', 'J', '员', '太', '每', '望', '受', '教', 'w', '利', '军', '已', 'U', '人', '如', '变', '得', '要', '少', '斯', '门', '电', 'm', '男', '没', 'A', 'K', '国', '时', '中', '走', '么', '何', '口', '小', '向', '问', '轻', 'T', 'd', '神', '下', '间', '车', 'f', 'G', '度', 'D', '又', '大', '面', '远', '就', '写', 'j', '给', '通', '起', '实', 'E', '?', '它', '去', 'S', '到', '道', '数', '吃', '们', '加', 'P', '是', '无', '把', '事', '西', '多', '界', '?', '发', '新', '外', '活', '解', '孩', '只', '作', '前', 'Y', '尔', '经', '?', 'u', '心', '告', '父', '等', 'Q', '民', '全', '这', '9', '果', '安', '?', 'i', '母', '8', 'r', '说', '任', '先', '和', '地', 'C', '张', '战', '场', 'g', '像', 'c', 'q', '你', '使', '?', '样', '总', '目', 'x', '性', '处', '音', '头', '?', '应', '乐', '关', '能', '花', 'l', '当', '名', '手', '4', '重', '字', '声', '力', '友', '然', '生', '代', '内', '里', '本', '回', '真', '入', '师', '象', '?', '0', '点', 'R', '亲', 'V', '种', '动', '英', '命', 'Z', 'h', 'X', '做', '特', '边', '高', '有', 'B', '为', '期', '自', '年', '马', '认', '出', '接', '至', 'H', '正', '方', '感', '所', '明', '者', '稜', 'F', '住', '学', '还', '分', '意', '更', '其', 'n', '但', '比', '觉', '以', '由', '死', '家', '让', '失', '士', 'L', '2', 'I', '金', '叫', '身', '报', '听', 'w', '再', '原', '山', '海', '白', '很', '见', '5', '直', '位', '第', '工', '个', '开', '岁', '好', '用', '都', '于', '可', '同', '3', '次', '四', '?', '日', '信', '与', '女', '笑', '满', '并', '部', '什', '不', '从', '或', '机', '此', '?', '了', '记', '三', 'e', '些', 'b', 'N', '夫', '会', '才', '儿', '眼', '两', '美', '被', '一', '公', '来', '立', 'z', '长', '对', '己', '看', 'k', '许', '因', '相', '色', '后', '往', '打', '结', '格', '过', '世', '气', '7', '子', '条', '在', '书', '之', '定', 'v', '拉', '成', '进', '带', '着', '东', '上', '想', '天', '他', '妈', '1', '文', '而', '路', '那', '别', '德', '6', 'M', 't', '行', '侯', '难'];
var FQ_CODE_ST = 58344;
var FQ_CODE_ED = 58715;

function fqDecode(str) {
    if (!str) return str;
    var out = "";
    for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        var idx = code - FQ_CODE_ST;
        var ch = (code >= FQ_CODE_ST && code <= FQ_CODE_ED && FQ_DECODE_TABLE[idx] !== '?')
            ? FQ_DECODE_TABLE[idx]
            : str[i];
        out += ch;
    }
    return out;
}

// Đổi signed CDN domain → p6-novel.byteimg.com/origin rồi proxy qua i0.wp.com
function buildFqCoverUrl(url) {
    if (!url || typeof url !== "string") return null;
    try {
        var u = url;
        if (u.indexOf("https://") === 0) u = u.substring(8);
        else if (u.indexOf("http://") === 0) u = u.substring(7);
        else return null;

        var parts = u.split("/");
        if (!parts.length) return null;
        parts[0] = "https://i0.wp.com/p6-novel.byteimg.com/origin";

        return parts.map(function(x) { return x.split("~")[0].split("?")[0]; }).filter(Boolean).join("/");
    } catch (e) {
        return null;
    }
}

