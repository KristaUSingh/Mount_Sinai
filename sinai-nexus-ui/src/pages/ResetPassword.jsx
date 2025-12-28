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
} from "@mui/material";
import { motion } from "framer-motion";
import MSLogo from "../assets/MSLogo.png";

function ResetPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 🔐 Original logic preserved
  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: "http://localhost:5173/update-password",
      });

      if (error) throw error;

      setMessage(
        "If this email is registered, a reset link has been sent. Please check your inbox."
      );
    } catch (err) {
      setError(err.message || "Something went wrong. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-wrapper">
      <Paper
        elevation={6}
        className="auth-card"
        component={motion.div}
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        sx={{ maxWidth: 450 }}
      >
        {/* Sinai Logo */}
        <Box
          component="img"
          src={MSLogo}
          alt="Mount Sinai Logo"
          sx={{
            width: 130,
            mb: 2,
            display: "block",
            mx: "auto",
          }}
        />

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "#002F6C",
            textAlign: "center",
            mb: 1,
          }}
        >
          Reset Your Password
        </Typography>

        <Typography
          sx={{
            textAlign: "center",
            color: "#555",
            mb: 3,
            fontSize: "0.95rem",
          }}
        >
          Enter your email and we’ll send you a link to reset your password.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box display="flex" flexDirection="column" gap={2.5}>
            <TextField
              label="Email Address"
              fullWidth
              className="auth-input"
              {...register("email", { required: "Email is required" })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />

            {/* Gradient Button */}
            <Button
              type="submit"
              fullWidth
              className="ms-btn-main"
              sx={{ py: 1.4 }}
              disabled={loading}
            >
              {loading ? "SENDING..." : "SEND RESET LINK"}
            </Button>

            {/* Back to login */}
            <Typography
              sx={{
                textAlign: "center",
                mt: 0.2,
                fontSize: "0.9rem",
              }}
            >
              <span
                style={{
                  color: "#E41C77",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/login")}
              >
                Back to Login
              </span>
            </Typography>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}

export default ResetPassword;