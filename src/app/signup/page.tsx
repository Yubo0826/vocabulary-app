import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/urls";

export const metadata = { title: "註冊" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={null}>
      {searchParams.then(({ next }) => (
        <AuthForm mode="signup" next={safeNext(next)} googleEnabled={googleEnabled} />
      ))}
    </Suspense>
  );
}
