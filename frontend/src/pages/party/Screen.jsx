import { useEffect, useRef, useState } from "react";

import Confetti from "../../components/Confetti.jsx";
import QuizProgress from "../../components/QuizProgress.jsx";
import { CHOICE_STYLES } from "../../components/quizTheme.js";
import { wsUrl } from "../../ws.js";

export default function Screen() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(wsUrl("/ws/screen"));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };
      ws.onmessage = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === "state") setState(data);
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  const phase = state?.phase;

  return (
    <div className="min-h-screen bg-ink-900 text-white flex flex-col p-8 overflow-hidden">
      {!connected && (
        <div className="fixed top-3 right-3 text-xs text-red-400 bg-ink-900/80 px-3 py-1 rounded-full">
          Connexion au serveur...
        </div>
      )}

      {!state || phase === "lobby" ? (
        <Lobby state={state} />
      ) : phase === "question" ? (
        <QuestionView state={state} />
      ) : phase === "reveal" ? (
        <RevealView state={state} />
      ) : phase === "leaderboard" ? (
        <LeaderboardView state={state} />
      ) : phase === "finished" ? (
        <FinishedView state={state} />
      ) : null}
    </div>
  );
}

function Lobby({ state }) {
  const origin = window.location.origin;
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <h1 className="font-display text-6xl font-extrabold">🎉 Quiz d'anniversaire 🎉</h1>
      <p className="text-2xl text-ink-200">
        Rejoins sur <span className="font-mono text-party-400">{origin}/soiree</span>
      </p>
      <div className="text-xl text-ink-400">
        {state?.players_count ?? 0} participant(s) connecté(s)
      </div>
      <div className="flex flex-wrap gap-3 justify-center max-w-3xl">
        {(state?.leaderboard || []).map((p) => (
          <span
            key={p.player_id}
            className="bg-ink-800 rounded-full pl-2 pr-4 py-2 text-lg flex items-center gap-2 animate-pop-in"
          >
            {p.photo_url ? (
              <img src={p.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-ink-700 flex items-center justify-center text-sm">
                🙂
              </span>
            )}
            {p.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

function Timer({ startedAt, durationSeconds }) {
  const [progress, setProgress] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationSeconds));

  useEffect(() => {
    let raf;
    function tick() {
      const elapsed = Date.now() / 1000 - startedAt;
      const remaining = Math.max(0, 1 - elapsed / durationSeconds);
      setProgress(remaining);
      setSecondsLeft(Math.max(0, Math.ceil(durationSeconds - elapsed)));
      if (remaining > 0) raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [startedAt, durationSeconds]);

  return (
    <div className="max-w-md mx-auto w-full flex items-center gap-3">
      <span className="text-xl shrink-0" aria-hidden="true">
        ⏱️
      </span>
      <div className="flex-1 h-2.5 bg-ink-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-[width] duration-100 ${
            progress > 0.3 ? "bg-party-500" : "bg-red-500"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="font-mono text-sm text-ink-300 w-6 text-right shrink-0">{secondsLeft}</span>
    </div>
  );
}

function QuestionView({ state }) {
  const q = state.question;
  return (
    <div className="flex-1 flex flex-col">
      <QuizProgress
        current={state.question_index + 1}
        total={state.total_questions}
        className="max-w-4xl mx-auto w-full mb-3"
      />
      <Timer startedAt={q.started_at} durationSeconds={q.time_limit_seconds} />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6">
        <h2 className="font-display text-4xl font-bold text-center max-w-4xl">{q.text}</h2>
        {q.image_url && (
          <img src={q.image_url} alt="" className="max-h-64 rounded-2xl shadow-2xl" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
        {q.choices.map((choice, i) => (
          <div
            key={i}
            className={`${CHOICE_STYLES[i].bg} rounded-2xl p-5 flex items-center gap-4 text-2xl font-semibold shadow-lg`}
          >
            <span className="text-3xl">{CHOICE_STYLES[i].shape}</span>
            {choice}
          </div>
        ))}
      </div>
    </div>
  );
}

function RevealView({ state }) {
  const q = state.question;
  const counts = state.answer_counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex-1 flex flex-col justify-center gap-6 max-w-4xl mx-auto w-full">
      <QuizProgress current={state.question_index + 1} total={state.total_questions} />
      <h2 className="font-display text-3xl font-bold text-center">{q.text}</h2>
      <div className="space-y-4">
        {q.choices.map((choice, i) => {
          const count = counts[i] || 0;
          const pct = Math.round((count / total) * 100);
          const isCorrect = i === state.correct_index;
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className={`rounded-xl w-12 h-12 flex items-center justify-center text-2xl shrink-0 ${
                  isCorrect ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {isCorrect ? "✓" : "✕"}
              </span>
              <div className="flex-1 bg-ink-800 rounded-xl overflow-hidden relative h-12 border border-ink-700">
                <div
                  className={`h-full transition-all duration-700 ${
                    isCorrect ? "bg-green-500" : "bg-red-500/70"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-between px-4 text-base font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{CHOICE_STYLES[i].shape}</span>
                    {choice}
                  </span>
                  <span className="font-mono text-lg">{pct}%</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderboardView({ state }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <h2 className="font-display text-5xl font-extrabold">🏆 Classement 🏆</h2>
      <div className="w-full max-w-xl space-y-2">
        {state.leaderboard.map((p, i) => (
          <div
            key={p.player_id}
            className={`flex items-center justify-between rounded-2xl px-5 py-3 text-xl animate-pop-in ${
              i === 0
                ? "bg-amber-500 text-slate-950 font-bold"
                : i === 1
                ? "bg-slate-300 text-slate-950 font-bold"
                : i === 2
                ? "bg-amber-700 text-white font-bold"
                : "bg-ink-800"
            }`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="flex items-center gap-3">
              <span className="w-8">#{i + 1}</span>
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : null}
              {p.nickname}
            </span>
            <span className="font-mono">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishedView({ state }) {
  const top3 = state.top3 || [];
  const order = [1, 0, 2].filter((i) => top3[i]);
  const heights = ["h-40", "h-56", "h-28"];
  const medals = ["🥈", "🥇", "🥉"];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <Confetti count={120} />
      <h2 className="font-display text-5xl font-extrabold text-center">
        🎉 Merci d'avoir joué ! 🎉
      </h2>
      <div className="flex items-end gap-6">
        {order.map((i) => (
          <div key={top3[i].player_id} className="flex flex-col items-center gap-2">
            <div className="text-4xl">{medals[i]}</div>
            <div className="text-xl font-bold">{top3[i].nickname}</div>
            <div className="font-mono text-party-300">{top3[i].score} pts</div>
            <div className={`w-32 ${heights[i]} bg-party-700 rounded-t-2xl`} />
          </div>
        ))}
      </div>
    </div>
  );
}
