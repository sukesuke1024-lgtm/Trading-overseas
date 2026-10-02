import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, parseSdnCsv, ratesFromErApi, ratesFromFrankfurter, splitCsvLine } from "../scripts/feeds-lib.mjs";

const RSS2 = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>輸出に関するお知らせ &amp; 更新</title><link>https://example.go.jp/a</link><pubDate>Thu, 02 Oct 2026 01:00:00 GMT</pubDate><description><![CDATA[<p>概要です</p>]]></description></item><item><title>古い記事</title><link>https://example.go.jp/b</link><pubDate>Mon, 01 Sep 2026 01:00:00 GMT</pubDate></item></channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>ニュースリリース</title><link rel="alternate" href="https://example.go.jp/c"/><updated>2026-10-01T09:00:00+09:00</updated><summary>要約</summary></entry></feed>`;
const RDF = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item rdf:about="https://example.go.jp/d"><title>新着</title><link>https://example.go.jp/d</link><dc:date>2026-10-02T10:00:00+09:00</dc:date></item></rdf:RDF>`;

test("RSS/Atom/RDF を読み取り、新しい順に並べる。実体参照・CDATAを復号する", () => {
  const a = parseFeed(RSS2);
  assert.equal(a.length, 2); assert.equal(a[0].title, "輸出に関するお知らせ & 更新"); assert.equal(a[0].summary, "概要です"); assert.equal(a[0].date, "2026-10-02T01:00:00.000Z");
  assert.equal(parseFeed(ATOM)[0].link, "https://example.go.jp/c");
  assert.equal(parseFeed(RDF)[0].date, "2026-10-02T01:00:00.000Z");
  assert.deepEqual(parseFeed("<html>not a feed</html>"), []);
});
test("OFAC SDN CSV：引用符・カンマ入りの名称・'-0-' を正しく読む", () => {
  const csv = `36,"AEROCARIBBEAN AIRLINES","-0- ","CUBA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Linked To: X"\r\n306,"BIO-STRATH, S.A.","-0-","CUBA","-0-"\r\n1234,"SMIRNOV, Ivan Petrovich","individual","RUSSIA-EO14024"\r\nbad line`;
  const e = parseSdnCsv(csv);
  assert.equal(e.length, 3); assert.equal(e[1].n, "BIO-STRATH, S.A."); assert.equal(e[0].t, "entity"); assert.equal(e[2].p, "RUSSIA-EO14024");
  assert.deepEqual(splitCsvLine('a,"b,""c""",d'), ["a", 'b,"c"', "d"]);
});
test("為替：JPY基準のレートを『1外貨あたりの円』に変換", () => {
  assert.deepEqual(ratesFromFrankfurter({ date: "2026-10-01", rates: { USD: 1 / 152 } }, ["USD", "SGD"]), { asOf: "2026-10-01", rates: { USD: 152.0 } });
  const r = ratesFromErApi({ time_last_update_utc: "Thu, 02 Oct 2026 00:02:31 +0000", rates: { USD: 0.0066, EUR: 0.00606 } }, ["USD", "EUR"]);
  assert.equal(r.rates.USD, 151.515); assert.ok(r.asOf.startsWith("2026-10-02"));
});
