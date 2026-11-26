"use client";

import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";

/**
 * 頁首的搜尋按鈕：點了在頁面上方浮出搜尋列，背後蓋半透明遮罩。
 * 用 Radix Dialog 處理焦點鎖定、Esc 與點遮罩關閉、背景不能捲動；選了字或送出搜尋就關掉。
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="查單字" title="查單字">
          <Search />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-150 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        {/* 與頁首同寬、貼近頁面上緣（約在頁首的位置），讓提示清單有空間往下展開 */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-3 left-1/2 z-50 w-full max-w-[720px] -translate-x-1/2 px-4 duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">查單字</DialogPrimitive.Title>
          <SearchBox autoFocus onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
