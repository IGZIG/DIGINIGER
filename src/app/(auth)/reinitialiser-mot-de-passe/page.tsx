import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
