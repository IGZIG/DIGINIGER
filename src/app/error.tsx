"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En production : envoyer vers l'observabilité (Sentry, Logflare…)
    console.error("[DIGINIGER]", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-night-400">
        Nous n&apos;avons pas pu afficher cette page. Vous pouvez réessayer.
      </p>
      {error.digest && <p className="mt-2 text-xs text-night-300">Référence : {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        Réessayer
      </Button>
    </div>
  );
}
