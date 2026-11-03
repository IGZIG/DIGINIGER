"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input, Select, Label } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import type { School } from "@/types/database";

/** Filtres du catalogue : l'état vit dans l'URL (partageable, indexable). */
export function CourseFiltersBar({ schools, total }: { schools: School[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");

  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [params]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeCount = ["q", "ecole", "niveau", "tri", "prix"].filter((key) => params.get(key)).length;

  return (
    <div className="rounded-3xl border border-night-100 bg-white p-4 shadow-soft sm:p-5">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          update("q", search.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-night-300" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une formation, un formateur, une compétence…"
            aria-label="Rechercher une formation"
            className="pl-11"
          />
        </div>
        <Button type="submit" className="sm:w-auto">
          Rechercher
        </Button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="filtre-ecole">École</Label>
          <Select
            id="filtre-ecole"
            value={params.get("ecole") ?? ""}
            onChange={(event) => update("ecole", event.target.value)}
          >
            <option value="">Toutes les écoles</option>
            {schools.map((school) => (
              <option key={school.id} value={school.slug}>
                {school.name_fr}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="filtre-niveau">Niveau</Label>
          <Select
            id="filtre-niveau"
            value={params.get("niveau") ?? ""}
            onChange={(event) => update("niveau", event.target.value)}
          >
            <option value="">Tous les niveaux</option>
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtre-prix">Budget maximum</Label>
          <Select
            id="filtre-prix"
            value={params.get("prix") ?? ""}
            onChange={(event) => update("prix", event.target.value)}
          >
            <option value="">Tous les prix</option>
            <option value="0">Gratuit uniquement</option>
            <option value="20000">Jusqu&apos;à 20 000 FCFA</option>
            <option value="30000">Jusqu&apos;à 30 000 FCFA</option>
            <option value="50000">Jusqu&apos;à 50 000 FCFA</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="filtre-tri">Trier par</Label>
          <Select
            id="filtre-tri"
            value={params.get("tri") ?? "popular"}
            onChange={(event) => update("tri", event.target.value)}
          >
            <option value="popular">Les plus populaires</option>
            <option value="rating">Meilleures notes</option>
            <option value="priceAsc">Prix croissant</option>
            <option value="priceDesc">Prix décroissant</option>
            <option value="duration">Durée croissante</option>
          </Select>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-night-100 pt-3">
          <p className="text-xs text-night-400">
            {activeCount} filtre{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""} ·{" "}
            {total} résultat{total > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="inline-flex items-center gap-1 text-xs font-medium text-electric-600 hover:underline"
          >
            <X className="h-3 w-3" aria-hidden />
            Réinitialiser
          </button>
        </div>
      )}
    </div>
  );
}
