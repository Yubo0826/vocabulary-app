import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">找不到這個頁面或單字</h1>
      <p className="text-muted-foreground">
        可以重新搜尋，或回到<Link href="/">首頁</Link>。
      </p>
      <SearchBox />
    </div>
  );
}
