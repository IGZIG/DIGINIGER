"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewGenerationAction } from "@/lib/actions/admin";

/** Validation ou rejet d'une génération de contenu IA. */
export function GenerationReview({ generationId }: { generationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(decision: "accept" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await reviewGenerationAction(generationId, decision);
      if (!result.ok) {
        setError(result.message ?? "Action impossible.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <Button size="sm" loading={pending} onClick={() => run("accept")}>
          <Check className="h-4 w-4" aria-hidden />
          Relu et accepté
        </Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => run("reject")}>
          <X className="h-4 w-4" aria-hidden />
          Rejeter
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
