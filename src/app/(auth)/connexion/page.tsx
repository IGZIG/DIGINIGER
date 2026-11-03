import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
