/**
 * test_urls.js — Direct URL tester for sangtacviet extension
 *
 * Replicates the same HTTP calls extension scripts make but
 * uses async/await (Node 18+ built-in fetch).
 *
 * Usage:
 *   node test_urls.js chap   http://103.82.20.93/truyen/faloo/1/1519683/1/
 *   node test_urls.js chap   http://103.82.20.93/truyen/fanqie/1/7597745757453569048/7600486321739547161/ llm
 *   node test_urls.js detail http://103.82.20.93/truyen/faloo/1/1519683/
 *   node test_urls.js toc    http://103.82.20.93/truyen/faloo/1/1519683/
 *   node test_urls.js all
 */

"use strict";

const cheerio = require("cheerio");
const crypto  = require("crypto");
const { execSync } = require("child_process");

// ── Config (mirrors config.js) ────────────────────────────────────────────────
const STV_ORIGIN     = "https://103.82.20.93";
const STV_DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const STV_ANDROID_UA = "Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230901.001)";
const STV_URL_REGEX  = /\/truyen\/([^/]+)\/\d+\/(\d+)(?:\/(\d+))?\/?$/i;
const STV_PREFERRED_TRANSMODE = String(process.env.STV_TRANSMODE || "llm").trim().toLowerCase();
const STV_COOKIE = String(process.env.STV_COOKIE || "").trim();
const STV_LLM_NAMES = String(process.env.STV_LLM_NAMES || "");

// PUA decode table (from config.js)
const STV_PUA_MAP = {
  0xE01B:"A",0xE01E:"y",0xE06C:"t",0xE100:"o",0xE116:"4",0xE122:"W",0xE124:"Z",0xE14B:"J",0xE160:"e",0xE186:"D",
  0xE1A4:"f",0xE1D8:"K",0xE1EA:"Y",0xE22B:"h",0xE240:"x",0xE27E:"b",0xE2A9:"B",0xE2CA:"G",0xE2E3:"k",0xE2F8:"q",
  0xE30F:"F",0xE32F:"E",0xE334:"2",0xE34A:"I",0xE38F:"v",0xE3B7:"7",0xE3F1:"l",0xE426:"S",0xE43E:"6",0xE44E:"X",
  0xE49A:"c",0xE4A3:"8",0xE4CC:"s",0xE4EC:"5",0xE4F3:"r",0xE519:"0",0xE51F:"g",0xE566:"N",0xE57B:"O",0xE5BD:"C",
  0xE5C1:"d",0xE5F0:"u",0xE5FA:"m",0xE636:"P",0xE65B:"H",0xE65D:"z",0xE660:"9",0xE68D:"1",0xE691:"M",0xE6E0:"R",
  0xE6F1:"T",0xE6F3:"a",0xE705:"w",0xE71A:"3",0xE74F:"Q",0xE765:"n",0xE775:"V",0xE77D:"L",0xE7C7:"U",
  0xE902:"A",0xE915:"O",0xE91F:"e",0xE946:"a",0xE95D:"2",0xE97B:"f",0xE9D7:"r",0xE9F9:"K",0xEA20:"Y",0xEA2D:"v",
  0xEA65:"S",0xEA82:"o",0xEAB2:"6",0xEABB:"y",0xEACF:"b",0xEAD5:"L",0xEAED:"F",0xEB02:"s",0xEB0E:"C",0xEB0F:"R",
  0xEB18:"w",0xEB27:"D",0xEB62:"l",0xEB63:"9",0xEBEC:"k",0xEBF6:"N",0xEC0F:"q",0xEC19:"J",0xEC50:"7",0xECAD:"V",
  0xECDB:"Z",0xECF8:"U",0xED2C:"Q",0xED8C:"E",0xEDEC:"5",0xEE01:"c",0xEE0C:"n",0xEE0F:"u",0xEE47:"W",0xEE5C:"P",
  0xEEA1:"X",0xEEC1:"I",0xEEE3:"G",0xEF1F:"8",0xEF35:"x",0xEF3A:"d",0xEF57:"H",0xEFC8:"m",0xEFD4:"1",0xEFDA:"h",
  0xEFEF:"4",0xEFF6:"3",0xF019:"T",0xF050:"B",0xF065:"0",0xF096:"z",0xF0A6:"t",0xF0BD:"M",0xF0C0:"g"
};

