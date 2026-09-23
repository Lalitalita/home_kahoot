import { Navigate, Route, Routes } from "react-router-dom";

import PrepGate from "./components/PrepGate.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import AdminBudget from "./pages/admin/Budget.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminGuests from "./pages/admin/GuestsAdmin.jsx";
import AdminLogin from "./pages/admin/Login.jsx";
import AdminMessages from "./pages/admin/MessagesAdmin.jsx";
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
        path="/admin/invites"
        element={
          <RequireAdmin>
            <AdminGuests />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/budget"
        element={
          <RequireAdmin>
            <AdminBudget />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/planning"
        element={
          <RequireAdmin>
            <AdminPlanning />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/questions"
        element={
          <RequireAdmin>
            <AdminQuestions />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/messages"
        element={
          <RequireAdmin>
            <AdminMessages />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/soiree"
        element={
          <RequireAdmin>
            <AdminPartyControl />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/resultats"
        element={
          <RequireAdmin>
            <AdminResults />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
