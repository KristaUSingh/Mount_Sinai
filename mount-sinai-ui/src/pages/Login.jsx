import { useForm } from "react-hook-form";
import { supabase } from "../api/supabaseClient"; 
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

  const onSubmit = async ({ email, password }) => {
    //resets any previous error messages
    setError("");

    //signs in user using their email and password if account exists
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    //show error if they dont authnicate account of wrong password

    







    const user = data.user;

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id) // user.id matches the auth user’s ID
    .single();

  if (userError || !userData) {
    setError("Unable to find user role. Please contact support.");
    return;
  }

  const role = userData.role;

  setAuth({ isLoggedIn: true, role });

  if (role === "admin") {
    navigate("/admin");
  } else if (role === "agent") {
    navigate("/chat");
  } else {
    setError("Unknown role. Please contact support.");
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
