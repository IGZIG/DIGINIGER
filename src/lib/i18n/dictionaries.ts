/**
 * Internationalisation légère, sans dépendance externe (compatible
 * Server Components et Client Components).
 *
 * Le français est la langue par défaut : `dictionary.fr` sert de référence de
 * typage, donc toute clé ajoutée en anglais est vérifiée par TypeScript.
 *
 * Ce module ne contient que des données : il peut être importé des deux côtés.
 */

export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "diginiger_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en";
}

const fr = {
  common: {
    learnMore: "En savoir plus",
    seeAll: "Tout voir",
    search: "Rechercher",
    loading: "Chargement…",
    save: "Enregistrer",
    cancel: "Annuler",
    back: "Retour",
    language: "Langue",
    french: "Français",
    english: "English",
    free: "Gratuit",
    level: "Niveau",
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Avancé",
  },
  nav: {
    courses: "Formations",
    schools: "Nos écoles",
    instructors: "Formateurs",
    business: "Entreprises",
    pricing: "Tarifs",
    about: "À propos",
    contact: "Contact",
    verify: "Vérifier un certificat",
    login: "Connexion",
    signup: "S'inscrire",
    dashboard: "Mon espace",
    logout: "Se déconnecter",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  home: {
    eyebrow: "Académie numérique — Niger et Afrique de l'Ouest",
    title: "Des compétences qui ouvrent des portes, ici et maintenant.",
    subtitle:
      "Six écoles, des parcours pratiques, un tuteur IA et des certificats vérifiables. DIGINIGER forme les talents de l'économie numérique ouest-africaine.",
    ctaPrimary: "Explorer les formations",
    ctaSecondary: "Créer un compte",
    schoolsTitle: "Six écoles, un même niveau d'exigence",
    schoolsSubtitle: "Chaque école prépare à des métiers identifiés, avec des projets évalués.",
    popularTitle: "Formations les plus suivies",
    popularSubtitle: "Sélectionnées par nos formateurs et nos entreprises partenaires.",
    howTitle: "Apprendre, pratiquer, certifier",
    howSubtitle: "Trois étapes, aucune zone d'ombre : vous savez toujours où vous en êtes.",
  },
  courses: {
    title: "Catalogue des formations",
    subtitle: "Filtrez par école, niveau et budget pour trouver le parcours adapté.",
    searchPlaceholder: "Rechercher une formation, un formateur…",
    filterSchool: "École",
    filterLevel: "Niveau",
    filterAll: "Toutes",
    results: "formation(s)",
    empty: "Aucune formation ne correspond à ces critères.",
    reset: "Réinitialiser les filtres",
    price: "Prix",
    duration: "Durée",
    hours: "heures",
    students: "apprenants",
    enroll: "S'inscrire",
  },
  auth: {
    loginTitle: "Connexion à votre espace",
    signupTitle: "Créer un compte DIGINIGER",
    email: "Adresse email",
    password: "Mot de passe",
    fullName: "Nom complet",
    login: "Se connecter",
    signup: "Créer mon compte",
    noAccount: "Pas encore de compte ?",
    hasAccount: "Vous avez déjà un compte ?",
    forgot: "Mot de passe oublié ?",
  },
  dashboard: {
    greeting: "Bonjour",
    myCourses: "Mes formations",
    catalogue: "Catalogue",
    progress: "Progression",
    assessments: "Exercices & examens",
    certificates: "Certificats",
    tutor: "Tuteur IA",
    subscription: "Abonnement",
    profile: "Profil",
    continue: "Continuer",
    completed: "Terminée",
    resumeWhereYouLeft: "Reprendre où vous en étiez",
  },
  instructor: {
    dashboard: "Tableau de bord formateur",
    myCourses: "Mes formations",
    createCourse: "Créer une formation",
    aiAssistant: "Assistant IA",
    assessments: "Évaluations",
    learners: "Apprenants",
    revenue: "Revenus",
    submitForReview: "Soumettre à validation",
    inReview: "En attente de validation",
  },
  admin: {
    dashboard: "Administration DIGINIGER",
    courses: "Formations",
    users: "Utilisateurs",
    requests: "Demandes",
    payments: "Paiements",
    aiContent: "Contenus IA",
    certificates: "Certificats",
    settings: "Paramètres",
    publish: "Publier",
    reject: "Renvoyer en brouillon",
  },
  tutor: {
    title: "Tuteur IA",
    subtitle: "Il répond uniquement à partir des contenus pédagogiques validés de vos formations.",
    placeholder: "Posez votre question sur le cours…",
    send: "Envoyer",
    sources: "Extraits utilisés",
    notConfigured:
      "Le tuteur IA n'est pas configuré sur cette instance : aucune réponse n'est inventée.",
    remaining: "questions restantes aujourd'hui",
  },
  pricing: {
    title: "Des offres simples, en FCFA",
    subtitle: "Payez au mois ou à l'année, ou achetez une formation à l'unité.",
    choose: "Choisir cette offre",
  },
  verify: {
    title: "Vérifier un certificat",
    placeholder: "Numéro de certificat (ex. DIGI-2026-XXXXXXX)",
    submit: "Vérifier",
    valid: "Certificat authentique",
    invalid: "Aucun certificat ne correspond à ce numéro.",
  },
  footer: {
    tagline: "L'académie numérique du Niger et de l'Afrique de l'Ouest.",
    platform: "Plateforme",
    company: "L'entreprise",
    legal: "Légal",
    rights: "Tous droits réservés.",
  },
} as const;

type DictionaryShape = typeof fr;
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

const en: DeepStrings<typeof fr> = {
  common: {
    learnMore: "Learn more",
    seeAll: "See all",
    search: "Search",
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    language: "Language",
    french: "Français",
    english: "English",
    free: "Free",
    level: "Level",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  },
  nav: {
    courses: "Courses",
    schools: "Our schools",
    instructors: "Instructors",
    business: "For business",
    pricing: "Pricing",
    about: "About",
    contact: "Contact",
    verify: "Verify a certificate",
    login: "Sign in",
    signup: "Sign up",
    dashboard: "My space",
    logout: "Sign out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  home: {
    eyebrow: "Digital academy — Niger and West Africa",
    title: "Skills that open doors, here and now.",
    subtitle:
      "Six schools, hands-on paths, an AI tutor and verifiable certificates. DIGINIGER trains the talent of West Africa's digital economy.",
    ctaPrimary: "Explore courses",
    ctaSecondary: "Create an account",
    schoolsTitle: "Six schools, one standard of quality",
    schoolsSubtitle: "Each school leads to identified jobs, with assessed projects.",
    popularTitle: "Most popular courses",
    popularSubtitle: "Selected by our instructors and partner companies.",
    howTitle: "Learn, practise, certify",
    howSubtitle: "Three steps, no grey areas: you always know where you stand.",
  },
  courses: {
    title: "Course catalogue",
    subtitle: "Filter by school, level and budget to find the right path.",
    searchPlaceholder: "Search a course, an instructor…",
    filterSchool: "School",
    filterLevel: "Level",
    filterAll: "All",
    results: "course(s)",
    empty: "No course matches these filters.",
    reset: "Reset filters",
    price: "Price",
    duration: "Duration",
    hours: "hours",
    students: "learners",
    enroll: "Enrol",
  },
  auth: {
    loginTitle: "Sign in to your space",
    signupTitle: "Create a DIGINIGER account",
    email: "Email address",
    password: "Password",
    fullName: "Full name",
    login: "Sign in",
    signup: "Create my account",
    noAccount: "No account yet?",
    hasAccount: "Already have an account?",
    forgot: "Forgot your password?",
  },
  dashboard: {
    greeting: "Hello",
    myCourses: "My courses",
    catalogue: "Catalogue",
    progress: "Progress",
    assessments: "Exercises & exams",
    certificates: "Certificates",
    tutor: "AI tutor",
    subscription: "Subscription",
    profile: "Profile",
    continue: "Continue",
    completed: "Completed",
    resumeWhereYouLeft: "Pick up where you left off",
  },
  instructor: {
    dashboard: "Instructor dashboard",
    myCourses: "My courses",
    createCourse: "Create a course",
    aiAssistant: "AI assistant",
    assessments: "Assessments",
    learners: "Learners",
    revenue: "Revenue",
    submitForReview: "Submit for review",
    inReview: "Awaiting review",
  },
  admin: {
    dashboard: "DIGINIGER administration",
    courses: "Courses",
    users: "Users",
    requests: "Requests",
    payments: "Payments",
    aiContent: "AI content",
    certificates: "Certificates",
    settings: "Settings",
    publish: "Publish",
    reject: "Send back to draft",
  },
  tutor: {
    title: "AI tutor",
    subtitle: "It answers only from the validated course content of your enrolments.",
    placeholder: "Ask your question about the course…",
    send: "Send",
    sources: "Excerpts used",
    notConfigured: "The AI tutor is not configured on this instance: no answer is invented.",
    remaining: "questions left today",
  },
  pricing: {
    title: "Simple plans, priced in FCFA",
    subtitle: "Pay monthly or yearly, or buy a single course.",
    choose: "Choose this plan",
  },
  verify: {
    title: "Verify a certificate",
    placeholder: "Certificate number (e.g. DIGI-2026-XXXXXXX)",
    submit: "Verify",
    valid: "Authentic certificate",
    invalid: "No certificate matches this number.",
  },
  footer: {
    tagline: "The digital academy of Niger and West Africa.",
    platform: "Platform",
    company: "Company",
    legal: "Legal",
    rights: "All rights reserved.",
  },
};

export const dictionaries: Record<Locale, DeepStrings<DictionaryShape>> = { fr, en };

export function getDictionary(locale: Locale): DeepStrings<DictionaryShape> {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function htmlLang(locale: Locale): string {
  return locale === "en" ? "en" : "fr";
}
