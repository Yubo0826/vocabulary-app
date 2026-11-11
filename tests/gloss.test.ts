/**
 * 專業領域釋義的過濾規則（src/lib/gloss.ts），純函式，不需要資料庫。
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isTechnicalGloss, withoutTechnicalGlosses } from "../src/lib/gloss";

describe("專業領域釋義", () => {
  test("辨識專業領域標記，不含用法與類別標記", () => {
    assert.equal(isTechnicalGloss("[化] 間隙; 空隙"), true);
    assert.equal(isTechnicalGloss(" [醫] 厭惡, 移轉"), true);
    assert.equal(isTechnicalGloss("[計] 接收"), true);
    assert.equal(isTechnicalGloss("[俚] 傢伙"), false);
    assert.equal(isTechnicalGloss("[人名] 寇斯"), false);
    assert.equal(isTechnicalGloss("清除, 間隙"), false);
  });

  test("有一般釋義時去掉專業釋義", () => {
    const rows = [{ text: "清除, 間隙" }, { text: "[化] 間隙; 空隙" }];
    assert.deepEqual(withoutTechnicalGlosses(rows), [{ text: "清除, 間隙" }]);
  });

  test("只有專業釋義時原樣保留（字本身就是專業術語）", () => {
    const rows = [{ text: "[化] 激酶" }, { text: "[醫] 致活酶" }];
    assert.deepEqual(withoutTechnicalGlosses(rows), rows);
  });
});
