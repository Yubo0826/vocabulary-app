"use client";

/** 頁首的主要導航連結：目前所在的區塊加 secondary container 膠囊底（Material 3 導航的 active indicator）（需要 usePathname，所以是 client 元件） */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/review", label: "複習", match: ["/review", "/settings"] },
  { href: "/saved", label: "我的單字", match: ["/saved", "/wordbooks"] },
  { href: "/notes", label: "筆記", match: ["/notes"] },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return LINKS.map(({ href, label, match }) => {
    const current = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
    return (
      <Link
        key={href}
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-foreground hover:bg-foreground/8 hover:no-underline",
          current && "bg-accent font-semibold text-accent-foreground hover:bg-accent",
        )}
      >
        {label}
      </Link>
    );
  });
}
