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

function Signup() {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const onSubmit = async ({ email, password, role }) => {
    // Dummy signup logic (no backend)
    if (!email || !password || !role) {
      setError("All fields are required");
      return;
    }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      //FIX ME: ADD RLS policy and password requirements
      //NEED to add name to ui 

      // 2. Insert into your custom `users` table (extra info like role)
      if (data.user) {
        const { error: dbError } = await supabase.from("users").insert([
          {
            email,
            user_id: data.user.id, // same as auth.users.id
            role,
            login_time: new Date(),
          },
        ])

        if (dbError) throw dbError

      }


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
