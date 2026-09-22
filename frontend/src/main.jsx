import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PartyModeProvider } from "./context/PartyModeContext.jsx";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PartyModeProvider>
          <App />
        </PartyModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
