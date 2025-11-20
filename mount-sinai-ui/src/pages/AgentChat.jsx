import { useState, useEffect, useRef } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MSLogo from "../assets/MSLogo.png";

function AgentChat({ auth }) {
  // TWO SEPARATE MESSAGE STATES
  const [scheduleMessages, setScheduleMessages] = useState([
    {
      sender: "bot",
      text: "Welcome to the Mount Sinai Radiology Assistant. How can I help you today?",
    },
  ]);

  const [ragMessages, setRagMessages] = useState([
    {
      sender: "bot",
      text: "Document Q&A Mode enabled. Ask about uploaded files.",
    },
  ]);

  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("");

  // WHICH MODE?
  const [mode, setMode] = useState("schedule");

  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  // Greeting logic
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12
        ? "Good morning"
        : hour < 18
        ? "Good afternoon"
        : "Good evening"
    );
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [scheduleMessages, ragMessages, mode]);

  // BACKEND CALL
  const sendToBackend = async (question) => {
    try {
      const endpoint =
        mode === "schedule"
          ? "http://localhost:8000/agent-chat"
          : "http://localhost:8000/rag-chat";

      const body =
        mode === "schedule"
          ? JSON.stringify({ question })
          : new URLSearchParams({ query: question });

      const headers =
        mode === "schedule"
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
      });

      const data = await res.json();
      return data.answer || "No response available.";
    } catch (err) {
      return "Error: Cannot reach backend.";
    }
  };

  // SEND MESSAGE HANDLER
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "agent", text: input };
    const thinkingMessage = { sender: "bot", text: "Thinking..." };

    let updateMessages, setMessages;

    if (mode === "schedule") {
      updateMessages = [...scheduleMessages, userMessage];
      setMessages = setScheduleMessages;
      setScheduleMessages(updateMessages);
      setScheduleMessages((prev) => [...prev, thinkingMessage]);
    } else {
      updateMessages = [...ragMessages, userMessage];
      setMessages = setRagMessages;
      setRagMessages(updateMessages);
      setRagMessages((prev) => [...prev, thinkingMessage]);
    }

    // CLEAR INPUT
    setInput("");

    // BACKEND REPLY
    const reply = await sendToBackend(input);
    const botReply = { sender: "bot", text: reply };

    // REPLACE "Thinking..." with real answer
    setMessages((prev) => [...updateMessages, botReply]);
  };

  const handleLogout = () => navigate("/login");

  // SELECT WHICH MESSAGE STATE TO DISPLAY
  const displayedMessages = mode === "schedule" ? scheduleMessages : ragMessages;

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      {/* Navbar */}
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

      {/* Greeting */}
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

      {/* Chat Interface */}
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
          {/* Title + Toggle */}
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
              Radiology Assistant Chat
            </Typography>

            {/* MODE TOGGLE BUTTONS */}
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(e, val) => val && setMode(val)}
              sx={{ mt: 2 }}
            >
              <ToggleButton value="schedule">Scheduling Mode</ToggleButton>
              <ToggleButton value="rag">Document Q&A Mode</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Messages */}
          <List sx={{ flexGrow: 1, overflowY: "auto", pb: 1 }}>
            {displayedMessages.map((msg, idx) => (
              <ListItem
                key={idx}
                sx={{ justifyContent: msg.sender === "agent" ? "flex-end" : "flex-start" }}
              >
                <ListItemText
                  primary={msg.text}
                  sx={{
                    bgcolor:
                      msg.sender === "agent"
                        ? "#002F6C"
                        : mode === "rag"
                        ? "#FFF8E1"
                        : "#E8F0FE",
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
            <div ref={messagesEndRef} />
          </List>

          {/* Input */}
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              placeholder={
                mode === "schedule"
                  ? "Ask about exam locations, rooms, durations..."
                  : "Ask about uploaded documents..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
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
