import { useState } from "react";
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
    { sender: "bot", text: "Welcome to Mount Sinai Radiology Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const handleSend = () => {
    if (!input.trim()) return;

    // Add agent message
    const newMessages = [...messages, { sender: "agent", text: input }];

    // Mock LLM reply (replace with API later)
    const botReply = {
      sender: "bot",
      text: `You asked: "${input}". (LLM response will go here...)`
    };

    setMessages([...newMessages, botReply]);
    setInput("");
  };

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <Box sx={{ bgcolor: "#F9F9F9", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">
            Mount Sinai Radiology Agent Chat
          </Typography>
          <Button color="inherit" variant="outlined" sx={{ borderColor: "white" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Chat Window */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 4 }}>
        <Paper elevation={4} sx={{ p: 3, width: "80%", height: "70vh", display: "flex", flexDirection: "column" }}>
          <List sx={{ flexGrow: 1, overflowY: "auto" }}>
            {messages.map((msg, idx) => (
              <ListItem key={idx} sx={{ justifyContent: msg.sender === "agent" ? "flex-end" : "flex-start" }}>
                <ListItemText
                  primary={msg.text}
                  sx={{
                    bgcolor: msg.sender === "agent" ? "#002F6C" : "#E0E0E0",
                    color: msg.sender === "agent" ? "white" : "black",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "60%",
                  }}
                />
              </ListItem>
            ))}
          </List>

          {/* Input box */}
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button variant="contained" sx={{ bgcolor: "#002F6C" }} onClick={handleSend}>
              Send
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default AgentChat;
