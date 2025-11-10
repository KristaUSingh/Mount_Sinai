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
import MSLogo from "../assets/MSLogo.png"; // Mount Sinai Logo

function ResetPassword() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: "http://localhost:5173/update-password", // change if deployed
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
        elevation={6}
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
          style={{ width: "120px", marginBottom: "20px" }}
        />

        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            color: "#002F6C",
            mb: 1,
          }}
        >
          Reset Password
        </Typography>

        <Typography variant="body2" sx={{ color: "#555", mb: 3 }}>
          Enter your email address and we’ll send you a link to reset your password.
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <TextField
            label="Email Address"
            fullWidth
            margin="normal"
            {...register("email", { required: "Email is required" })}
            error={!!errors.email}
            helperText={errors.email?.message}
          />

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}

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
            disabled={loading}
          >
            {loading ? "SENDING..." : "SEND RESET LINK"}
          </Button>

          <Button
            onClick={() => navigate("/login")}
            fullWidth
            sx={{
              mt: 2,
              fontWeight: 600,
              color: "#E41C77",
              textTransform: "uppercase",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Back to Login
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default ResetPassword;
