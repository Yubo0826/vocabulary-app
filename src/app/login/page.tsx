import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/urls";

export const metadata = { title: "登入" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      {searchParams.then(({ next }) => (
        <AuthForm mode="login" next={safeNext(next)} googleEnabled={googleEnabled} />
      ))}
    </Suspense>
  );
}