// ── MD5 (pure JS, replicate md5.js) ──────────────────────────────────────────
function stv_md5(string) {
  return crypto.createHash("md5").update(string, "utf8").digest("hex");
}

// ── Helpers (mirrors config.js) ───────────────────────────────────────────────
function safe(v) {
  return String(v ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTransmode(mode) {
  const value = safe(mode).toLowerCase();
  return ["llm", "name", "chinese", "1", "tfms"].includes(value) ? value : "";
}

function parseCookieJar(cookieText) {
  const order = [];
  const map = {};
  for (const rawPart of String(cookieText || "").split(";")) {
    const piece = String(rawPart || "").trim();
    if (!piece) continue;
    const eqIndex = piece.indexOf("=");
    if (eqIndex < 1) continue;
    const name = piece.slice(0, eqIndex).trim();
    const value = piece.slice(eqIndex + 1).trim();
    if (!name) continue;
    if (!Object.prototype.hasOwnProperty.call(map, name)) order.push(name);
    map[name] = value;
  }
  return { order, map };
}

function serializeCookieJar(jar) {
  if (!jar || !jar.order || !jar.map) return "";
  const out = [];
  for (const name of jar.order) {
    if (!Object.prototype.hasOwnProperty.call(jar.map, name)) continue;
    const value = jar.map[name];
    if (typeof value === "undefined") continue;
    out.push(`${name}=${value}`);
  }
  return out.join("; ");
}

function getLegacyTransmode(meta) {
  return meta && (meta.host === "sangtac" || meta.host === "dich") ? "name" : "chinese";
}

function getPreferredTransmode(meta, override) {
  return normalizeTransmode(override || STV_PREFERRED_TRANSMODE) || getLegacyTransmode(meta);
}

function buildChapterCookie(transmode, baseCookie = STV_COOKIE) {
  const normalized = normalizeTransmode(transmode) || "chinese";
  const jar = parseCookieJar(baseCookie);

  if (!jar.order.length) {
    const cookies = ["lang=zh", `transmode=${normalized}`];
    if (normalized === "llm") cookies.push("foreignlang=vi");
    return cookies.join("; ");
  }

  if (!Object.prototype.hasOwnProperty.call(jar.map, "lang")) jar.order.push("lang");
  jar.map.lang = "zh";
  if (!Object.prototype.hasOwnProperty.call(jar.map, "transmode")) jar.order.push("transmode");
  jar.map.transmode = normalized;
  if (normalized === "llm") {
    if (!Object.prototype.hasOwnProperty.call(jar.map, "foreignlang")) jar.order.push("foreignlang");
    jar.map.foreignlang = "vi";
  }

  return serializeCookieJar(jar);
}

function getHeaderValue(headers, name) {
  if (!headers) return "";
  const target = String(name || "").toLowerCase();
  try {
    if (typeof headers.get === "function") {
      return safe(headers.get(name) || headers.get(target));
    }
  } catch {}
  try {
    return safe(headers[name] || headers[target]);
  } catch {}
  return "";
}

function looksLikeReqId(value) {
  const token = safe(value);
  if (!token || token.length < 16) return false;
  if (/[\s<>{}"]/g.test(token)) return false;
  return /^[a-z0-9_-]+$/i.test(token);
}

function extractReqIdToken(value) {
  const text = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/@Bạn đang đọc bản lưu trong hệ thống/gi, " ")
    .replace(/Bạn đang xem văn bản gốc chưa dịch, có thể kéo xuống cuối trang để chọn bản dịch\./gi, " ")
    .replace(/Vì vấn đề nội dung, nguồn này không hỗ trợ xem văn bản gốc\./gi, " ");

  const normalized = safe(text);
  const compact = normalized.replace(/\s+/g, "");
  if (looksLikeReqId(compact)) return compact;

  const matches = normalized.match(/[a-z0-9_-]{16,}/ig) || [];
  if (matches.length === 1) {
    const remainder = safe(normalized.replace(matches[0], ""));
    if (!remainder) return matches[0];
  }

  return "";
}

function extractAiErrorText(value) {
  const text = String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return /Đã xảy ra lỗi khi dịch AI|Quota exceeded|RESOURCE_EXHAUSTED|Mô hình AI không thể dịch nội dung/i.test(text)
    ? text
    : "";
}

function extractReqIdFromPayload(payload, assumeLlmMode) {
  if (!payload) return "";
  const direct = safe(payload.reqId || payload.reqid || payload.req_id);
  if (direct) return direct;
  const viaTl = safe(payload.via_tl || payload.viaTl).toLowerCase();
  const looksLikeLlmPayload = !!assumeLlmMode || viaTl === "llm" || !!payload.acss || !!payload.origin;
  return looksLikeLlmPayload ? extractReqIdToken(payload.data) : "";
}

function cleanupLlmText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<\/?names>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLlmNames(value) {
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  const output = [];
  const seen = {};

  for (const rawLine of lines) {
    let line = String(rawLine || "").replace(/\t/g, " ").trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    line = line.replace(/[ ]{2,}/g, " ");
    if (Object.prototype.hasOwnProperty.call(seen, line)) continue;
    seen[line] = true;
    output.push(line);
  }

  return output.join("\n").trim();
}

function encodeFormComponent(value) {
  return encodeURIComponent(String(value || "")).replace(/%20/g, "+");
}

function buildLlmNamesBody() {
  return `names=${encodeFormComponent(normalizeLlmNames(STV_LLM_NAMES))}`;
}

function extractLlmSseContent(raw) {
  const chunks = [];
  const lines = String(raw || "").replace(/\r/g, "").split("\n");
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payloadText = line.slice(5).trim();
    if (!payloadText) continue;
    if (payloadText === "[DONE]") break;
    try {
      const payload = JSON.parse(payloadText);
      if (payload.error) return "";
      const delta = payload.choices?.[0]?.delta?.content || "";
      if (delta) chunks.push(String(delta));
    } catch {}
  }
  return cleanupLlmText(chunks.join(""));
}

function extractAiResponseErrorMessage(raw, status) {
  const text = String(raw || "");
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed[0]?.error) {
      return parsed[0].error.message || parsed[0].error.status || text;
    }
    if (parsed?.error) {
      return parsed.error.message || parsed.error.status || text;
    }
    if (parsed?.message) {
      return parsed.message;
    }
  } catch {}
  const extracted = extractAiErrorText(text);
  if (extracted) return extracted;
  return status >= 400 ? text : "";
}

