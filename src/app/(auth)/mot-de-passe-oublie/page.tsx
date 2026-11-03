import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/auth-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <AuthForm mode="forgot" />
    </Suspense>
  );
}
