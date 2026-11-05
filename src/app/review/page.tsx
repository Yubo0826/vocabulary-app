import Link from "next/link";
import { Suspense } from "react";
import { getReviewState } from "@/lib/review-session";
import { requireUser } from "@/lib/session";
import ui from "@/components/ui.module.css";
import { ReviewSession } from "./review-session";
import styles from "./page.module.css";

export const metadata = { title: "複習" };

export default function ReviewPage() {
  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <h1 className={styles.title}>複習</h1>
        <Link href="/settings" className={ui.buttonGhost}>
          複習設定
        </Link>
      </div>
      <Suspense fallback={<p className={ui.muted}>載入中…</p>}>
        <Review />
      </Suspense>
    </div>
  );
}

async function Review() {
  const user = await requireUser("/review");
  const initial = await getReviewState(user.id);
  return <ReviewSession initial={initial} />;
}
