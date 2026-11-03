import type { Metadata } from "next";
import { Wallet, TrendingUp, Info } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatXof } from "@/lib/utils";

export const metadata: Metadata = { title: "Revenus (formateur)" };
export const dynamic = "force-dynamic";

const SHARE = 0.7;

export default async function InstructorRevenuePage() {
  const user = await requireRole(["instructor"], "/formateur/revenus");
  const supabase = await createServerSupabase();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title_fr")
    .eq("instructor_id", user.authId);

  const courseIds = (courses ?? []).map((course) => course.id);

  const { data: sales } = courseIds.length
    ? await supabase
        .from("transactions")
        .select("id, reference, total_xof, paid_at, course_id, status")
        .in("course_id", courseIds)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
    : { data: [] };

  const rows = sales ?? [];
  const gross = rows.reduce((sum, sale) => sum + sale.total_xof, 0);
  const net = Math.round(gross * SHARE);

  const now = new Date();
  const monthNet = Math.round(
    rows
      .filter((sale) => {
        if (!sale.paid_at) return false;
        const date = new Date(sale.paid_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, sale) => sum + sale.total_xof, 0) * SHARE,
  );

  const courseTitles = new Map((courses ?? []).map((course) => [course.id, course.title_fr]));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ventes brutes" value={formatXof(gross)} hint={`${rows.length} vente(s)`} icon={TrendingUp} />
        <StatCard label="Revenus nets (70 %)" value={formatXof(net)} icon={Wallet} tone="green" />
        <StatCard label="Ce mois-ci" value={formatXof(monthNet)} icon={TrendingUp} tone="gold" />
      </div>

      <section className="rounded-2xl border border-night-100 bg-white p-5">
        <div className="flex items-start gap-2 text-sm text-night-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
          <p className="leading-relaxed">
            Ces montants correspondent uniquement aux transactions réellement confirmées par le
            fournisseur de paiement (statut « payé »). La part formateur est de {SHARE * 100} % du
            montant encaissé. Aucun chiffre n&apos;est estimé : sans vente confirmée, le total est nul.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Détail des ventes</h2>
        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="Aucune vente confirmée"
              description="Les ventes de vos formations payantes apparaîtront ici après confirmation du paiement."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-night-100 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wider text-night-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Référence</th>
                  <th scope="col" className="px-4 py-3 font-medium">Formation</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Brut</th>
                  <th scope="col" className="px-4 py-3 font-medium">Part formateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-100">
                {rows.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-3 font-mono text-xs">{sale.reference}</td>
                    <td className="px-4 py-3 text-night-500">
                      {courseTitles.get(sale.course_id ?? "") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-night-400">{formatDate(sale.paid_at)}</td>
                    <td className="px-4 py-3">{formatXof(sale.total_xof)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatXof(Math.round(sale.total_xof * SHARE))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
