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
      <div
        className={`card mb-6 flex items-center justify-between ${
          partyMode ? "border-party-400" : ""
        }`}
      >
        <div>
          <h2 className="font-semibold text-ink-50">Mode soirée</h2>
          <p className="text-sm text-ink-400">
            {partyMode === null ? "..." : partyMode ? "Activé" : "Désactivé"}
          </p>
        </div>
        {hasPermission("party") && (
          <Link to="/admin/soiree" className="btn-primary">
            Gérer
          </Link>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasPermission("guests") && stats.guests !== undefined && (
          <StatCard label="Invités" value={stats.guests} to="/admin/invites" />
        )}
        {hasPermission("budget") && stats.budgetTotal !== undefined && (
          <StatCard
            label={`Budget prévu${stats.budgetTarget ? ` / ${stats.budgetTarget} €` : ""}`}
            value={`${stats.budgetTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`}
            to="/admin/budget"
            highlight={stats.budgetOver}
          />
        )}
        {hasPermission("questions") && stats.pendingQuestions !== undefined && (
          <>
            <StatCard
              label="Questions en attente"
              value={stats.pendingQuestions}
              to="/admin/questions"
              highlight={stats.pendingQuestions > 0}
            />
            <StatCard
              label="Questions acceptées"
              value={stats.acceptedQuestions}
              to="/admin/questions"
            />
          </>
        )}
        {hasPermission("messages") && stats.messages !== undefined && (
          <StatCard label="Messages" value={stats.messages} to="/admin/messages" />
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, to, highlight }) {
  return (
    <Link to={to} className={`card hover:border-party-300 transition ${highlight ? "border-amber-400" : ""}`}>
      <div className="text-2xl font-semibold text-ink-50">{value}</div>
      <div className="text-sm text-ink-400 mt-1">{label}</div>
    </Link>
  );
}
