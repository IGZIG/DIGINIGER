import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl font-bold text-electric-500">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 max-w-md text-night-400">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">Retour à l&apos;accueil</ButtonLink>
        <ButtonLink href="/formations" variant="outline">
          Voir les formations
        </ButtonLink>
      </div>
    </div>
  );
}
