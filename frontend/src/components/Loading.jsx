// Small, reusable loading indicator — replaces plain "Chargement..." text
// with a spinner so waits feel intentional rather than broken.
export default function Loading({ label = "Chargement...", className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 text-ink-500 py-6 ${className}`}>
      <span className="spinner" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