function decodePua(text) {
  if (!text) return text;
  return text.replace(/[\uE000-\uF8FF]/g, (c) => STV_PUA_MAP[c.charCodeAt(0)] || c);
}

function parseStvUrl(url) {
  const m = STV_URL_REGEX.exec(url);
  if (!m) return null;
  let origin = String(url || "").match(/^https?:\/\/[^/]+/i)?.[0] || STV_ORIGIN;
  if (/^http:\/\/(?:\d+\.\d+\.\d+\.\d+)/i.test(origin) && STV_ORIGIN.indexOf("https://") === 0) {
      origin = origin.replace(/^http:\/\//i, "https://");
  }
  return { host: m[1], bookId: m[2], chapterId: m[3] || "", origin };
}

function buildBookUrl(meta) {
  return `${meta.origin || STV_ORIGIN}/truyen/${meta.host}/1/${meta.bookId}/`;
}
function buildChapUrl(meta, chapId) {
  return buildBookUrl(meta) + chapId + "/";
}
function buildTocEndpoint(meta) {
  return `${meta.origin || STV_ORIGIN}/index.php?ngmar=chapterlist&h=${meta.host}&bookid=${meta.bookId}&sajax=getchapterlist`;
}
function buildAppApiEndpoint(meta) {
  const query = `bookid=${meta.bookId}&c=${meta.chapterId}&download=true&h=${meta.host}&key=stvmobilereader&sajax=readchapter`;
  const parts = query.split("&").filter(Boolean);
  parts.sort();
  const sortedQuery = parts.join("&") + "&";
  const sign = stv_md5(sortedQuery + "erogh982^%*%^*");
  return { endpoint: `${meta.origin || STV_ORIGIN}/index.php?${query}`, sign };
}
function buildAjaxEndpoint(meta, mode) {
  if (mode === "ajax") {
    return `${meta.origin || STV_ORIGIN}/index.php?ajax=readchapter&bookid=${meta.bookId}&h=${meta.host}&c=${meta.chapterId}&sty=1`;
  }
  return `${meta.origin || STV_ORIGIN}/index.php?bookid=${meta.bookId}&h=${meta.host}&c=${meta.chapterId}&ngmar=readc&sajax=readchapter&sty=1`;
}

// ── Cheerio wrapper (approximates vbook's doc API) ────────────────────────────
function wrapDoc(html) {
  const $ = cheerio.load(html);
  function wrap(sel) {
    return {
      get length() { return sel.length; },
      text()        { return sel.text(); },
      html()        { return $.html(sel); },
      attr(n)       { return sel.attr(n) ?? ""; },
      first()       { return wrap(sel.first()); },
      last()        { return wrap(sel.last()); },
      select(s)     { return wrap(sel.find(s)); },
      forEach(fn)   { sel.each((i, el) => fn(wrap($(el)), i)); }
    };
  }
  return {
    select(s) { return wrap($(s)); },
    html()    { return $.html(); },
    text()    { return $.text(); }
  };
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────
async function stvFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method:  opts.method  || "GET",
      headers: opts.headers || {},
      body:    opts.body    ?? undefined,
      signal:  controller.signal
    });
    const rawText = await res.text();
    return {
      ok:     res.ok,
      status: res.status,
      headers: res.headers,
      text()  { return rawText; },
      json()  { return JSON.parse(rawText); },
      html()  { return wrapDoc(rawText); }
    };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, headers: undefined, text() { return ""; }, json() { return null; }, html() { return wrapDoc(""); } };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLlmChapter(meta, endpoint, sign) {
  const res1 = await stvFetch(endpoint, {
    headers: {
      "X-STV-Sign": sign,
      "User-Agent": STV_ANDROID_UA,
      "X-Requested-With": "vn.sangtacviet.app",
      "Cookie": buildChapterCookie("llm")
    }
  });

  console.log(`  HTTP status=${res1.status} ok=${res1.ok}`);
  if (!res1.ok) return "";

  let payload;
  try {
    payload = JSON.parse(res1.text());
  } catch {}

  const reqId = getHeaderValue(res1.headers, "x-reqid") || extractReqIdFromPayload(payload, true);
  console.log(`  reqId    : ${reqId || "(missing)"}`);
  if (!reqId) {
    console.log(`  RAW[0:300]: ${res1.text().substring(0, 300)}`);
    return "";
  }

  await stvFetch(`${meta.origin || STV_ORIGIN}/io/novel/updateOldLink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": buildChapterCookie("llm"),
      "Origin": meta.origin || STV_ORIGIN,
      "Referer": buildChapUrl(meta, meta.chapterId),
      "User-Agent": STV_DESKTOP_UA
    },
    body: `host=${encodeURIComponent(meta.host)}&bookid=${encodeURIComponent(meta.bookId)}&chapterid=${encodeURIComponent(meta.chapterId)}`
  });

  const sseUrl = `${meta.origin || STV_ORIGIN}/io/aitranslate2/passContext?reqId=${encodeURIComponent(reqId)}`;
  const res2 = await stvFetch(sseUrl, {
    method: "POST",
    headers: {
      "Accept": "text/event-stream",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": buildChapterCookie("llm"),
      "Origin": meta.origin || STV_ORIGIN,
      "Referer": buildChapUrl(meta, meta.chapterId),
      "User-Agent": STV_DESKTOP_UA
    },
    body: buildLlmNamesBody()
  });

  console.log(`  SSE  status=${res2.status} ok=${res2.ok}`);
  if (!res2.ok) {
    const errorText = extractAiResponseErrorMessage(res2.text(), res2.status);
    console.log(`  SSE error: ${(errorText || res2.text()).substring(0, 500)}`);
    return "";
  }

  const content = extractLlmSseContent(res2.text());
  if (!content) {
    const errorText = extractAiResponseErrorMessage(res2.text(), res2.status);
    if (errorText) {
      console.log(`  SSE error: ${errorText.substring(0, 500)}`);
    }
  }

  return content;
}

// ── Logger ────────────────────────────────────────────────────────────────────
function hr(label, ch = "─") {
  const line = ch.repeat(60);
  console.log(`\n${line}`);
  if (label) console.log(`  ${label}`);
  console.log(line);
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST: DETAIL
// ═════════════════════════════════════════════════════════════════════════════
async function testDetail(url) {
  hr(`TEST DETAIL — ${url}`);
  const meta = parseStvUrl(url);
  if (!meta) { console.log("[FAIL] Cannot parse URL"); return; }

  const canonicalUrl = buildBookUrl(meta);
  console.log(`[URL] ${canonicalUrl}`);
  console.log(`[META] host=${meta.host}  bookId=${meta.bookId}`);

  const res = await stvFetch(canonicalUrl, {
    headers: { "Cookie": "lang=zh; transmode=1", "User-Agent": STV_DESKTOP_UA }
  });

  console.log(`[HTTP] status=${res.status} ok=${res.ok}`);
  if (!res.ok) { console.log("[FAIL]", res.error || "HTTP error"); return; }

  const doc  = res.html();
  const html = res.text();

  // Extract name
  let name = safe(doc.select("#book_name2").text()) || safe(doc.select("h1").first().text()) || safe(doc.select(".book_name").text());
  if (!name) {
    const m = html.match(/"namevi"\s*:\s*"([^"]+)"/);
    name = m ? m[1] : "";
  }
  if (!name) {
    const m = html.match(/"name"\s*:\s*"([^"]+)"/);
    name = m ? m[1] : "";
  }

  // Extract author
  let author = safe(doc.select("i[t='Tác giả']").text()) ||
               safe(doc.select("i[t='作者']").text()) ||
               safe(doc.select(".author").text());
  if (!author) {
    const m = html.match(/"author"\s*:\s*"([^"]+)"/);
    if (m) {
      try { author = JSON.parse('"' + m[1] + '"'); } catch { author = m[1]; }
    } else {
      author = "Unknown";
    }
  }

  // ongoing
  const ongoing = !/Hoàn thành|Tạm ngưng|已完结/i.test(html);

  // cover - unescape JSON slashes
  let cover = "";
  const imgs = ["img.book_img", ".book-cover img", ".book_img img", "img[src*='thumb']"];
  for (const sel of imgs) {
    const v = safe(doc.select(sel).attr("src"));
    if (v) { cover = v; break; }
  }
  if (!cover) {
    const m = html.match(/"thumb(?:nail)?"\s*:\s*"([^"]+)"/);
    if (m) { try { cover = JSON.parse('"' + m[1] + '"'); } catch { cover = m[1]; } }
  }

  // description
  const desc = safe(doc.select(".book-desc, #book_desc, .blk-body p, .summary").text()).substring(0, 200);

  console.log(`\n  name    : ${name}`);
  console.log(`  author  : ${author}`);
  console.log(`  ongoing : ${ongoing}`);
  console.log(`  cover   : ${cover || "(not found)"}`);
  console.log(`  desc    : ${desc || "(not found)"}`);
  console.log("\n[OK] detail test done");
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST: TOC
// ═════════════════════════════════════════════════════════════════════════════
async function testToc(url) {
  hr(`TEST TOC — ${url}`);
  const meta = parseStvUrl(url);
  if (!meta) { console.log("[FAIL] Cannot parse URL"); return; }

  const endpoint = buildTocEndpoint(meta);
  const referer  = buildBookUrl(meta);
  console.log(`[ENDPOINT] ${endpoint}`);

  const res = await stvFetch(endpoint, {
    headers: {
      "Cookie": "lang=zh; transmode=1",
      "User-Agent": STV_DESKTOP_UA,
      "Referer": referer
    }
  });

  console.log(`[HTTP] status=${res.status} ok=${res.ok}`);
  if (!res.ok) { console.log("[FAIL]", res.error || "HTTP error"); return; }

  const raw = res.text();
  console.log(`[RAW] ${raw.substring(0, 200)}`);

  let json;
  try { json = JSON.parse(raw); } catch { console.log("[FAIL] JSON parse error"); return; }

  if (!json || String(json.code) !== "1" || !json.data) {
    console.log(`[FAIL] API returned code=${json?.code} message=${json?.msg || json?.message || ""}`);
    console.log("  Full response:", JSON.stringify(json).substring(0, 400));
    return;
  }

  // data field is a custom delimited string: entries separated by "-//-"
  // each entry: "[groupId]-/-[chapterId]-/-[name]"
  const rawData = json.oridata || json.data;
  const list = parseStvChapterList(String(rawData || ""));
  console.log(`\n  Total chapters : ${list.length}`);
  if (list.length > 0) {
    const first = list[0];
    const last  = list[list.length - 1];
    console.log(`  First  : id=${first.chapterId}  name=${first.name}`);
    console.log(`  Last   : id=${last.chapterId}   name=${last.name}`);
    console.log(`  URL[0] : ${buildChapUrl(meta, first.chapterId)}`);
    console.log(`  URL[-1]: ${buildChapUrl(meta, last.chapterId)}`);
  }
  console.log("\n[OK] toc test done");
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST: CHAP
// ═════════════════════════════════════════════════════════════════════════════
async function testChap(url, transmodeArg) {
  hr(`TEST CHAP — ${url}`);
  const meta = parseStvUrl(url);
  if (!meta || !meta.chapterId) { console.log("[FAIL] Cannot parse URL or missing chapterId"); return; }

  console.log(`[META] host=${meta.host}  bookId=${meta.bookId}  chapterId=${meta.chapterId}`);
  const preferredTransmode = getPreferredTransmode(meta, transmodeArg);
  const fallbackTransmode = preferredTransmode === "llm" ? getLegacyTransmode(meta) : preferredTransmode;
  console.log(`[MODE] preferred=${preferredTransmode} fallback=${fallbackTransmode}`);

  const { endpoint, sign } = buildAppApiEndpoint(meta);

  if (preferredTransmode === "llm") {
    console.log("\n[Attempt 0] LLM stream");
    console.log(`  endpoint : ${endpoint}`);
    console.log(`  sign     : ${sign}`);
    const llmContent = await fetchLlmChapter(meta, endpoint, sign);
    if (llmContent) {
      console.log(`  [SUCCESS] content length=${llmContent.length}`);
      console.log(`  preview  : ${llmContent.substring(0, 300)}`);
      return;
    }
    console.log("  [MISS] llm stream returned empty, continuing...");
  }

  // ── Attempt 1: App API ────────────────────────────────────────────────────
  console.log("\n[Attempt 1] App API (X-STV-Sign)");
  const transmode = fallbackTransmode;
  console.log(`  endpoint : ${endpoint}`);
  console.log(`  sign     : ${sign}`);

  const res1 = await stvFetch(endpoint, {
    headers: {
      "X-STV-Sign": sign,
      "User-Agent": STV_ANDROID_UA,
      "X-Requested-With": "vn.sangtacviet.app",
      "Cookie": buildChapterCookie(transmode)
    }
  });
  console.log(`  HTTP status=${res1.status} ok=${res1.ok}`);

  if (res1.ok) {
    const txt = res1.text();
    console.log(`  RAW[0:300]: ${txt.substring(0, 300)}`);
    if (txt.includes('"code"')) {
      const p = JSON.parse(txt);
      console.log(`  code=${p.code}`);
      if (p.code == 0) {
        const content = extractAjaxChapterContent(p);
        console.log(`  [SUCCESS] content length=${content.length}`);
        console.log(`  preview  : ${decodePua(content).substring(0, 300)}`);
        return;
      }
      console.log(`  not code 0, continuing...`);
    }
  }

  // ── Attempt 2: HTML page ──────────────────────────────────────────────────
  console.log("\n[Attempt 2] HTML page scrape");
  const chapPageUrl = buildChapUrl(meta, meta.chapterId);
  console.log(`  URL: ${chapPageUrl}`);
  const res2 = await stvFetch(chapPageUrl, {
    headers: { "Cookie": buildChapterCookie(transmode), "User-Agent": STV_DESKTOP_UA }
  });
  console.log(`  HTTP status=${res2.status} ok=${res2.ok}`);
  if (res2.ok) {
    const html = res2.text();
    const content = extractChapterHtml(html, meta);
    if (content) {
      console.log(`  [SUCCESS] content length=${content.length}`);
      console.log(`  preview  : ${decodePua(content).substring(0, 300)}`);
      return;
    }
    console.log(`  [MISS] chapter not yet loaded in HTML (requires browser JS)`);
    // Show raw text from content-container to debug
    const $ = cheerio.load(html);
    const raw = $("#content-container").text().replace(/\s+/g, " ").trim();
    console.log(`  #content-container[0:200]: "${raw.substring(0, 200)}"`);
  }

  // ── Attempt 3: AJAX POST ──────────────────────────────────────────────────
  for (const mode of ["ajax", "sajax"]) {
    console.log(`\n[Attempt 3-${mode}] AJAX POST`);
    const ajaxUrl = buildAjaxEndpoint(meta, mode);
    console.log(`  URL: ${ajaxUrl}`);
    const res3 = await stvFetch(ajaxUrl, {
      method: "POST",
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
        "Cookie": buildChapterCookie(transmode),
        "Referer": chapPageUrl,
        "User-Agent": STV_DESKTOP_UA
      },
      body: mode === "sajax" ? `rescan=true&k=` : ""
    });
    console.log(`  HTTP status=${res3.status} ok=${res3.ok}`);
    if (res3.ok) {
      const txt = res3.text();
      console.log(`  RAW[0:300]: ${txt.substring(0, 300)}`);
      try {
        const p = JSON.parse(txt);
        const content = extractAjaxChapterContent(p);
        if (content) {
          console.log(`  [SUCCESS] content length=${content.length}`);
          console.log(`  preview  : ${decodePua(content).substring(0, 300)}`);
          return;
        }
      } catch { console.log("  JSON parse error"); }
    }
  }

  console.log("\n[FAIL] All attempts exhausted — chapter content not retrieved");
}

