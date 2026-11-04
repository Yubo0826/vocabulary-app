import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: "1.4rem" }}>找不到這個頁面或單字</h1>
      <p style={{ color: "var(--muted)" }}>
        可以重新搜尋，或回到<Link href="/">首頁</Link>。
      </p>
      <SearchBox />
    </div>
  );
}
