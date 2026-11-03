"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { processRefundAction } from "@/lib/actions/admin";

/** Validation ou refus d'une demande de remboursement (admin). */
export function RefundActions({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await processRefundAction(refundId, approve);
      if (!result.ok) {
        setError(result.message ?? "Traitement impossible.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <Button size="sm" loading={pending} onClick={() => run(true)}>
          <Check className="h-4 w-4" aria-hidden />
          Rembourser
        </Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => run(false)}>
          <X className="h-4 w-4" aria-hidden />
          Refuser
        </Button>
      </div>
      {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
    </div>
  );
}
