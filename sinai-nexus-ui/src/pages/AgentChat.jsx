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
  ListItemButton,
  Divider,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import MSLogoWhite from "../assets/MSLogoWhite.png";

// Helper to create unique IDs
const makeId = () =>
  window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

// Create a short chat title from user text
const generateTitleFromText = (text, mode) => {
  if (!text) {
    return mode === "schedule" ? "Scheduling Chat" : "Document Q&A Chat";
  }

  const cleaned = text.trim().replace(/\s+/g, " ");
  const words = cleaned.split(" ");
  const maxWords = 6;
  let title = words.slice(0, maxWords).join(" ");
  title = title.replace(/[?!.:,;]+$/, "");
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (words.length > maxWords) title += "…";
  return title;
};

function AgentChat({ auth, hideNavbar = false }) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [mode, setMode] = useState("schedule");
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("");

  // -------------------------------
  // GREETING
  // -------------------------------
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    );
  }, []);

  // -------------------------------
  // LOAD CHATS FROM LOCAL STORAGE
  // -------------------------------
  useEffect(() => {
    try {
      const stored = localStorage.getItem("msAgentChats_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.chats?.length > 0) {
          setChats(parsed.chats);
          setMode(parsed.mode || "schedule");
          setCurrentChatId(parsed.currentChatId || parsed.chats[0].id);
          return;
        }
      }
    } catch {}

    // Default chats
    const scheduleChat = {
      id: makeId(),
      mode: "schedule",
      title: "Scheduling Chat",
      createdAt: new Date().toISOString(),
      messages: [
        {
          sender: "bot",
          text: "Welcome to the Sinai Nexus. How can I help you today?",
        },
      ],
    };

    const ragChat = {
      id: makeId(),
      mode: "rag",
      title: "Document Q&A Chat",
      createdAt: new Date().toISOString(),
      messages: [{ sender: "bot", text: "Document Q&A Mode enabled. Ask about uploaded files." }],
    };

    setChats([scheduleChat, ragChat]);
    setCurrentChatId(scheduleChat.id);
  }, []);

  // -------------------------------
  // SAVE CHATS TO LOCAL STORAGE
  // -------------------------------
  useEffect(() => {
    if (!chats.length) return;
    localStorage.setItem(
      "msAgentChats_v1",
      JSON.stringify({ chats, currentChatId, mode })
    );
  }, [chats, currentChatId, mode]);

  // -------------------------------
  // AUTO SCROLL WHEN MESSAGES UPDATE
  // -------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  // -------------------------------
  // DELAYED SCROLL WHEN CHAT INITIALLY OPENS
  // (Fixes issue when switching from admin → chat)
  // -------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const scheduleChats = chats.filter((c) => c.mode === "schedule");
  const ragChats = chats.filter((c) => c.mode === "rag");

  const currentChat =
    chats.find((c) => c.id === currentChatId) ||
    scheduleChats[0] ||
    ragChats[0] ||
    null;

  // Sync mode to selected chat
  useEffect(() => {
    if (currentChat && currentChat.mode !== mode) {
      setMode(currentChat.mode);
    }
  }, [currentChat]);

  if (!currentChat) {
    return (
      <Box sx={{ p: 5, textAlign: "center", fontSize: 20 }}>
        Loading chats…
      </Box>
    );
  }

  // -------------------------------
  // BACKEND CALL
  // -------------------------------
  const sendToBackend = async (question, activeMode) => {
    try {
      const endpoint =
        activeMode === "schedule"
          ? "http://localhost:8000/agent-chat"
          : "http://localhost:8000/rag-chat";

      const body =
        activeMode === "schedule"
          ? JSON.stringify({ question })
          : new URLSearchParams({ query: question });

      const headers =
        activeMode === "schedule"
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" };

      const res = await fetch(endpoint, { method: "POST", headers, body });
      const data = await res.json();
      return data.answer || "No response available.";
    } catch {
      return "Error: Cannot reach backend.";
    }
  };

  // -------------------------------
  // NEW CHATS, SELECT CHAT, DELETE CHAT
  // -------------------------------
  const createNewChat = (chatMode) => {
    const newChat = {
      id: makeId(),
      mode: chatMode,
      title:
        chatMode === "schedule"
          ? "New Scheduling Chat"
          : "New Document Q&A Chat",
      createdAt: new Date().toISOString(),
      messages: [
        {
          sender: "bot",
          text:
            chatMode === "schedule"
              ? "New scheduling conversation. How can I help?"
              : "New document Q&A conversation. Ask about uploaded files.",
        },
      ],
    };

    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMode(chatMode);
    setInput("");
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();

    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== chatId);

      if (!remaining.length) {
        const scheduleChat = {
          id: makeId(),
          mode: "schedule",
          title: "Scheduling Chat",
          createdAt: new Date().toISOString(),
          messages: [
            {
              sender: "bot",
              text: "Welcome to the Sinai Nexus. How can I help you today?",
            },
          ],
        };

        const ragChat = {
          id: makeId(),
          mode: "rag",
          title: "Document Q&A Chat",
          createdAt: new Date().toISOString(),
          messages: [{ sender: "bot", text: "Document Q&A Mode enabled. Ask about uploaded files." }],
        };

        setCurrentChatId(scheduleChat.id);
        setMode("schedule");
        return [scheduleChat, ragChat];
      }

      if (chatId === currentChatId) {
        const sameMode = remaining.filter((c) => c.mode === mode);
        const nextChat = sameMode[0] || remaining[0];
        setCurrentChatId(nextChat.id);
        setMode(nextChat.mode);
      }

      return remaining;
    });
  };

  const handleSelectChat = (chatId) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    setCurrentChatId(chatId);
    setMode(chat.mode);
    setInput("");
  };

  // -------------------------------
  // SEND MESSAGE
  // -------------------------------
  const handleSend = async () => {
    if (!input.trim() || !currentChat) return;

    const question = input.trim();
    const activeMode = currentChat.mode;

    const userMessage = { sender: "agent", text: question };
    const thinking = { sender: "bot", text: "Thinking..." };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChat.id
          ? {
              ...chat,
              title:
                chat.title.startsWith("New") || chat.title.endsWith("Chat")
                  ? generateTitleFromText(question, chat.mode)
                  : chat.title,
              messages: [...chat.messages, userMessage, thinking],
            }
          : chat
      )
    );

    setInput("");

    const reply = await sendToBackend(question, activeMode);
    const botReply = { sender: "bot", text: reply };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChat.id
          ? {
              ...chat,
              messages: [...chat.messages.slice(0, -1), botReply],
            }
          : chat
      )
    );
  };

  // -------------------------------
  // FORMAT OUTPUT
  // -------------------------------
  const stripMd = (t) => t.replace(/\*\*(.*?)\*\*/g, "$1");

  const formatMessage = (text) => {
    text = stripMd(text);

    if (text.includes(" is performed at: ")) {
      const [exam, locs] = text.split(" is performed at: ");
      const locations = locs.split(",").map((l) => l.trim());
      return (
        <div>
          <strong>{exam} is performed at:</strong>
          <ul>
            {locations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      );
    }

    return <span>{text}</span>;
  };

  // -------------------------------
  // UI LAYOUT
  // -------------------------------
  return (
    <Box sx={{ bgcolor: "transparent", minHeight: "100vh" }}>

      {/* TOP NAVBAR (HIDDEN IN ADMIN EMBED MODE) */}
      {!hideNavbar && (
        <AppBar
          position="static"
          sx={{
            bgcolor: "var(--ms-blue)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
          }}
        >
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <img src={MSLogoWhite} alt="Mount Sinai" width={42} />
              <Typography variant="h6" fontWeight="bold">
                Sinai Nexus Agent Portal
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={2}>
              <Typography sx={{ color: "white" }}>
                {auth?.firstName} {auth?.lastName}
              </Typography>
              <Button
                variant="outlined"
                sx={{ color: "white", borderColor: "white" }}
                onClick={() => navigate("/login")}
              >
                LOGOUT
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* GREETING */}
      <Paper
        elevation={4}
        sx={{
          p: 2,
          m: "16px auto",
          maxWidth: 1400,
          borderRadius: 3,
          textAlign: "center",
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "var(--ms-blue)" }}>
          {`${greeting}, ${auth?.firstName} ${auth?.lastName}!`}
        </Typography>
        <Typography sx={{ color: "#555" }}>
          Welcome back to your Radiology Chat Assistant Dashboard.
        </Typography>
      </Paper>

      {/* MAIN CONTENT */}
      <Box
        sx={{
          display: "flex",
          px: 2,
          pb: 3,
          gap: 2,
          width: "100%",
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >

        {/* LEFT SIDEBAR */}
        <Paper
          elevation={6}
          sx={{
            width: "260px",
            p: 2,
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            maxHeight: "63vh",
            overflowY: "auto",
            position: "sticky",
            top: "20px",
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >

          <Typography sx={{ fontWeight: 600, mb: 1, color: "var(--ms-blue)" }}>
            Chats
          </Typography>

          <Button
            variant="contained"
            size="small"
            onClick={() => createNewChat("schedule")}
            sx={{
              mb: 1,
              borderRadius: 2,
              textTransform: "none",
              background: "linear-gradient(90deg,#002F6C,#642F6C)",
            }}
          >
            + New Scheduling Chat
          </Button>

          <Button
            variant="contained"
            size="small"
            onClick={() => createNewChat("rag")}
            sx={{
              mb: 2,
              borderRadius: 2,
              textTransform: "none",
              background: "linear-gradient(90deg,#888,#bbb)",
            }}
          >
            + New Document Q&A
          </Button>

          {/* Scheduling Chats */}
          <Typography variant="overline">Scheduling</Typography>
          <List dense>
            {scheduleChats.map((chat) => (
              <ListItemButton
                key={chat.id}
                selected={chat.id === currentChatId}
                onClick={() => handleSelectChat(chat.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    background: "rgba(0,47,108,0.15)",
                  },
                }}
              >
                <ListItemText primary={chat.title} />
                <IconButton onClick={(e) => handleDeleteChat(e, chat.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>

          <Divider sx={{ my: 1 }} />

          {/* Document Q&A Chat List */}
          <Typography variant="overline">Document Q&A</Typography>
          <List dense>
            {ragChats.map((chat) => (
              <ListItemButton
                key={chat.id}
                selected={chat.id === currentChatId}
                onClick={() => handleSelectChat(chat.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": { background: "rgba(0,47,108,0.15)" },
                }}
              >
                <ListItemText primary={chat.title} />
                <IconButton onClick={(e) => handleDeleteChat(e, chat.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* CHAT WINDOW */}
        <Paper
          elevation={6}
          sx={{
            flex: 1,
            p: 2,
            height: "63vh",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >

          <Typography
            variant="h6"
            sx={{
              color: "var(--ms-blue)",
              fontWeight: 600,
              textAlign: "center",
              mb: 2,
            }}
          >
            Radiology Assistant Chat
          </Typography>

          {/* Chat Messages */}
          <List sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
            {currentChat.messages.map((msg, i) => (
              <ListItem
                key={i}
                sx={{
                  justifyContent:
                    msg.sender === "agent" ? "flex-end" : "flex-start",
                }}
              >
                <ListItemText
                  primary={formatMessage(msg.text)}
                  primaryTypographyProps={{ component: "div" }}
                  sx={{
                    maxWidth: "65%",
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor:
                      msg.sender === "agent"
                        ? "var(--ms-blue)"
                        : currentChat.mode === "rag"
                        ? "#FFF8E1"
                        : "#E8F0FE",
                    color: msg.sender === "agent" ? "white" : "var(--ms-blue)",
                    whiteSpace: "pre-wrap",
                  }}
                />
              </ListItem>
            ))}
            <div ref={messagesEndRef} />
          </List>

          {/* Chat Input */}
          <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              placeholder={
                currentChat.mode === "schedule"
                  ? "Ask about exam locations, rooms, durations…"
                  : "Ask about uploaded documents…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              sx={{
                background: "white",
                borderRadius: 2,
              }}
            />

            <Button
              variant="contained"
              sx={{
                px: 4,
                borderRadius: 2,
                background: "linear-gradient(90deg,var(--ms-pink),var(--ms-cyan))",
                fontWeight: 600,
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