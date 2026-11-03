"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { enrollAction } from "@/lib/actions/learning";

/**
 * Inscription à une formation.
 * - Formation gratuite → inscription immédiate via Server Action.
 * - Formation payante  → redirection vers le tunnel de paiement (aucun accès
 *   n'est accordé avant confirmation serveur du paiement).
 */
export function EnrollButton({
  courseId,
  slug,
  isFree,
  isEnrolled,
  priceLabel,
}: {
  courseId: string;
  slug: string;
  isFree: boolean;
  isEnrolled: boolean;
  priceLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isEnrolled) {
    return (
      <ButtonLink href={`/app/mes-formations/${slug}`} size="lg" className="w-full">
        Continuer la formation
      </ButtonLink>
    );
  }

  if (!isFree) {
    return (
      <div className="space-y-2">
        <ButtonLink href={`/paiement?course=${courseId}`} size="lg" className="w-full">
          Acheter — {priceLabel}
        </ButtonLink>
        <ButtonLink href="/tarifs" variant="outline" size="sm" className="w-full">
          Ou s&apos;abonner pour tout débloquer
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await enrollAction(courseId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push(`/app/mes-formations/${slug}`);
            router.refresh();
          })
        }
      >
        S&apos;inscrire gratuitement
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
