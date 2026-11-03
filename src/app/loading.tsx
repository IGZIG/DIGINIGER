export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-night-200 border-t-electric-500" />
        <p className="text-sm text-night-400">Chargement…</p>
      </div>
    </div>
  );
}
