#!/usr/bin/env -S deno run --unstable --allow-net --allow-read --allow-write --import-map=import_map.json

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { format } from "std/datetime/mod.ts";
import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";
import { ensureDir } from "std/fs/mod.ts";

import type { SearchWord, TopSearch } from "./types.ts";
import { createArchive, createReadme, mergeWords } from "./utils.ts";

// トレンドデータを取得する場所のWOEID（例: 日本の場合は23424856）
// const WOEID = 23424856;

// APIエンドポイント
const url = "https://twitter.com/explore/tabs/trending";

// ヘッダー設定
const headers = {
  "User-Agent": "Mozilla/5.0",
};

const response = await fetch(url, { headers });

if (!response.ok) {
  console.error(response.statusText);
  Deno.exit(-1);
}

const result: string = await response.text();
const doc = new DOMParser().parseFromString(result, "text/html");

const trends = doc.querySelectorAll("div.css-1dbjc4n span");
trends.forEach((trend) => {
  console.log(trend.textContent);
});

const words: SearchWord[] = [];
trends.forEach((item) => {
  const title = item.target.title;
  const url = item.target.url;

  console.log(title);
  if (title && url) {
    words.push({
      display_query: title,
      query: url,
    });
  }
});

//const words = result.data;

if (words.length === 0) {
  console.error("No search words found after parsing.");
  Deno.exit(-1);
}

//console.log(words);

const yyyyMMdd = format(new Date(), "yyyy-MM-dd");
const year = yyyyMMdd.substring(0, 4);
const fullPath = join("raw", `${yyyyMMdd}.json`);

await ensureDir("raw");

let wordsAlreadyDownload: SearchWord[] = [];
if (await exists(fullPath)) {
  const content = await Deno.readTextFile(fullPath);
  wordsAlreadyDownload = JSON.parse(content);
}

// 保存原始データ
const wordsAll = mergeWords(words, wordsAlreadyDownload);
await Deno.writeTextFile(fullPath, JSON.stringify(wordsAll, null, 2));

// README.md 更新
const readme = await createReadme(wordsAll);
await Deno.writeTextFile("./README.md", readme);

// archives 更新
const archiveText = createArchive(wordsAll, yyyyMMdd);
const archiveDir = join("archives", year);
const archivePath = join(archiveDir, `${yyyyMMdd}.md`);
await ensureDir(archiveDir);
await Deno.writeTextFile(archivePath, archiveText);

// 手動導出のチェックに必要（エラーやデバッグの回避）
console.log("Process completed successfully!");
