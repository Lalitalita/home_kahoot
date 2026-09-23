import { Navigate, Route, Routes } from "react-router-dom";

import PrepGate from "./components/PrepGate.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import AdminAccounts from "./pages/admin/Accounts.jsx";
import AdminBudget from "./pages/admin/Budget.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminGuests from "./pages/admin/GuestsAdmin.jsx";
import AdminLogin from "./pages/admin/Login.jsx";
import AdminMessages from "./pages/admin/MessagesAdmin.jsx";
import MyAccount from "./pages/admin/MyAccount.jsx";
import AdminPartyControl from "./pages/admin/PartyControl.jsx";
import AdminPlanning from "./pages/admin/Planning.jsx";
import AdminQuestions from "./pages/admin/QuestionsAdmin.jsx";
import AdminResults from "./pages/admin/Results.jsx";
import GuestList from "./pages/GuestList.jsx";
import GuestProfile from "./pages/GuestProfile.jsx";
import Home from "./pages/Home.jsx";
import MessageWall from "./pages/MessageWall.jsx";
import Controller from "./pages/party/Controller.jsx";
import Join from "./pages/party/Join.jsx";
import Screen from "./pages/party/Screen.jsx";
import QuestionSubmit from "./pages/QuestionSubmit.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PrepGate><Home /></PrepGate>} />
      <Route path="/invites" element={<PrepGate><GuestList /></PrepGate>} />
      <Route path="/invites/:accessCode" element={<PrepGate><GuestProfile /></PrepGate>} />
      <Route path="/quiz/proposer" element={<PrepGate><QuestionSubmit /></PrepGate>} />
      <Route path="/mur" element={<MessageWall />} />

      <Route path="/soiree" element={<Join />} />
      <Route path="/soiree/manette" element={<Controller />} />
      <Route path="/soiree/ecran" element={<Screen />} />

      <Route path="/admin/connexion" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/mon-compte"
        element={
          <RequireAdmin>
            <MyAccount />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/comptes"
        element={
          <RequireAdmin ownerOnly>
            <AdminAccounts />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/invites"
        element={
          <RequireAdmin section="guests">
            <AdminGuests />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/budget"
        element={
          <RequireAdmin section="budget">
            <AdminBudget />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/planning"
        element={
          <RequireAdmin section="planning">
            <AdminPlanning />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <RequireAdmin section="questions">
            <AdminQuestions />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/messages"
        element={
          <RequireAdmin section="messages">
            <AdminMessages />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/soiree"
        element={
          <RequireAdmin section="party">
            <AdminPartyControl />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/resultats"
        element={
          <RequireAdmin section="results">
            <AdminResults />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
