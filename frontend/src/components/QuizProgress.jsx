// Shows overall progress through the quiz (not to be confused with the
// per-question countdown timer): "Question 3 / 8" plus a filled bar.
export default function QuizProgress({ current, total, className = "" }) {
  if (!total) return null;
  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs text-ink-400 mb-1">
        <span>
          Question {current} / {total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="w-full h-1.5 bg-ink-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-party-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
