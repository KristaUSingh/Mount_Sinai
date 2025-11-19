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
} from "@mui/material";
import MSLogo from "../assets/MSLogo.png";

function Signup() {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
        options: { emailRedirectTo: "http://localhost:5173/login" },
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
        
        //compares with the postgre code 23505 if the account already exists
        if (dbError?.code === "23505") {
          setError("Account already exists. Login or reset password.");
          return;
        }
        if (dbError) throw dbError;
      }

      setSuccess("Signup successful! Please check your email to verify your account.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Something went wrong during signup.");
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
      <Paper elevation={5} sx={{ p: 4, width: 400, textAlign: "center", borderRadius: 4 }}>
        <img
          src={MSLogo}
          alt="Mount Sinai Logo"
          style={{ width: "130px", marginBottom: "20px" }}
        />
        <Typography variant="h6" sx={{ fontWeight: "bold", color: "#002F6C", mb: 2 }}>
          Mount Sinai Radiology Signup
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)}>
          <TextField {...register("firstName")} label="First Name" fullWidth margin="normal" required />
          <TextField {...register("lastName")} label="Last Name" fullWidth margin="normal" required />
          <TextField {...register("email")} label="Email" type="email" fullWidth margin="normal" required />
          <TextField {...register("password")} label="Password" type="password" fullWidth margin="normal" required />
          <TextField {...register("role")} select label="Role" fullWidth margin="normal" required>
            <MenuItem value="agent">Agent</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>

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
            SIGN UP
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default Signup;
