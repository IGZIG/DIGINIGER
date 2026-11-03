import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionTitle } from "@/components/ui/primitives";
import { SchoolIcon } from "@/components/marketing/school-icon";
import { ButtonLink } from "@/components/ui/button";
import { listPublicCourses, listSchools } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Nos six écoles",
  description:
    "Six écoles DIGINIGER : AI & Technology, Business & Entrepreneurship, Agriculture & Agro-industry, Finance & Accounting, Marketing & Commerce, Industry & Technical Trades.",
};

export default async function SchoolsPage() {
  const [schools, courses] = await Promise.all([listSchools(), listPublicCourses({ limit: 100 })]);

  const countBySchool = courses.reduce<Record<string, number>>((acc, course) => {
    if (course.school_slug) acc[course.school_slug] = (acc[course.school_slug] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="border-b border-night-100 bg-mist/60">
        <div className="container-page py-14">
          <SectionTitle
            eyebrow="Nos écoles"
            title="Six domaines, une même exigence de qualité."
            description="Chaque école réunit des formateurs praticiens et des parcours progressifs, conçus pour les réalités économiques du Niger et de l'Afrique de l'Ouest."
          />
        </div>
      </div>

      <div className="container-page py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {schools.map((school) => (
            <article
              key={school.id}
              className="group relative overflow-hidden rounded-3xl border border-night-100 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <div
                className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                style={{ backgroundColor: school.accent }}
                aria-hidden
              />
              <div className="flex items-start justify-between">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${school.accent}14`, color: school.accent }}
                >
                  <SchoolIcon name={school.icon} className="h-7 w-7" />
                </span>
                <span className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-night-500">
                  {countBySchool[school.slug] ?? 0} formation
                  {(countBySchool[school.slug] ?? 0) > 1 ? "s" : ""}
                </span>
              </div>

              <h2 className="mt-5 font-display text-xl font-semibold">{school.name_fr}</h2>
              <p className="mt-1 text-sm font-medium text-night-400">{school.tagline_fr}</p>
              <p className="mt-3 text-sm leading-relaxed text-night-500">{school.description_fr}</p>

              <Link
                href={`/ecoles/${school.slug}`}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600"
              >
                Voir l&apos;école
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-3xl bg-night-800 p-8 text-center">
          <h2 className="font-display text-2xl font-semibold text-white">
            Vous ne trouvez pas votre domaine ?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/60">
            Proposez une nouvelle école ou une formation spécifique : notre comité pédagogique étudie
            chaque demande.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/formateurs" variant="gold">Proposer une formation</ButtonLink>
            <ButtonLink href="/contact" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Nous écrire
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
