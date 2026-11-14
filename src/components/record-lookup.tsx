"use client";

import { useEffect } from "react";
import { recordLookupAction } from "@/app/actions";
import { addLocalLookup } from "@/lib/lookup-history-local";

/** 單字頁打開時記一筆查字歷史：登入時存資料庫，未登入（或寫入失敗）時存瀏覽器 */
export function RecordLookup({ headword }: { headword: string }) {
  useEffect(() => {
    recordLookupAction(headword)
      .then(({ synced }) => {
        if (!synced) addLocalLookup(headword);
      })
      .catch(() => addLocalLookup(headword));
  }, [headword]);
  return null;
}
