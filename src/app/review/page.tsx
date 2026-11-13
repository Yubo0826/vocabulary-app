import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getReviewState } from "@/lib/review-session";
import { requireUser } from "@/lib/session";
import { RatingHelp } from "./rating-help";
import { ReviewSession } from "./review-session";

export const metadata = { title: "複習" };

export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">複習</h1>
          <RatingHelp />
        </div>
        <Button asChild variant="ghost" className="text-primary">
          <Link href="/settings">複習設定</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
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
