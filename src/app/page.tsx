import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { wordHref } from "@/lib/urls";
import styles from "./page.module.css";

const SAMPLES = ["receive", "run", "apple", "mice", "definately"];

export default function Home() {
  return (
    <div className={styles.home}>
      <h1 className={styles.title}>查單字</h1>
      <SearchBox autoFocus />
      <p className={styles.samples}>
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
