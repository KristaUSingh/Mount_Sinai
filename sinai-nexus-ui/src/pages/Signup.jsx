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
  MenuItem,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { motion } from "framer-motion";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MSLogo from "../assets/MSLogo.png";

function Signup() {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const onSubmit = async ({ firstName, lastName, email, password, role }) => {
    setError("");
    setSuccess("");

    const check_password = test_password(password);
    if (check_password.length > 0) {
      setError("Password must include: " + check_password.join(", "));
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: "http://sinainexus.vercel.app/login" },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        const { error: dbError } = await supabase.from("users").insert([
          {
            email,
            user_id: data.user.id,
            role,
            first_name: firstName,
            last_name: lastName,
            login_time: new Date(),
          },
        ]);

        if (dbError?.code === "23505") {
          setError("Account already exists. Login or reset password.");
          return;
        }
        if (dbError) throw dbError;
      }

      setSuccess(
        "Signup successful! Please check your email to verify your account."
      );
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Something went wrong during signup.");
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
            width: 140,
            mb: 2,
            display: "block",
            mx: "auto",
          }}
        />

        <Typography
          variant="h5"
          sx={{
            textAlign: "center",
            fontWeight: 700,
            color: "#002F6C",
            mb: 1,
          }}
        >
          Create Your Account
        </Typography>

        <Typography
          sx={{
            textAlign: "center",
            mb: 3,
            color: "#555",
            fontSize: "0.95rem",
          }}
        >
          Sign up to access Mount Sinai Radiology tools.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Box display="flex" flexDirection="column" gap={2.5}>
            <TextField
              {...register("firstName")}
              label="First Name"
              fullWidth
              required
              className="auth-input"
            />

            <TextField
              {...register("lastName")}
              label="Last Name"
              fullWidth
              required
              className="auth-input"
            />

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

            <TextField
              {...register("role")}
              select
              label="Select Role"
              fullWidth
              required
              className="auth-input"
            >
              <MenuItem value="agent">Agent</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>

            <Button
              type="submit"
              fullWidth
              className="ms-btn-main"
              sx={{ py: 1.4, fontSize: "1rem" }}
            >
              SIGN UP
            </Button>

            <Typography
              sx={{
                textAlign: "center",
                mt: 1,
                fontSize: "0.9rem",
              }}
            >
              Already have an account?{" "}
              <span
                style={{
                  color: "#E41C77",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => navigate("/login")}
              >
                Log in
              </span>
            </Typography>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}

export default Signup;