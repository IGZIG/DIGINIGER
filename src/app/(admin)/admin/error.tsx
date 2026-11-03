"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">L&apos;administration n&apos;a pas pu charger ces données</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-night-500">
        La session a peut-être expiré, ou la base a refusé la requête. Aucun indicateur n&apos;est
        affiché par défaut : nous préférons une erreur visible à des chiffres inventés.
      </p>
      <Button className="mt-4" onClick={reset}>Réessayer</Button>
    </div>
  );
}
