"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Archive, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/fields";
import {
  publishCourseAssessmentsAction,
  reviewCourseAction,
  revokeCertificateAction,
  togglePromoCodeAction,
  updateApplicationStatusAction,
  updateUserRoleAction,
} from "@/lib/actions/admin";

/** Boutons de validation éditoriale d'une formation (admin). */
export function CourseReviewActions({
  courseId,
  status,
}: {
  courseId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Action impossible.");
        return;
      }
      setNotice(success);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status !== "published" && (
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              run(() => reviewCourseAction(courseId, "publish"), "Formation publiée.")
            }
          >
            <Check className="h-4 w-4" aria-hidden />
            Publier
          </Button>
        )}
        {status === "in_review" && (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() =>
              run(() => reviewCourseAction(courseId, "reject"), "Formation renvoyée en brouillon.")
            }
          >
            <X className="h-4 w-4" aria-hidden />
            Renvoyer en brouillon
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() =>
            run(
              () => publishCourseAssessmentsAction(courseId),
              "Évaluations de la formation publiées.",
            )
          }
        >
          Publier les évaluations
        </Button>
        {status === "published" && (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => run(() => reviewCourseAction(courseId, "archive"), "Formation archivée.")}
          >
            <Archive className="h-4 w-4" aria-hidden />
            Archiver
          </Button>
        )}
      </div>
      {error && <div className="mt-2"><Alert tone="error">{error}</Alert></div>}
      {notice && <div className="mt-2"><Alert tone="success">{notice}</Alert></div>}
    </div>
  );
}

/** Changement de rôle d'un utilisateur. */
export function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: "student" | "instructor" | "admin";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Select
        value={currentRole}
        disabled={disabled || pending}
        aria-label="Rôle de l'utilisateur"
        onChange={(event) => {
          const role = event.target.value as "student" | "instructor" | "admin";
          setError(null);
          startTransition(async () => {
            const result = await updateUserRoleAction(userId, role);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        <option value="student">Apprenant</option>
        <option value="instructor">Formateur</option>
        <option value="admin">Administrateur</option>
      </Select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Traitement d'une demande entrante. */
export function ApplicationActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: "reviewing" | "accepted" | "rejected") {
    startTransition(async () => {
      await updateApplicationStatusAction(applicationId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "reviewing" && status !== "accepted" && (
        <Button size="sm" variant="outline" loading={pending} onClick={() => update("reviewing")}>
          En cours
        </Button>
      )}
      {status !== "accepted" && (
        <Button size="sm" loading={pending} onClick={() => update("accepted")}>
          <Check className="h-4 w-4" aria-hidden />
          Accepter
        </Button>
      )}
      {status !== "rejected" && (
        <Button size="sm" variant="ghost" loading={pending} onClick={() => update("rejected")}>
          <X className="h-4 w-4" aria-hidden />
          Refuser
        </Button>
      )}
    </div>
  );
}

/** Activation / désactivation d'un code promo. */
export function PromoToggle({ promoId, isActive }: { promoId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={isActive ? "ghost" : "outline"}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await togglePromoCodeAction(promoId, !isActive);
          router.refresh();
        })
      }
    >
      {isActive ? "Désactiver" : "Activer"}
    </Button>
  );
}

/** Révocation d'un certificat (avec motif obligatoire). */
export function RevokeCertificateButton({
  certificateId,
  serial,
}: {
  certificateId: string;
  serial: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <ShieldOff className="h-4 w-4" aria-hidden />
        Révoquer
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
      <p className="text-xs font-medium text-red-800">Révoquer {serial}</p>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motif (obligatoire)"
        className="mt-2"
        aria-label="Motif de révocation"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="danger"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await revokeCertificateAction(certificateId, reason);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setOpen(false);
              router.refresh();
            })
          }
        >
          Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
