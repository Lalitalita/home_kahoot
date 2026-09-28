import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api.js";
import Confetti from "../../components/Confetti.jsx";
import {
  CheckCircleIcon,
  ConfettiIcon,
  CrystalBallIcon,
  FrownIcon,
  HourglassIcon,
  MailIcon,
  TargetIcon,
  TrophyIcon,
  UserIcon,
} from "../../components/icons.jsx";
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
    <div className="min-h-dvh flex flex-col safe-p bg-ink-900 party-scale-down">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-semibold flex items-center gap-1.5">
          <UserIcon size={18} /> {nickname}
        </span>
        <span className={`text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
          {connected ? "Connecté" : "Reconnexion..."}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {!state || phase === "lobby" ? (
          <div className="space-y-3 w-full max-w-sm">
            <HourglassIcon size={48} className="mx-auto text-party-400 animate-pulse" />
            <p className="text-ink-200 text-lg">En attente du début du quiz...</p>
            <p className="text-ink-500 text-sm">Regarde l'écran principal !</p>
            {state?.leaderboard?.length >= 2 && (
              <PredictionForm playerId={playerId} leaderboard={state.leaderboard} />
            )}
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
            <CheckCircleIcon size={48} className="mx-auto text-emerald-400 animate-bounce" />
            <p className="text-ink-200 text-lg">Réponse envoyée !</p>
            <p className="text-ink-500 text-sm">On attend les autres...</p>
          </div>
        ) : phase === "reveal" ? (
          <div className="space-y-3">
            {!hasAnswered ? (
              <p className="text-ink-400">Temps écoulé, tu n'as pas répondu à temps.</p>
            ) : lastResult ? (
              <>
                {lastResult.is_correct ? (
                  <ConfettiIcon size={48} className="mx-auto text-party-400" />
                ) : (
                  <FrownIcon size={48} className="mx-auto text-rose-400" />
                )}
                <p className="text-xl font-bold text-white">
                  {lastResult.is_correct ? "Bonne réponse !" : "Raté !"}
                </p>
                {lastResult.is_correct && (
                  <p className="text-party-400 font-mono text-lg">+{lastResult.points} pts</p>
                )}
              </>
            ) : (
              <>
                <HourglassIcon size={36} className="mx-auto text-ink-400 animate-pulse" />
                <p className="text-ink-400">Calcul du résultat...</p>
              </>
            )}
          </div>
        ) : phase === "leaderboard" ? (
          <div className="space-y-2">
            <TrophyIcon size={48} className="mx-auto text-amber-400" />
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
  const myPrediction = (state?.predictions || []).find((p) => p.player_id === playerId);

  return (
    <div className="space-y-4 w-full max-w-sm">
      {isTop3 && <Confetti />}
      {isTop3 ? (
        <TrophyIcon size={64} className="mx-auto text-amber-400" />
      ) : (
        <ConfettiIcon size={64} className="mx-auto text-party-400" />
      )}
      <p className="text-2xl font-bold text-white">
        {isTop3 ? `Bravo, ${rank + 1}${rank === 0 ? "er" : "ème"} !` : "Merci d'avoir joué !"}
      </p>
      <p className="text-ink-400">Le classement final est affiché sur l'écran.</p>
      <p className="text-ink-500 text-sm flex items-center justify-center gap-1.5">
        <MailIcon size={15} /> Ton récap t'a été envoyé par email
      </p>
      {myPrediction && (
        <div className="bg-ink-800/70 rounded-xl p-3 text-sm text-left">
          <p className="text-magenta-400 font-semibold mb-1 flex items-center gap-1.5">
            <CrystalBallIcon size={16} /> Ton pronostic
          </p>
          <p className="text-ink-300 flex items-center gap-1.5">
            {myPrediction.correct_slots === 3 ? (
              <>
                Pile poil, chapeau ! <TargetIcon size={14} className="text-party-400" />
              </>
            ) : myPrediction.correct_slots > 0 ? (
              `${myPrediction.correct_slots}/3 bonnes places trouvées`
            ) : (
              "Aucune place trouvée, tentative honorable !"
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function PredictionForm({ playerId, leaderboard }) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const names = leaderboard.map((p) => p.nickname);
  const taken = [first, second, third].filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    if (!first || !second || !third) return;
    setError("");
    try {
      await api.post(`/api/predictions?player_id=${playerId}`, {
        first_nickname: first,
        second_nickname: second,
        third_nickname: third,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Erreur, réessaie.");
    }
  }

  if (submitted) {
    return (
      <div className="bg-ink-800/70 rounded-xl p-3 text-sm text-party-300 flex items-start gap-1.5">
        <CrystalBallIcon size={16} className="shrink-0 mt-0.5" />
        <span>
          Pronostic enregistré ! Tu peux le changer tant que le quiz n'a pas démarré.
          <button className="block mt-1 text-ink-400 underline" onClick={() => setSubmitted(false)}>
            Modifier
          </button>
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-ink-800/70 rounded-xl p-3 space-y-2 text-left">
      <p className="text-sm text-magenta-400 font-semibold flex items-center gap-1.5">
        <CrystalBallIcon size={16} /> Pronostique le podium
      </p>
      {[
        ["1er", first, setFirst],
        ["2ème", second, setSecond],
        ["3ème", third, setThird],
      ].map(([label, value, setter]) => (
        <select
          key={label}
          className="input w-full text-sm"
          value={value}
          onChange={(e) => setter(e.target.value)}
        >
          <option value="">{label}...</option>
          {names
            .filter((n) => n === value || !taken.includes(n))
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </select>
      ))}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={!first || !second || !third}
        className="btn-primary w-full py-2 text-sm disabled:opacity-40"
      >
        Valider mon pronostic
      </button>
    </form>
  );
}
