import { Box, Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import MSLogo from "../assets/MSLogo.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Box
      className="auth-wrapper"
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        // ❌ removed background here so global.css background shows
      }}
    >
      <Paper
        className="auth-card"
        component={motion.div}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        elevation={6}
        sx={{
          p: 6,
          borderRadius: 4,
          textAlign: "center",
          maxWidth: 500,
          // glass style is handled in global.css
        }}
      >
        {/* Mount Sinai Logo */}
        <Box
          component="img"
          src={MSLogo}
          alt="Mount Sinai Logo"
          sx={{
            width: 180,
            mb: 2,
            display: "block",
            mx: "auto",
          }}
        />

        <Typography
          variant="h5"
          sx={{
            mb: 2,
            fontWeight: 700,
            color: "#002F6C",
          }}
        >
          Welcome to Sinai Nexus!
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4 }}
        >
          Please log in to get started and access your radiology resources.
        </Typography>

        {/* BUTTON WRAPPER */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
          {/* Login */}
          <Button
            className="ms-btn-main"
            onClick={() => navigate("/login")}
          >
            LOGIN
          </Button>

          {/* Signup */}
          <Button
            variant="outlined"
            sx={{
              px: 4,
              borderRadius: 2,
              fontWeight: 600,
              color: "#002F6C",
              borderColor: "#002F6C",
              transition: "all 0.3s ease",
              "&:hover": {
                color: "white",
                borderColor: "transparent",
                background:
                  "linear-gradient(90deg, #00ADEF, #E41C77)",
                transform: "scale(1.05)",
              },
            }}
            onClick={() => navigate("/signup")}
          >
            SIGN UP
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
