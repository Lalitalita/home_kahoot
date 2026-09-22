import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [partyMode, setPartyMode] = useState(null);

  useEffect(() => {
    async function load() {
      const [guests, questions, messages, settings, budget] = await Promise.all([
        api.get("/api/admin/guests", { auth: true }),
        api.get("/api/admin/questions", { auth: true }),
        api.get("/api/messages"),
        api.get("/api/settings"),
        api.get("/api/admin/budget/summary", { auth: true }),
      ]);
      setStats({
        guests: guests.length,
        pendingQuestions: questions.filter((q) => q.status === "pending").length,
        acceptedQuestions: questions.filter((q) => q.status === "accepted").length,
        messages: messages.length,
        budgetTotal: budget.total,
        budgetTarget: budget.budget_target,
        budgetOver: budget.remaining !== null && budget.remaining < 0,
      });
      setPartyMode(settings.party_mode_active);
    }
    load();
  }, []);

  return (
    <AdminLayout title="Tableau de bord">
      <div
        className={`card mb-6 flex items-center justify-between ${
          partyMode ? "border-party-500" : ""
        }`}
      >
        <div>
          <h2 className="font-semibold text-white">Mode soirée</h2>
          <p className="text-sm text-slate-400">
            {partyMode === null ? "..." : partyMode ? "Activé 🎉" : "Désactivé"}
          </p>
        </div>
        <Link to="/admin/soiree" className="btn-primary">
          Gérer
        </Link>
      </div>

      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Invités" value={stats.guests} to="/admin/invites" />
          <StatCard
            label={`Budget prévu${stats.budgetTarget ? ` / ${stats.budgetTarget} €` : ""}`}
            value={`${stats.budgetTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`}
            to="/admin/budget"
            highlight={stats.budgetOver}
          />
          <StatCard
            label="Questions en attente"
            value={stats.pendingQuestions}
            to="/admin/questions"
            highlight={stats.pendingQuestions > 0}
          />
          <StatCard label="Questions acceptées" value={stats.acceptedQuestions} to="/admin/questions" />
          <StatCard label="Messages" value={stats.messages} to="/admin/messages" />
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, to, highlight }) {
  return (
    <Link to={to} className={`card hover:border-party-600 transition ${highlight ? "border-amber-500" : ""}`}>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </Link>
  );
}
