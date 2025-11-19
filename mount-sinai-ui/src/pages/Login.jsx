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
import MSLogo from "../assets/MSLogo.png"; // ✅ Mount Sinai logo

function Login({ setAuth }) {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const onSubmit = async ({ email, password }) => {
    setError("");

    // Sign in with Supabase Auth
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {

    // Detect unverified email
    if (signInError.code === "email_not_confirmed") {
      // Always show this
      setError("Your email isn’t verified. Please check your inbox.");

      // Send verification email only once per session
      if (!emailSent) {
        try {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
          });

          if (!resendError) {
            setEmailSent(true);
          } else {
            console.error("Resend error:", resendError.message);
          }
        } catch (err) {
          console.error(err);
        }
      }
      return;
    }

    // Wrong email or password
    if (signInError.code === "invalid_credentials") {
      setError("Incorrect email or password.");
      return;
    }

    // Fallback for unexpected errors
    setError("Something went wrong. Please try again.");
    return;
  }

    const user = data.user;

    // Fetch role and name from your users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, first_name, last_name")
      .eq("user_id", user.id)
      .single();

    if (userError || !userData) {
      setError("Unable to find user information. Please contact support.");
      return;
    }

    // Store everything in app state
    setAuth({
      isLoggedIn: true,
      role: userData.role,
      firstName: userData.first_name,
      lastName: userData.last_name,
    });

    // ✅ Save to sessionStorage for refresh persistence
    sessionStorage.setItem(
      "auth",
      JSON.stringify({
        isLoggedIn: true,
        role: userData.role,
        firstName: userData.first_name,
        lastName: userData.last_name,
      })
    );

    // Route based on role
    if (userData.role === "admin") {
      navigate("/admin");
    } else if (userData.role === "agent") {
      navigate("/chat");
    } else {
      setError("Unknown role. Please contact support.");
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #E6F0FA 0%, #FFFFFF 100%)",
      }}
    >
      <Paper
        elevation={5}
        sx={{
          p: 4,
          width: 400,
          textAlign: "center",
          borderRadius: 4,
        }}
      >
        {/* Mount Sinai Logo */}
        <img
          src={MSLogo}
          alt="Mount Sinai Logo"
          style={{ width: "130px", marginBottom: "20px" }}
        />

        <Typography
          variant="h6"
          sx={{ fontWeight: "bold", color: "#002F6C", mb: 2 }}
        >
          Mount Sinai Radiology Login
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
            fullWidth
            sx={{
              mt: 3,
              py: 1,
              fontWeight: "bold",
              color: "white",
              background: "linear-gradient(90deg, #002F6C, #642F6C)",
              transition: "all 0.3s ease",
              "&:hover": {
                background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                transform: "scale(1.05)",
              },
            }}
          >
            LOGIN
          </Button>
        </form>

        <Typography variant="body2" sx={{ mt: 2 }}>
          Don’t have an account?{" "}
          <Link
            href="/signup"
            underline="hover"
            sx={{ color: "#E41C77", fontWeight: 500 }}
          >
            Sign up here
          </Link>
        </Typography>

        <Typography variant="body2" sx={{ mt: 1 }}>
          Forgot Password?{" "}
          <Link
            href="/resetpassword"
            underline="hover"
            sx={{ color: "#E41C77", fontWeight: 500 }}
          >
            Reset Password
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}

export default Login;
