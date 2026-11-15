/**
 * 測試用的收藏捷徑：收藏＝放進單字本，所以每個使用者自動建立一本「測試」單字本，
 * save() 把字放進去、unsave() 把字移出它所在的每一本（最後一本移出時就取消收藏）。
 */
type Data = typeof import("../src/lib/user-data");

export function savingHelpers(getData: () => Data) {
  const bookIds = new Map<string, string>();

  async function defaultBook(userId: string) {
    const data = getData();
    let id = bookIds.get(userId);
    // 單字本可能被測試刪掉：確認還在，不在就重建
    if (!id || !(await data.getWordbook(userId, id))) {
      id = (await data.createWordbook(userId, { name: "測試" })).id;
      bookIds.set(userId, id);
    }
    return id;
  }

  async function save(userId: string, headword: string) {
    await getData().setWordbookMembership(userId, await defaultBook(userId), headword, true);
  }

  async function unsave(userId: string, headword: string) {
    const data = getData();
    const state = await data.getSaveState(userId, headword);
    for (const b of state.wordbooks.filter((w) => w.contains)) {
      await data.setWordbookMembership(userId, b.id, headword, false);
    }
  }

  return { save, unsave, defaultBook };
}
