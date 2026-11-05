import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { wordHref } from "@/lib/urls";

const SAMPLES = ["receive", "run", "apple", "mice", "definately"];

export default function Home() {
  return (
    <div className="flex flex-col gap-4 pt-[clamp(16px,10vh,96px)]">
      <h1 className="text-2xl font-bold">查單字</h1>
      <SearchBox autoFocus />
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        試試看：
        {SAMPLES.map((w) => (
          <Link key={w} href={w === "definately" ? `/search?q=${w}` : wordHref(w)}>
            {w}
          </Link>
        ))}
      </p>
    </div>
  );
}
