import { useNavigate } from "react-router-dom";

function LogoutButton({ setAuth }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("auth");
    setAuth({ isLoggedIn: false, role: null, firstName: "", lastName: "" });
    navigate("/login");
  };  

  return <button onClick={handleLogout}>Logout</button>;
}

export default LogoutButton;
