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
  IconButton,
  InputAdornment,
} from "@mui/material";
import { motion } from "framer-motion";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MSLogo from "../assets/MSLogo.png";

function Login({ setAuth }) {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async ({ email, password }) => {
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      if (signInError.code === "email_not_confirmed") {
        setError("Your email isn’t verified. Please check your inbox.");

        if (!emailSent) {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
          });
          if (!resendError) setEmailSent(true);
        }
        setLoading(false);
        return;
      }

      if (signInError.code === "invalid_credentials") {
        setError("Incorrect email or password.");
        setLoading(false);
        return;
      }

      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const user = data.user;

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role, first_name, last_name")
      .eq("user_id", user.id)
      .single();

    if (userError || !userData) {
      setError("Unable to find user information. Please contact support.");
      setLoading(false);
      return;
    }

    setAuth({
      isLoggedIn: true,
      role: userData.role,
      firstName: userData.first_name,
      lastName: userData.last_name,
    });

    sessionStorage.setItem(
      "auth",
      JSON.stringify({
        isLoggedIn: true,
        role: userData.role,
        firstName: userData.first_name,
        lastName: userData.last_name,
      })
    );

    if (userData.role === "admin") navigate("/admin");
    else if (userData.role === "agent") navigate("/chat");
    else setError("Unknown role. Please contact support.");

    setLoading(false);
  };

  return (
    <Box className="auth-wrapper">
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="auth-card"
        sx={{ maxWidth: 450 }}
      >
        {/* Logo */}
        <Box
          component="img"
          src={MSLogo}
          alt="Mount Sinai Logo"
          sx={{
            width: 140,
            mb: 2,
            display: "block",
            mx: "auto",
          }}
        />

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            textAlign: "center",
            color: "#002F6C",
          }}
        >
          Welcome Back
        </Typography>

        <Typography
          sx={{
            textAlign: "center",
            mb: 3,
            color: "#555",
            fontSize: "0.95rem",
          }}
        >
          Log in to access your radiology tools.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              {...register("email")}
              label="Email"
              type="email"
              fullWidth
              required
              className="auth-input"
            />

            {/* Password with show/hide */}
            <TextField
              {...register("password")}
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              required
              className="auth-input"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              disabled={loading}
              className="ms-btn-main"
              sx={{ py: 1.4, fontSize: "1rem" }}
            >
              {loading ? "Logging in..." : "LOGIN"}
            </Button>

            {/* RESET PASSWORD */}
            <Typography
              sx={{
                textAlign: "center",
                mt: 1,
                fontSize: "0.9rem",
              }}
            >
              Forgot Password?{" "}
              <span
                style={{
                  color: "#E41C77",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/reset-password")}
              >
                Reset Password
              </span>
            </Typography>

            {/* SIGN UP */}
            <Typography
              sx={{
                mt: -1.5,
                textAlign: "center",
                fontSize: "0.9rem",
              }}
            >
              Don’t have an account?{" "}
              <span
                style={{
                  color: "#E41C77",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/signup")}
              >
                Sign up
              </span>
            </Typography>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}

export default Login;