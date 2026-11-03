import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Vérifiez votre email" };

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-50 text-electric-600">
        <MailCheck className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-semibold">Vérifiez votre boîte email</h1>
      <p className="mt-2 text-sm leading-relaxed text-night-400">
        Un email de confirmation vient de vous être envoyé. Cliquez sur le lien qu&apos;il contient
        pour activer votre compte DIGINIGER. Pensez à vérifier vos courriers indésirables.
      </p>
      <div className="mt-7 flex flex-col gap-2.5">
        <ButtonLink href="/connexion">Aller à la connexion</ButtonLink>
        <ButtonLink href="/" variant="ghost">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
    </div>
  );
}
