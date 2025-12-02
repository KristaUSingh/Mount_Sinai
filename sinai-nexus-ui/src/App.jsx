import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import AgentChat from "./pages/AgentChat";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";

function App() {
  const [auth, setAuth] = useState({ isLoggedIn: false, role: null, firstName: "", lastName: "" });
  const [loading, setLoading] = useState(true);

  // ✅ Restore session on refresh
  useEffect(() => {
    const storedAuth = sessionStorage.getItem("auth");
    if (storedAuth) {
      setAuth(JSON.parse(storedAuth));
    }
    setLoading(false); // Done checking storage
  }, []);

  // 🚦 Don’t render routes until session check is done
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#002F6C",
          fontWeight: "bold",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Default */}
        <Route path="/" element={<Landing />} />

        {/* Auth Pages */}
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Agent Dashboard */}
        <Route
          path="/chat"
          element={
            auth.isLoggedIn && auth.role === "agent" ? (
              <AgentChat auth={auth} />
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
              <AdminDashboard auth={auth} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
