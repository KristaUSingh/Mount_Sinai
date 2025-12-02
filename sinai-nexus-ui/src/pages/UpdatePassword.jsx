import { useState } from "react";
import { supabase } from "../api/supabaseClient";
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
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MSLogo from "../assets/MSLogo.png";

function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const test_password = (value) => {
    const newErrors = [];
    if (value.length < 8) newErrors.push("At least 8 characters");
    if (!/[A-Z]/.test(value)) newErrors.push("At least one uppercase letter");
    if (!/[a-z]/.test(value)) newErrors.push("At least one lowercase letter");
    if (!/[0-9]/.test(value)) newErrors.push("At least one number");
    if (!/[!@#$%^&*]/.test(value))
      newErrors.push("At least one special character (!@#$%^&*)");
    return newErrors;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const check_password = test_password(password);

    if (check_password.length > 0) {
      setError("Password must include: " + check_password.join(", "));
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Password updated successfully! You can now log in.");
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
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
          Set a New Password
        </Typography>

        <Typography
          sx={{
            textAlign: "center",
            color: "#555",
            mb: 3,
            fontSize: "0.95rem",
          }}
        >
          Enter your new password below to reset your account.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        <form onSubmit={handleUpdate}>
          <Box display="flex" flexDirection="column" gap={2.5}>
            {/* New password with toggle */}
            <TextField
              label="New Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((p) => !p)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Confirm password with toggle */}
            <TextField
              label="Confirm Password"
              type={showConfirm ? "text" : "password"}
              fullWidth
              className="auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirm((p) => !p)}
                        edge="end"
                      >
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              className="ms-btn-main"
              disabled={loading}
              sx={{ py: 1.4 }}
            >
              {loading ? "UPDATING..." : "UPDATE PASSWORD"}
            </Button>

            <Typography
              sx={{
                textAlign: "center",
                mt: -1,
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

export default UpdatePassword;