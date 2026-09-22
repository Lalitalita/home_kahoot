const COLORS = ["#f472b6", "#d946ef", "#facc15", "#4ade80", "#60a5fa", "#fb923c"];

export default function Confetti({ count = 80 }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const duration = 3 + Math.random() * 2.5;
    const color = COLORS[i % COLORS.length];
    const rotate = Math.random() * 360;
    return (
      <span
        key={i}
        className="confetti-piece animate-confetti"
        style={{
          left: `${left}vw`,
          backgroundColor: color,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          transform: `rotate(${rotate}deg)`,
        }}
      />
    );
  });

  return <div className="pointer-events-none fixed inset-0 overflow-hidden">{pieces}</div>;
}
