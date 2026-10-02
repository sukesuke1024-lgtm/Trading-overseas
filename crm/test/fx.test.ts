import { test } from "node:test";
import assert from "node:assert/strict";
import { parseErApi, parseTwelveData } from "../src/lib/fx.ts";

test("ExchangeRate-API の応答を『1外貨あたりの円』に変換", () => {
  const r = parseErApi({ rates: { USD: 1 / 150, SGD: 1 / 112.5 }, time_last_update_utc: "Thu, 02 Oct 2026 00:02:31 +0000" });
  assert.equal(r.rates.USD, 150); assert.equal(r.rates.SGD, 112.5); assert.ok(r.asOf?.startsWith("2026-10-02"));
});
test("Twelve Data の一括取得応答を変換し、エラー応答は例外にする", () => {
  const r = parseTwelveData({ "USD/JPY": { price: "151.23400" }, "EUR/JPY": { price: "164.5" }, "SGD/JPY": { price: "bad" } });
  assert.equal(r.USD, 151.234); assert.equal(r.EUR, 164.5); assert.equal(r.SGD, undefined);
  assert.throws(() => parseTwelveData({ code: 401, message: "apikey invalid", status: "error" }), /apikey/);
});
