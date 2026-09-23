import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Confetti from "../../components/Confetti.jsx";
import QuizProgress from "../../components/QuizProgress.jsx";
import { CHOICE_STYLES } from "../../components/quizTheme.js";
import { wsUrl } from "../../ws.js";

export default function Controller() {
  const navigate = useNavigate();
  const nickname = localStorage.getItem("player_nickname");
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(localStorage.getItem("player_id"));
  const [state, setState] = useState(null);
  const [answeredQuestionId, setAnsweredQuestionId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!nickname) {
      navigate("/soiree");
      return;
    }

    const code = localStorage.getItem("guest_access_code") || "";
    const existingPlayerId = localStorage.getItem("player_id") || "";
    const params = new URLSearchParams({ nickname });
    if (code) params.set("guest_code", code);
    if (existingPlayerId) params.set("player_id", existingPlayerId);

    const ws = new WebSocket(wsUrl(`/ws/player?${params.toString()}`));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.type === "joined") {
        localStorage.setItem("player_id", data.player_id);
        setPlayerId(data.player_id);
      } else if (data.type === "state") {
        setState(data);
      } else if (data.type === "answer_result") {
        setLastResult(data);
      }
    };

    return () => ws.close();
  }, [nickname, navigate]);

  function submitAnswer(choiceIndex) {
    if (!state?.question || answeredQuestionId === state.question.id) return;
    setAnsweredQuestionId(state.question.id);
    setLastResult(null);
    wsRef.current?.send(JSON.stringify({ type: "answer", choice_index: choiceIndex }));
  }

  if (!nickname) return null;

  const phase = state?.phase;
  const hasAnswered = state?.question && answeredQuestionId === state.question.id;
  const myRank = state?.leaderboard?.findIndex((p) => p.player_id === playerId);
  const myScore = myRank >= 0 ? state.leaderboard[myRank].score : 0;

  return (
    <div className="min-h-screen flex flex-col p-4 bg-ink-900">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-semibold">👤 {nickname}</span>
        <span className={`text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "Connecté" : "Reconnexion..."}
        </span>
      </div>

      {state?.total_questions > 0 && phase !== "lobby" && phase !== "finished" && (
        <QuizProgress
          current={Math.min(state.question_index + 1, state.total_questions)}
          total={state.total_questions}
          className="mb-4"
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {!state || phase === "lobby" ? (
          <div className="space-y-3">
            <div className="text-5xl animate-pulse">⏳</div>
            <p className="text-ink-200 text-lg">En attente du début du quiz...</p>
            <p className="text-ink-500 text-sm">Regarde l'écran principal !</p>
          </div>
        ) : phase === "question" && !hasAnswered ? (
          <div className="w-full max-w-sm">
            <p className="text-ink-400 mb-4">Choisis ta réponse :</p>
            <div className="grid grid-cols-2 gap-3">
              {CHOICE_STYLES.map((style, i) => (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  className={`${style.bg} rounded-2xl aspect-square flex items-center justify-center text-4xl text-white shadow-lg active:scale-90 transition`}
                >
                  {style.shape}
                </button>
              ))}
            </div>
          </div>
        ) : phase === "question" && hasAnswered ? (
          <div className="space-y-3">
            <div className="text-5xl animate-bounce">✅</div>
            <p className="text-ink-200 text-lg">Réponse envoyée !</p>
            <p className="text-ink-500 text-sm">On attend les autres...</p>
          </div>
        ) : phase === "reveal" ? (
          <div className="space-y-3">
            {lastResult ? (
              <>
                <div className="text-5xl">{lastResult.is_correct ? "🎉" : "😬"}</div>
                <p className="text-xl font-bold text-white">
                  {lastResult.is_correct ? "Bonne réponse !" : "Raté !"}
                </p>
                {lastResult.is_correct && (
                  <p className="text-party-400 font-mono text-lg">+{lastResult.points} pts</p>
                )}
              </>
            ) : (
              <p className="text-ink-400">Temps écoulé, tu n'as pas répondu à temps.</p>
            )}
          </div>
        ) : phase === "leaderboard" ? (
          <div className="space-y-2">
            <div className="text-5xl">🏆</div>
            <p className="text-ink-200">Ton classement</p>
            <p className="text-4xl font-bold text-white">
              {myRank >= 0 ? `#${myRank + 1}` : "-"}
            </p>
            <p className="text-party-400 font-mono text-lg">{myScore} pts</p>
          </div>
        ) : phase === "finished" ? (
          <FinalResult playerId={playerId} state={state} />
        ) : null}
      </div>
    </div>
  );
}

function FinalResult({ playerId, state }) {
  const top3 = state?.top3 || [];
  const rank = top3.findIndex((p) => p.player_id === playerId);
  const isTop3 = rank >= 0;

  return (
    <div className="space-y-4">
      {isTop3 && <Confetti />}
      <div className="text-6xl">{isTop3 ? "🏆" : "🎉"}</div>
      <p className="text-2xl font-bold text-white">
        {isTop3 ? `Bravo, ${rank + 1}${rank === 0 ? "er" : "ème"} !` : "Merci d'avoir joué !"}
      </p>
      <p className="text-ink-400">Le classement final est affiché sur l'écran.</p>
      {playerId && (
        <a
          href={`/api/players/${playerId}/recap.pdf`}
          className="btn-primary inline-block"
          download
        >
          Télécharger mon récap (PDF)
        </a>
      )}
    </div>
  );
}
