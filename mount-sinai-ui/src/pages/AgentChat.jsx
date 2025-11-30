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
import MSLogo from "../assets/MSLogo.png";

// Simple ID helper
const makeId = () =>
  window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

// Generate summarized chat title
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

function AgentChat({ auth }) {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [mode, setMode] = useState("schedule");
  const [input, setInput] = useState("");
  const [greeting, setGreeting] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Greeting
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

  // Load chats
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

    const scheduleChat = {
      id: makeId(),
      mode: "schedule",
      title: "Scheduling Chat",
      createdAt: new Date().toISOString(),
      messages: [
        { sender: "bot", text: "Welcome to the Mount Sinai Radiology Assistant. How can I help you today?" },
      ],
    };

    const ragChat = {
      id: makeId(),
      mode: "rag",
      title: "Document Q&A Chat",
      createdAt: new Date().toISOString(),
      messages: [
        { sender: "bot", text: "Document Q&A Mode enabled. Ask about uploaded files." },
      ],
    };

    setChats([scheduleChat, ragChat]);
    setCurrentChatId(scheduleChat.id);
  }, []);

  // Save chats
  useEffect(() => {
    if (!chats.length) return;
    localStorage.setItem(
      "msAgentChats_v1",
      JSON.stringify({ chats, currentChatId, mode })
    );
  }, [chats, currentChatId, mode]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  const scheduleChats = chats.filter((c) => c.mode === "schedule");
  const ragChats = chats.filter((c) => c.mode === "rag");

  const currentChat =
    chats.find((c) => c.id === currentChatId) ||
    scheduleChats[0] ||
    ragChats[0] ||
    null;

  useEffect(() => {
    if (currentChat && currentChat.mode !== mode) {
      setMode(currentChat.mode);
    }
  }, [currentChat]);


  // 🔥🔥🔥 SAFETY FIX: Prevent blank screen crash
  if (!currentChat) {
    return (
      <Box sx={{ p: 5, textAlign: "center", fontSize: 20 }}>
        Loading chats…
      </Box>
    );
  }
  // 🔥🔥🔥 END FIX


  // Backend call
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

  // Create new chat
  const createNewChat = (chatMode) => {
    const newChat = {
      id: makeId(),
      mode: chatMode,
      title: chatMode === "schedule" ? "New Scheduling Chat" : "New Document Q&A Chat",
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

  // Delete chat
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
            { sender: "bot", text: "Welcome to the Mount Sinai Radiology Assistant. How can I help you today?" },
          ],
        };
        const ragChat = {
          id: makeId(),
          mode: "rag",
          title: "Document Q&A Chat",
          createdAt: new Date().toISOString(),
          messages: [
            { sender: "bot", text: "Document Q&A Mode enabled. Ask about uploaded files." },
          ],
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

  // Select chat
  const handleSelectChat = (chatId) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    setCurrentChatId(chatId);
    setMode(chat.mode);
    setInput("");
  };

  // Send message
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

  const displayedMessages = currentChat?.messages || [];

  // Clean markdown-style bold (**text**)
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

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <img src={MSLogo} alt="Mount Sinai" width={42} />
            <Typography variant="h6" fontWeight="bold">
              Mount Sinai Radiology Agent Portal
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

      {/* GREETING */}
      <Box
        sx={{
          background: "linear-gradient(135deg,#E6F0FA,#FFF)",
          m: 4,
          p: 3,
          borderRadius: 3,
          textAlign: "center",
          boxShadow: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#002F6C" }}>
          {`${greeting}, ${auth?.firstName} ${auth?.lastName}!`}
        </Typography>
        <Typography sx={{ color: "#555" }}>
          Welcome back to your Radiology Chat Assistant Dashboard.
        </Typography>
      </Box>

      {/* LAYOUT */}
      <Box sx={{ display: "flex", px: 4, pb: 6, gap: 3 }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <Paper
            elevation={4}
            sx={{
              width: 260,
              p: 2,
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              maxHeight: "75vh",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
              <Button
                onClick={() => setSidebarOpen(false)}
                sx={{
                  minWidth: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  color: "white",
                  backgroundColor: "#002F6C",
                }}
              >
                ⟨
              </Button>
            </Box>

            <Typography sx={{ fontWeight: 600, mb: 1, color: "#002F6C" }}>
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
                background: "linear-gradient(90deg,#666,#999)",
              }}
            >
              + New Document Q&A
            </Button>

            <Typography variant="overline">Scheduling</Typography>
            <List dense>
              {scheduleChats.map((chat) => (
                <ListItemButton
                  key={chat.id}
                  selected={chat.id === currentChatId}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <ListItemText primary={chat.title} />
                  <IconButton onClick={(e) => handleDeleteChat(e, chat.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>

            <Divider sx={{ my: 1 }} />

            <Typography variant="overline">Document Q&A</Typography>
            <List dense>
              {ragChats.map((chat) => (
                <ListItemButton
                  key={chat.id}
                  selected={chat.id === currentChatId}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <ListItemText primary={chat.title} />
                  <IconButton onClick={(e) => handleDeleteChat(e, chat.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}

        {!sidebarOpen && (
          <Button
            onClick={() => setSidebarOpen(true)}
            sx={{
              minWidth: 0,
              mt: 2,
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#002F6C",
              color: "white",
            }}
          >
            ⟩
          </Button>
        )}

        {/* CHAT PANEL */}
        <Paper
          elevation={6}
          sx={{
            p: 3,
            flex: 1,
            height: "75vh",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h6"
            sx={{ color: "#002F6C", fontWeight: 600, textAlign: "center", mb: 2 }}
          >
            Radiology Assistant Chat
          </Typography>

          {/* Messages */}
          <List sx={{ flexGrow: 1, overflowY: "auto" }}>
            {displayedMessages.map((msg, i) => (
              <ListItem
                key={i}
                sx={{ justifyContent: msg.sender === "agent" ? "flex-end" : "flex-start" }}
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
                        ? "#002F6C"
                        : currentChat.mode === "rag"
                        ? "#FFF8E1"
                        : "#E8F0FE",
                    color: msg.sender === "agent" ? "white" : "#002F6C",
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
                currentChat.mode === "schedule"
                  ? "Ask about exam locations, rooms, durations…"
                  : "Ask about uploaded documents…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button
              variant="contained"
              sx={{
                px: 4,
                borderRadius: 2,
                background: "linear-gradient(90deg,#E41C77,#00ADEF)",
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
