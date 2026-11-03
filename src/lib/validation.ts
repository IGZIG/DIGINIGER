import { z } from "zod";

/**
 * Schémas de validation partagés (client + serveur).
 * Toute route serveur revalide : la validation côté client est un confort UX,
 * jamais une garantie de sécurité.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(5, "Email trop court")
  .max(254, "Email trop long")
  .email("Adresse email invalide");

export const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .max(72, "72 caractères maximum")
  .regex(/[a-zA-Z]/, "Ajoutez au moins une lettre")
  .regex(/[0-9]/, "Ajoutez au moins un chiffre");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s.-]{8,20}$/, "Numéro de téléphone invalide")
  .optional()
  .or(z.literal(""));

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nom trop court").max(80, "Nom trop long"),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: z.enum(["fr", "en"]).default("fr"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(80),
  phone: phoneSchema,
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  bio: z.string().trim().max(600, "600 caractères maximum").optional().or(z.literal("")),
  locale: z.enum(["fr", "en"]),
});

export const contactSchema = z.object({
  kind: z.enum(["contact", "instructor", "enterprise"]),
  fullName: z.string().trim().min(2, "Nom requis").max(80),
  email: emailSchema,
  phone: phoneSchema,
  organisation: z.string().trim().max(120).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(20, "Décrivez votre demande en 20 caractères minimum").max(3000),
  // Honeypot anti-robot : doit rester vide
  website: z.string().max(0).optional().or(z.literal("")),
});

export const checkoutSchema = z.object({
  planId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  promoCode: z.string().trim().max(40).optional().or(z.literal("")),
  provider: z.enum(["mobile_money", "card"]).default("mobile_money"),
  phone: phoneSchema,
});

export const attemptSubmitSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.record(z.union([z.number().int().min(0), z.string().max(4000)])),
});

export const aiChatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  message: z.string().trim().min(3, "Message trop court").max(2000, "Message trop long (2000 caractères)"),
});

export const generateCourseSchema = z.object({
  schoolId: z.string().uuid(),
  topic: z.string().trim().min(5, "Sujet trop court").max(160),
  level: z.enum(["debutant", "intermediaire", "avance"]),
  durationHours: z.coerce.number().min(2).max(120),
  audience: z.string().trim().max(200).optional().or(z.literal("")),
  objectives: z.string().trim().max(600).optional().or(z.literal("")),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Premier message d'erreur d'un résultat zod, formaté pour l'UI. */
export function firstError(error: z.ZodError): string {
  return error.errors[0]?.message ?? "Données invalides.";
}
