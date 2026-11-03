"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { issueCertificateAction } from "@/lib/actions/learning";

/**
 * Demande d'émission du certificat.
 * Toutes les conditions (progression, examens) sont vérifiées par la RPC
 * issue_certificate : impossible de forcer la création côté client.
 */
export function CertificateRequestButton({
  courseId,
  alreadyIssued,
}: {
  courseId: string;
  alreadyIssued: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [serial, setSerial] = useState<string | null>(null);

  if (alreadyIssued) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700">
        <Award className="h-3.5 w-3.5" aria-hidden />
        Certificat obtenu
      </span>
    );
  }

  return (
    <div className="text-right">
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await issueCertificateAction(courseId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setSerial(result.data.serial);
            router.refresh();
          })
        }
      >
        <Award className="h-4 w-4" aria-hidden />
        Obtenir mon certificat
      </Button>

      {serial && (
        <p className="mt-2 text-xs text-emerald-700">
          Certificat émis : <span className="font-mono font-semibold">{serial}</span>
        </p>
      )}
      {error && (
        <div className="mt-2 max-w-xs text-left">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
