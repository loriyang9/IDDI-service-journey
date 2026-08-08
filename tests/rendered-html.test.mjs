import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the disaster service journey", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>防災避難服務流程分析<\/title>/i);
  assert.match(html, />階段</);
  assert.match(html, />時間</);
  assert.match(html, />核心場景</);
  assert.match(html, /族群對象/);
  assert.match(html, /關鍵情境/);
  assert.match(html, /場景需求/);
  assert.match(html, /服務提供者需求/);
  assert.match(html, /打包一個家：未來生活的防災避難創新設計/);
  assert.match(html, /未來防災避難關鍵情境研究報告/);
  assert.match(html, /永續材料／結構研究報告/);
  assert.doesNotMatch(html, /從備災到復原的七個核心場景/);
  assert.doesNotMatch(html, /42\s*→\s*9/);
});

test("fallback data keeps the approved sheet shape", async () => {
  const source = await readFile(new URL("../app/data/sheet-fallback.json", import.meta.url), "utf8");
  const data = JSON.parse(source);
  const mainHeaders = data.main.values[0];
  const scenarioHeaders = data.scenarios.values[0];

  assert.equal(data.main.values.length, 43);
  assert.equal(data.scenarios.values.length, 5);
  assert.ok(mainHeaders.includes("場景ID"));
  assert.ok(mainHeaders.includes("族群需求"));
  assert.ok(mainHeaders.includes("服務端挑戰／考量重點（AI草稿）"));
  assert.ok(scenarioHeaders.includes("設計挑戰"));
  assert.ok(scenarioHeaders.includes("技術解題重點"));
});

test("verified case fallback keeps source and challenge mappings", async () => {
  const source = await readFile(new URL("../app/data/media-fallback.json", import.meta.url), "utf8");
  const cases = JSON.parse(source);

  assert.ok(cases.length >= 19);
  assert.ok(cases.some((item) =>
    item["卡片標題"].includes("水前寺競技場") &&
    item["內容層級"] === "情境現場" &&
    item["對應設計挑戰"] === "寵物防災避難現況"
  ));
  assert.ok(cases.some((item) =>
    item["卡片標題"].includes("ベンリー・オスレット") &&
    item["對應設計挑戰"] === "親子尿布檯與污物隔離槽"
  ));
  assert.ok(cases.some((item) => item["對應設計挑戰"] === "【貓咪】安置"));
  assert.ok(cases.some((item) => item["對應設計挑戰"] === "【特寵】安置"));
  assert.ok(cases.some((item) => item["對應設計挑戰"] === "【鳥類】安置"));
  assert.ok(cases.some((item) => item["卡片標題"].includes("魔法のかまどごはん")));
  assert.ok(cases.every((item) => item["來源標示（網站）"]));
  assert.ok(cases.every((item) => item["對應設計挑戰"]));
});
