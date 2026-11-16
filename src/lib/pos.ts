/** 詞性縮寫 → 中文名稱（ECDICT、OEWN、LLM 詞條共用；查不到時直接顯示縮寫） */
export const POS_LABELS: Record<string, string> = {
  "n.": "名詞",
  "v.": "動詞",
  "adj.": "形容詞",
  "adv.": "副詞",
  "prep.": "介系詞",
  "conj.": "連接詞",
  "pron.": "代名詞",
  "det.": "限定詞",
  "num.": "數詞",
  "int.": "感嘆詞",
  "abbr.": "縮寫",
  "phr.": "片語",
};
