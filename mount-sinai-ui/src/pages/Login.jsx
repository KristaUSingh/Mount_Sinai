import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
} from "@mui/material";

function Login({ setAuth }) {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const onSubmit = ({ email, password }) => {
    // Get stored user (from localStorage, set during Signup)
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (!storedUser) {
      setError("No user found. Please sign up first.");
      return;
    }

    if (storedUser.email === email && storedUser.password === password) {
      setAuth({ isLoggedIn: true, role: storedUser.role });

      navigate(storedUser.role === "admin" ? "/admin" : "/chat");
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      bgcolor="background.default"
    >
      <Paper elevation={3} sx={{ p: 4, width: 400 }}>
        <Typography variant="h5" color="primary" gutterBottom>
          Mount Sinai Radiology Login
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)}>
          <TextField
            {...register("email")}
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            required
          />
          <TextField
            {...register("password")}
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Don’t have an account?{" "}
          <Link href="/signup" underline="hover" color="secondary">
            Sign up here
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}

export default Login;