// ── Chapter content extractors ─────────────────────────────────────────────
function extractAjaxChapterContent(p) {
  if (!p) return "";
  const raw = p.data_content || p.content || p.data || "";
  if (!raw) return "";
  if (typeof raw === "object") {
    // may have .text or .data
    return String(raw.text || raw.data || JSON.stringify(raw));
  }
  return String(raw);
}

function parseStvChapterList(data) {
  const chapters = [];
  if (!data) return chapters;
  const rows = String(data).split("-//-");
  for (const row of rows) {
    const parts = row.split("-/-");
    if (parts.length < 3) continue;
    const chapterId = parts[1].trim();
    const name = parts.slice(2).join("-/-").replace(/\s+/g, " ").trim();
    if (chapterId && name) chapters.push({ chapterId, name });
  }
  return chapters;
}

function extractChapterHtml(html, meta) {
  const $ = cheerio.load(html);
  // mirrors getStvChapterNode selectors
  const chapId  = meta ? meta.chapterId : "";
  const bookId  = meta ? meta.bookId : "";
  const selectors = chapId ? [
    `#content-container .contentbox[cid='${chapId}']`,
    `#cld-${bookId}-${chapId}`,
    `#content-container [cid='${chapId}']`,
    "#content-container .contentbox"
  ] : ["#content-container .contentbox"];
  for (const sel of selectors) {
    const node = $(sel);
    const txt = node.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (txt.length > 60 && !/Nhấp vào để tải|Đang tải nội dung|spinner-border|Vui lòng xác nhận/i.test(txt)) {
      return txt;
    }
  }
  return "";
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  const [,, cmd, urlArg, transmodeArg] = process.argv;

  const CHAP_URL   = "http://103.82.20.93/truyen/faloo/1/1519683/1/";
  const DETAIL_URL = "http://103.82.20.93/truyen/faloo/1/1519683/";

  switch (cmd) {
    case "chap":
      await testChap(urlArg || CHAP_URL, transmodeArg);
      break;
    case "detail":
      await testDetail(urlArg || DETAIL_URL);
      break;
    case "toc":
      await testToc(urlArg || DETAIL_URL);
      break;
    case "all":
    default:
      await testDetail(DETAIL_URL);
      await testToc(DETAIL_URL);
      await testChap(CHAP_URL, transmodeArg);
      break;
  }
}

main().catch(console.error);
