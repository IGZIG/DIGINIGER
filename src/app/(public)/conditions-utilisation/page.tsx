import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function TermsPage() {
  return (
    <LegalLayout title="Conditions d'utilisation" updatedAt="Dernière mise à jour : novembre 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l&apos;accès et l&apos;utilisation de la plateforme
        DIGINIGER, académie numérique proposant des formations professionnelles en ligne, un
        assistant pédagogique automatisé et des certificats de réussite.
      </p>

      <h2>2. Compte utilisateur</h2>
      <p>
        La création d&apos;un compte nécessite une adresse email valide. Vous êtes responsable de la
        confidentialité de vos identifiants et de l&apos;exactitude des informations fournies. Toute
        utilisation frauduleuse doit être signalée sans délai.
      </p>

      <h2>3. Accès aux formations</h2>
      <p>
        Les formations gratuites sont accessibles à tout compte vérifié. Les formations payantes
        nécessitent l&apos;achat unitaire ou un abonnement actif. L&apos;accès est personnel et non
        transférable.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        Les contenus pédagogiques, marques et éléments graphiques sont protégés. Toute reproduction,
        revente ou diffusion publique non autorisée est interdite.
      </p>

      <h2>5. Assistant pédagogique automatisé</h2>
      <p>
        Le tuteur IA fournit une aide à la révision fondée sur les contenus validés par les
        formateurs. Ses réponses peuvent contenir des erreurs et ne constituent pas un avis
        professionnel, juridique ou financier. Les évaluations certificatives sont contrôlées selon
        les modalités décrites dans chaque formation.
      </p>

      <h2>6. Paiements et remboursements</h2>
      <p>
        Les paiements sont effectués via les prestataires Mobile Money et carte bancaire pris en
        charge par la plateforme. Une demande de remboursement peut être formulée dans un délai de
        sept (7) jours après l&apos;achat, sous réserve que moins de 20 % du contenu n&apos;ait été
        consulté.
      </p>

      <h2>7. Certificats</h2>
      <p>
        Les certificats sont émis après validation des conditions pédagogiques (progression complète
        et réussite des examens requis). Chaque certificat porte un numéro unique vérifiable
        publiquement.
      </p>

      <h2>8. Sanctions</h2>
      <p>
        Tout manquement peut entraîner la suspension du compte, la révocation d&apos;un certificat
        obtenu frauduleusement, sans préjudice des poursuites éventuelles.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit nigérien. En cas de litige, une solution
        amiable sera recherchée avant toute action judiciaire.
      </p>
    </LegalLayout>
  );
}
