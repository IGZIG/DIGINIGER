import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { CheckoutForm } from "@/components/forms/checkout-form";
import { getCurrentUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { paymentStatus } from "@/lib/payments/provider";
import { formatXof } from "@/lib/utils";

export const metadata: Metadata = { title: "Paiement" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; course?: string }>;
}) {
  const { plan: planId, course: courseId } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    const next = `/paiement?${new URLSearchParams({
      ...(planId ? { plan: planId } : {}),
      ...(courseId ? { course: courseId } : {}),
    }).toString()}`;
    redirect(`/connexion?next=${encodeURIComponent(next)}`);
  }

  const supabase = await createServerSupabase();
  let label = "";
  let amountXof = 0;

  if (planId) {
    const { data: plan } = await supabase
      .from("plans")
      .select("name_fr, price_xof")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) redirect("/tarifs");
    label = `Abonnement ${plan.name_fr} (1 mois)`;
    amountXof = plan.price_xof;
  } else if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("title_fr, price_xof, slug")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) redirect("/formations");

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.authId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollment) redirect(`/app/mes-formations/${course.slug}`);

    label = `Formation « ${course.title_fr} »`;
    amountXof = course.price_xof;
  } else {
    redirect("/tarifs");
  }

  const enabled = paymentStatus();

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-4xl">
        <SectionTitle
          eyebrow="Paiement sécurisé"
          title="Finalisez votre inscription."
          description="Le paiement est vérifié côté serveur : votre accès s'ouvre automatiquement dès la confirmation du fournisseur."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-night-100 bg-white p-6 shadow-soft sm:p-8">
            <CheckoutForm
              planId={planId}
              courseId={courseId}
              label={label}
              amountXof={amountXof}
              paymentsEnabled={{ mobileMoney: enabled.mobileMoney, card: enabled.card }}
            />
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-night-100 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-night-300">Récapitulatif</p>
              <p className="mt-2 text-sm font-medium text-night-800">{label}</p>
              <p className="mt-3 font-display text-2xl font-bold">{formatXof(amountXof)}</p>
              <ul className="mt-4 space-y-2 text-sm text-night-500">
                {[
                  "Accès immédiat après confirmation",
                  "Tuteur IA inclus selon votre offre",
                  "Certificat vérifiable à la fin",
                  "Facture disponible dans votre espace",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-mist p-5 text-xs leading-relaxed text-night-400">
              Un problème de paiement ?{" "}
              <Link href="/contact" className="font-medium text-electric-600 hover:underline">
                Contactez-nous
              </Link>{" "}
              avec votre référence de transaction. Les remboursements sont possibles sous 7 jours
              selon les conditions d&apos;utilisation.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
