import { describe, expect, it } from "vitest";

import { extractBatchItems, extractUrlsFromText } from "@/lib/batch-input";

describe("extractUrlsFromText", () => {
  it("extracts all distinct URLs from mixed share text", () => {
    const input = `视频：点击 https://m.toutiao.com/is/RICcKIVG_oc/
图文：点击 https://m.toutiao.com/is/JS6MXZTs2vA/`;

    expect(extractUrlsFromText(input)).toEqual([
      "https://m.toutiao.com/is/RICcKIVG_oc/",
      "https://m.toutiao.com/is/JS6MXZTs2vA/",
    ]);
  });
});

describe("extractBatchItems", () => {
  it("prefers extracted URLs for batch mode", () => {
    const input = `【文案一】
点击链接打开👉 https://m.toutiao.com/is/RICcKIVG_oc/

【文案二】
点击链接打开👉 https://m.toutiao.com/is/JS6MXZTs2vA/`;

    expect(extractBatchItems(input)).toEqual([
      "https://m.toutiao.com/is/RICcKIVG_oc/",
      "https://m.toutiao.com/is/JS6MXZTs2vA/",
    ]);
  });

  it("falls back to non-empty unique lines when no URLs exist", () => {
    expect(extractBatchItems("aaa\nbbb\naaa")).toEqual(["aaa", "bbb"]);
  });
});
