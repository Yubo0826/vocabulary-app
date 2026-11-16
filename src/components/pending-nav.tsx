"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition } from "react";

/**
 * 同一頁只換 searchParams（篩選、排序、搜尋）時的即時回饋：
 * 點下去先把選中狀態切過去，列表換成骨架，等新資料到了再顯示。
 * （只換 searchParams 時，Next 會留著舊畫面直到新資料好，看起來像沒反應）
 * 用在「我的單字」與「筆記」。
 */
type Nav = { pendingHref: string | null; navigate: (href: string) => void };

const NavContext = createContext<Nav>({ pendingHref: null, navigate: () => {} });

export function PendingNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  const navigate = (href: string) => {
    setTarget(href);
    startTransition(() => router.push(href, { scroll: false }));
  };

  return <NavContext value={{ pendingHref: isPending ? target : null, navigate }}>{children}</NavContext>;
}

/** 自訂元件（例如搜尋表單）要自己觸發切換時用 */
export function usePendingNav() {
  return use(NavContext);
}

/**
 * 篩選、排序連結。切換中改用目標網址判斷選中狀態，且只比對自己負責的參數
 * （param：例如單字本標籤看 book、排序看 sort；value 空字串代表沒有這個參數），
 * 切換排序時單字本標籤才不會暫時變成沒選中。
 */
export function PendingNavLink({
  href,
  param,
  value,
  active,
  className,
  activeClassName,
  children,
}: {
  href: string;
  param: string;
  value: string;
  active: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const { pendingHref, navigate } = use(NavContext);
  const on = pendingHref ? (new URL(pendingHref, "http://x").searchParams.get(param) ?? "") === value : active;

  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={on ? activeClassName : className}
      onClick={(e) => {
        // 新分頁、新視窗開啟照瀏覽器預設
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (!on) navigate(href);
      }}
    >
      {children}
    </Link>
  );
}

/** 切換中顯示 fallback（骨架），否則顯示目前的內容 */
export function PendingArea({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  const { pendingHref } = use(NavContext);
  return pendingHref ? fallback : children;
}
