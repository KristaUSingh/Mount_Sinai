import { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MSLogo from "../assets/MSLogo.png";

function AgentChat({ auth }) {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Welcome to the Mount Sinai Radiology Assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("");
  const navigate = useNavigate();

  // 🕒 Dynamic greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // 💬 Send message logic
  const handleSend = () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: "agent", text: input }];

    const botReply = {
      sender: "bot",
      text: `You asked: "${input}". (AI response will appear here...)`,
    };

    setMessages([...newMessages, botReply]);
    setInput("");
  };

  // 🚪 Logout
  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      {/* 🩺 Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box component="img" src={MSLogo} alt="Mount Sinai" sx={{ width: 42 }} />
            <Typography variant="h6" fontWeight="bold">
              Mount Sinai Radiology Agent Portal
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography sx={{ color: "white", fontWeight: 500 }}>
              {auth?.firstName || "Agent"} {auth?.lastName || ""}
            </Typography>
            <Button
              variant="outlined"
              sx={{
                borderColor: "white",
                color: "white",
                "&:hover": {
                  background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                  borderColor: "transparent",
                },
              }}
              onClick={handleLogout}
            >
              LOGOUT
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 👋 Greeting Banner */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #E6F0FA 0%, #FFFFFF 100%)",
          m: 4,
          p: 3,
          borderRadius: 3,
          textAlign: "center",
          boxShadow: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#002F6C" }}>
          {greeting}, {auth?.firstName || "Agent"} {auth?.lastName || ""}!
        </Typography>
        <Typography sx={{ color: "#555", mt: 1 }}>
          Welcome back to your Radiology Chat Assistant Dashboard.
        </Typography>
      </Box>

      {/* 💬 Chat Interface */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 4, pb: 6 }}>
        <Paper
          elevation={6}
          sx={{
            p: 3,
            width: "90%",
            height: "75vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            backgroundColor: "#FFFFFF",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "#002F6C",
              mb: 2,
              fontWeight: 600,
              textAlign: "center",
              fontFamily: "Poppins, sans-serif",
            }}
          >
            Radiology Assistant Chat
          </Typography>

          {/* 💭 Messages */}
          <List sx={{ flexGrow: 1, overflowY: "auto", pb: 1 }}>
            {messages.map((msg, idx) => (
              <ListItem
                key={idx}
                sx={{
                  justifyContent: msg.sender === "agent" ? "flex-end" : "flex-start",
                }}
              >
                <ListItemText
                  primary={msg.text}
                  sx={{
                    bgcolor: msg.sender === "agent" ? "#002F6C" : "#E8F0FE",
                    color: msg.sender === "agent" ? "white" : "#002F6C",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "65%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  }}
                />
              </ListItem>
            ))}
          </List>

          {/* ✍️ Input Bar */}
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                },
              }}
            />
            <Button
              variant="contained"
              sx={{
                background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                px: 4,
                borderRadius: 2,
                fontWeight: 600,
                "&:hover": {
                  background: "linear-gradient(90deg, #002F6C, #642F6C)",
                },
              }}
              onClick={handleSend}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default AgentChat;
