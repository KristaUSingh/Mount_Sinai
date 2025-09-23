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
  MenuItem,
} from "@mui/material";

function Signup() {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = ({ email, password, role }) => {
    // Dummy signup logic (no backend)
    if (!email || !password || !role) {
      setError("All fields are required");
      return;
    }

    // Store user info temporarily (in localStorage for demo)
    const newUser = { email, password, role };
    localStorage.setItem("user", JSON.stringify(newUser));

    setSuccess("Signup successful! Redirecting to login...");
    setError("");

    // Redirect after 2 sec
    setTimeout(() => navigate("/login"), 2000);
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <Paper elevation={3} sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" color="primary" gutterBottom>
          Mount Sinai Signup
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}
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
          <TextField
            {...register("role")}
            select
            label="Role"
            fullWidth
            margin="normal"
            required
          >
            <MenuItem value="agent">Agent</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Sign Up
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default Signup;
