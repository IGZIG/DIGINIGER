import Link from "next/link";

/** Mise en page commune aux documents légaux. */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-4">Document légal</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-night-400">{updatedAt}</p>
        <nav aria-label="Documents légaux" className="mt-6 flex flex-wrap gap-2 text-xs">
          {[
            { href: "/conditions-utilisation", label: "Conditions d'utilisation" },
            { href: "/confidentialite", label: "Confidentialité" },
            { href: "/mentions-legales", label: "Mentions légales" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-night-200 px-3 py-1.5 font-medium text-night-600 hover:border-electric-300 hover:text-electric-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="prose-diginiger mt-8 rounded-3xl border border-night-100 bg-white p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
