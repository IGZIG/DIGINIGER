import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { ContactForm } from "@/components/forms/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe DIGINIGER : formations, partenariats, programme formateurs.",
};

const INFO = [
  { icon: MapPin, label: "Adresse", value: "Avenue de l'Indépendance, Niamey, Niger" },
  { icon: Mail, label: "Email", value: "contact@diginiger.ne", href: "mailto:contact@diginiger.ne" },
  { icon: Phone, label: "Téléphone", value: "+227 80 61 09 93", href: "tel:+22780610993" },
  { icon: Clock, label: "Horaires", value: "Lundi — vendredi, 09h00 à 18h00 (GMT+1)" },
];

export default function ContactPage() {
  return (
    <div className="container-page py-14">
      <SectionTitle
        eyebrow="Contact"
        title="Parlons de votre projet de formation."
        description="Une question sur une formation, un partenariat, le programme formateurs ou un problème technique ? Écrivez-nous : nous répondons sous 48 heures ouvrées."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <aside className="space-y-3">
          {INFO.map((item) => (
            <div key={item.label} className="rounded-2xl border border-night-100 bg-white p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-50 text-electric-600">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-300">
                  {item.label}
                </p>
              </div>
              {item.href ? (
                <a href={item.href} className="mt-2.5 block text-sm font-medium text-night-700 hover:text-electric-600">
                  {item.value}
                </a>
              ) : (
                <p className="mt-2.5 text-sm font-medium text-night-700">{item.value}</p>
              )}
            </div>
          ))}
        </aside>

        <section className="rounded-3xl border border-night-100 bg-white p-6 shadow-soft sm:p-8">
          <h2 className="text-lg font-semibold">Envoyer un message</h2>
          <p className="mt-1 text-sm text-night-400">Les champs marqués d&apos;un astérisque sont obligatoires.</p>
          <div className="mt-6">
            <ContactForm kind="contact" submitLabel="Envoyer le message" />
          </div>
        </section>
      </div>
    </div>
  );
}
