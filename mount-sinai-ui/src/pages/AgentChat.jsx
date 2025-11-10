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

function AgentChat() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Welcome to Mount Sinai Radiology Assistant. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("");
  const [agentName, setAgentName] = useState("Agent"); // later replace with Supabase user data
  const navigate = useNavigate();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: "agent", text: input }];

    const botReply = {
      sender: "bot",
      text: `You asked: "${input}". (LLM response will go here...)`,
    };

    setMessages([...newMessages, botReply]);
    setInput("");
  };

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <Box sx={{ bgcolor: "#F9FAFB", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">
            Mount Sinai Radiology Agent Portal
          </Typography>
          <Button
            color="inherit"
            variant="outlined"
            sx={{ borderColor: "white" }}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Greeting Banner */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(90deg, #E8F0FE, #F9FAFB)",
          py: 3,
          mb: 2,
          boxShadow: "0px 2px 5px rgba(0,0,0,0.1)",
        }}
      >
        <Typography
          variant="h5"
          sx={{
            color: "#002F6C",
            fontWeight: 600,
            fontFamily: "Poppins, sans-serif",
          }}
        >
          {greeting}, {agentName}!
        </Typography>
      </Box>

      {/* Chat Window */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 3 }}>
        <Paper
          elevation={6}
          sx={{
            p: 3,
            width: "85%",
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

          {/* Messages */}
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

          {/* Input Section */}
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
                bgcolor: "#002F6C",
                px: 4,
                borderRadius: 2,
                fontWeight: 600,
                "&:hover": { bgcolor: "#001B40" },
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
