import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="Dernière mise à jour : novembre 2026">
      <h2>1. Données collectées</h2>
      <ul>
        <li>Données d&apos;identité : nom, adresse email, numéro de téléphone.</li>
        <li>Données d&apos;apprentissage : formations suivies, progression, scores, certificats.</li>
        <li>Données techniques : journaux de connexion, adresse IP, type d&apos;appareil.</li>
        <li>Données de paiement : références de transaction transmises par le prestataire.</li>
      </ul>
      <p>
        Les données de carte bancaire ne sont jamais stockées par DIGINIGER : elles sont traitées
        exclusivement par le prestataire de paiement certifié.
      </p>

      <h2>2. Finalités</h2>
      <ul>
        <li>Fournir l&apos;accès aux formations et suivre la progression.</li>
        <li>Délivrer et vérifier les certificats.</li>
        <li>Gérer les abonnements, paiements et remboursements.</li>
        <li>Améliorer la qualité pédagogique et la sécurité de la plateforme.</li>
        <li>Respecter nos obligations légales et comptables.</li>
      </ul>

      <h2>3. Base légale</h2>
      <p>
        Le traitement repose sur l&apos;exécution du contrat (accès aux formations), le consentement
        (communications), l&apos;intérêt légitime (sécurité, amélioration du service) et le respect
        d&apos;obligations légales (comptabilité).
      </p>

      <h2>4. Destinataires</h2>
      <p>
        Les données sont accessibles aux seuls personnels habilités, ainsi qu&apos;aux sous-traitants
        techniques (hébergement Supabase, prestataire de paiement, fournisseur du modèle d&apos;IA)
        dans la limite de leurs interventions. Aucune revente de données n&apos;est effectuée.
      </p>

      <h2>5. Transferts hors du pays</h2>
      <p>
        Certains prestataires hébergent des données dans l&apos;Union européenne. Ces transferts sont
        encadrés par des garanties contractuelles appropriées.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Les données de compte sont conservées pendant la durée de l&apos;utilisation du service, puis
        trois (3) ans après la dernière activité. Les pièces comptables sont conservées dix (10) ans.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        limitation, d&apos;opposition et de portabilité. Les demandes s&apos;exercent depuis votre
        espace personnel ou par email à <strong>donnees@diginiger.ne</strong>. Une réponse est
        apportée sous trente (30) jours.
      </p>

      <h2>8. Sécurité</h2>
      <ul>
        <li>Chiffrement des échanges (HTTPS/TLS) et hachage des mots de passe.</li>
        <li>Politiques de sécurité au niveau des lignes (RLS) dans PostgreSQL.</li>
        <li>Journalisation des actions sensibles et limitation du débit des requêtes.</li>
        <li>Clés d&apos;accès aux services externes conservées côté serveur uniquement.</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>
        Seuls des cookies strictement nécessaires au fonctionnement (session
        d&apos;authentification, préférences) sont utilisés. Aucun cookie publicitaire tiers
        n&apos;est déposé.
      </p>
    </LegalLayout>
  );
}
