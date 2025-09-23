import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import AgentChat from "./pages/AgentChat";
import NotFound from "./pages/NotFound";

function App() {
  const [auth, setAuth] = useState({ isLoggedIn: false, role: null });

  return (
    <Router>
      <Routes>
        {/* Default: redirect to login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Auth Pages */}
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        <Route path="/signup" element={<Signup />} />

        {/* Agent Dashboard */}
        <Route
          path="/chat"
          element={
            auth.isLoggedIn && auth.role === "agent" ? (
              <AgentChat />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            auth.isLoggedIn && auth.role === "admin" ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Catch-all for unknown routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
