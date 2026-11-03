import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }
    >
      <AuthForm mode="signup" />
    </Suspense>
  );
}
