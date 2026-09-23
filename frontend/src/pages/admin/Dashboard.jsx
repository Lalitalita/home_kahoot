import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminDashboard() {
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState({});
  const [partyMode, setPartyMode] = useState(null);

  useEffect(() => {
    api.get("/api/settings").then((s) => setPartyMode(s.party_mode_active));

    if (hasPermission("guests")) {
      api
        .get("/api/admin/guests", { auth: true })
        .then((guests) => setStats((s) => ({ ...s, guests: guests.length })))
        .catch(() => {});
    }
    if (hasPermission("questions")) {
      api
        .get("/api/admin/questions", { auth: true })
        .then((questions) =>
          setStats((s) => ({
            ...s,
            pendingQuestions: questions.filter((q) => q.status === "pending").length,
            acceptedQuestions: questions.filter((q) => q.status === "accepted").length,
          }))
        )
        .catch(() => {});
    }
    if (hasPermission("messages")) {
      api
        .get("/api/messages")
        .then((messages) => setStats((s) => ({ ...s, messages: messages.length })))
        .catch(() => {});
    }
    if (hasPermission("budget")) {
      api
        .get("/api/admin/budget/summary", { auth: true })
        .then((budget) =>
          setStats((s) => ({
            ...s,
            budgetTotal: budget.total,
            budgetTarget: budget.budget_target,
            budgetOver: budget.remaining !== null && budget.remaining < 0,
          }))
        )
        .catch(() => {});
    }
  }, [hasPermission]);

  return (
    <AdminLayout title="Tableau de bord">
      <p className="text-sm text-ink-500 -mt-3 mb-6">Vue d'ensemble de l'organisation de la soirée.</p>

      <div
        className={`rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 border transition ${
          partyMode
            ? "bg-magenta-950/40 border-magenta-500 shadow-glow-magenta"
            : "bg-ink-850 border-ink-700"
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl shrink-0">{partyMode ? "🎉" : "🌙"}</span>
          <div>
            <h2 className="font-semibold text-ink-50">Mode soirée</h2>
            <p className={`text-sm ${partyMode ? "text-magenta-300" : "text-ink-400"}`}>
              {partyMode === null ? "..." : partyMode ? "Activé — le quiz est en ligne" : "Désactivé"}
            </p>
          </div>
        </div>
        {hasPermission("party") && (
          <Link to="/admin/soiree" className="btn-primary shrink-0">
            Gérer
          </Link>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasPermission("guests") && stats.guests !== undefined && (
          <StatCard icon="👥" label="Invités" value={stats.guests} to="/admin/invites" />
        )}
        {hasPermission("budget") && stats.budgetTotal !== undefined && (
          <StatCard
            icon="💶"
            label={`Budget prévu${stats.budgetTarget ? ` / ${stats.budgetTarget} €` : ""}`}
            value={`${stats.budgetTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`}
            to="/admin/budget"
            highlight={stats.budgetOver}
          />
        )}
        {hasPermission("questions") && stats.pendingQuestions !== undefined && (
          <>
            <StatCard
              icon="❓"
              label="Questions en attente"
              value={stats.pendingQuestions}
              to="/admin/questions"
              highlight={stats.pendingQuestions > 0}
            />
            <StatCard
              icon="✅"
              label="Questions acceptées"
              value={stats.acceptedQuestions}
              to="/admin/questions"
            />
          </>
        )}
        {hasPermission("messages") && stats.messages !== undefined && (
          <StatCard icon="💬" label="Messages" value={stats.messages} to="/admin/messages" />
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon, label, value, to, highlight }) {
  return (
    <Link
      to={to}
      className={`card flex items-start gap-3 hover:border-party-400 hover:-translate-y-0.5 transition ${
        highlight ? "border-amber-400" : ""
      }`}
    >
      <span className="w-10 h-10 rounded-xl bg-party-900/60 text-lg flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-semibold text-ink-50 leading-tight">{value}</div>
        <div className="text-sm text-ink-400 mt-0.5">{label}</div>
      </div>
    </Link>
  );
}
