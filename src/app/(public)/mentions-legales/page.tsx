import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="Dernière mise à jour : novembre 2026">
      <h2>Éditeur du site</h2>
      <p>
        DIGINIGER — académie numérique.<br />
        Siège : Avenue de l&apos;Uranium, Niamey, Niger.<br />
        Email : contact@diginiger.ne — Téléphone : +227 20 00 00 00.
      </p>

      <h2>Directeur de la publication</h2>
      <p>Le représentant légal de DIGINIGER.</p>

      <h2>Hébergement</h2>
      <p>
        Application hébergée par Vercel Inc. Base de données, authentification et stockage assurés par
        Supabase (région Union européenne).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus (textes, visuels, vidéos, code) est protégé par le droit
        d&apos;auteur. Toute reproduction non autorisée est prohibée.
      </p>

      <h2>Signalement</h2>
      <p>
        Pour signaler un contenu illicite ou un incident de sécurité :{" "}
        <strong>securite@diginiger.ne</strong>.
      </p>
    </LegalLayout>
  );
}
