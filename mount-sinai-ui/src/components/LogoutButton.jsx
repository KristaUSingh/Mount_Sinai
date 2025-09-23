import { useNavigate } from "react-router-dom";

function LogoutButton({ setAuth }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear stored user info
    localStorage.removeItem("user");

    // Reset auth state
    setAuth({ isLoggedIn: false, role: null });

    // Redirect to login page
    navigate("/login");
  };

  return <button onClick={handleLogout}>Logout</button>;
}

export default LogoutButton;
