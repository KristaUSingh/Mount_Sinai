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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Drawer,
  InputAdornment,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FolderIcon from "@mui/icons-material/Folder";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionIcon from "@mui/icons-material/Description";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import { useNavigate } from "react-router-dom";
import MSLogoWhite from "../assets/MSLogoWhite.png";
import { supabase } from '../api/supabaseClient';

const makeId = () =>
  window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

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
  
  const [showDocs, setShowDocs] = useState(false);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    );
  }, []);

  const loadAllFiles = async () => {
    const results = [];
    const loc_folders = ["Locations_Rooms", "Scheduling_Notes"];
     
    for(const folder of loc_folders) {
      const { data: locRooms, error: err1 } = await supabase.storage
        .from("epic-scheduling")
        .list(folder, { limit: 200 });
      if (err1) console.error(err1);
      else {
        locRooms.forEach((f) => {
          const isNote = f.name.toLowerCase().endsWith(".json");
          results.push({
            name: f.name,
            bucket: "epic-scheduling",
            folder,
            fullPath: `${folder}/${f.name}`,
            url: supabase.storage
              .from("epic-scheduling")
              .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
            type: isNote ? "note" : "protocol",
            category: folder === "Scheduling_Notes" ? "Scheduling" : "Locations/Rooms"
          });
        });
      }
    }
     
    const folders = ["General_Tips", "Preps", "Other", "Other_Notes"];
    for (const folder of folders) {
      const { data, error } = await supabase.storage
        .from("other-content")
        .list(folder, { limit: 200 });
       
      if (error) console.error(error);
      else {
        data.forEach((f) => {
          const isNote = f.name.toLowerCase().endsWith(".json");
          const category = folder.replace(/_/g, " ");
          results.push({
            name: f.name,
            bucket: "other-content",
            folder,
            fullPath: `${folder}/${f.name}`,
            url: supabase.storage
              .from("other-content")
              .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
            type: isNote ? "note" : "protocol",
            category: category
          });
        });
      }
    }
    setFiles(results);
  };

  useEffect(() => {
    if (showDocs) {
      loadAllFiles();
    }
  }, [showDocs]);

  const handleView = (url) => window.open(url, "_blank");

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterTab === 0 ? true :
                       filterTab === 1 ? file.type === "protocol" :
                       file.type === "note";
    const matchesCategory = categoryFilter === "all" || file.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  const categories = ["all", ...new Set(files.map(f => f.category).filter(Boolean))];
  const protocolCount = files.filter(f => f.type === "protocol").length;
  const noteCount = files.filter(f => f.type === "note").length;

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
      messages: [{ sender: "bot", text: "Welcome to the Sinai Nexus. How can I help you today?" }],
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  useEffect(() => {
    if (!chats.length) return;
    localStorage.setItem("msAgentChats_v1", JSON.stringify({ chats, currentChatId, mode }));
  }, [chats, currentChatId, mode]);

  const scheduleChats = chats.filter((c) => c.mode === "schedule");
  const ragChats = chats.filter((c) => c.mode === "rag");
  const currentChat = chats.find((c) => c.id === currentChatId) || scheduleChats[0] || ragChats[0] || null;

  useEffect(() => {
    if (currentChat && currentChat.mode !== mode) {
      setMode(currentChat.mode);
    }
  }, [currentChat]);

  if (!currentChat) {
    return <Box sx={{ p: 5, textAlign: "center", fontSize: 20 }}>Loading chats…</Box>;
  }


  const sendToBackend = async (question, activeMode) => {
    try {
      const endpoint = activeMode === "schedule"
          ? "http://localhost:8000/agent-chat"
          : "http://localhost:8000/rag-chat";
      const body = activeMode === "schedule"
          ? JSON.stringify({ question })
          : new URLSearchParams({ query: question });
      const headers = activeMode === "schedule"
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" };
      const res = await fetch(endpoint, { method: "POST", headers, body });
      const data = await res.json();
      return data.answer || "No response available.";
    } catch {
      return "Error: Cannot reach backend.";
    }
  };

  const createNewChat = (chatMode) => {
    const newChat = {
      id: makeId(),
      mode: chatMode,
      title: chatMode === "schedule" ? "New Scheduling Chat" : "New Document Q&A Chat",
      createdAt: new Date().toISOString(),
      messages: [{
        sender: "bot",
        text: chatMode === "schedule"
          ? "New scheduling conversation. How can I help?"
          : "New document Q&A conversation. Ask about uploaded files.",
      }],
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
          messages: [{ sender: "bot", text: "Welcome to the Sinai Nexus. How can I help you today?" }],
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
              title: chat.title.startsWith("New") || chat.title.endsWith("Chat")
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
          ? { ...chat, messages: [...chat.messages.slice(0, -1), botReply] }
          : chat
      )
    );
  };

  const stripMd = (t) => t.replace(/\*\*(.*?)\*\*/g, "$1");
  const formatMessage = (text) => {
    text = stripMd(text);
    if (text.includes(" is performed at: ")) {
      const [exam, locs] = text.split(" is performed at: ");
      const locations = locs.split(",").map((l) => l.trim());
      return (
        <div>
          <strong>{exam} is performed at:</strong>
          <ul>{locations.map((l, i) => (<li key={i}>{l}</li>))}</ul>
        </div>
      );
    }
    return <span>{text}</span>;
  };

  return (
    <Box sx={{ bgcolor: "transparent", minHeight: "100vh" }}>
      {!hideNavbar && (
        <AppBar position="static" sx={{ bgcolor: "var(--ms-blue)", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
          <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <img src={MSLogoWhite} alt="Mount Sinai" width={42} />
              <Typography variant="h6" fontWeight="bold">Sinai Nexus Agent Portal</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Badge badgeContent={files.length} color="error">
                <Button variant="outlined" startIcon={<FolderIcon />}
                  sx={{ color: "white", borderColor: "white", '&:hover': { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" }}}
                  onClick={() => setShowDocs(true)}>
                  View Documents
                </Button>
              </Badge>
              <Typography sx={{ color: "white" }}>{auth?.firstName} {auth?.lastName}</Typography>
              <Button variant="outlined" sx={{ color: "white", borderColor: "white" }} onClick={() => navigate("/login")}>LOGOUT</Button>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      <Paper elevation={4} sx={{ p: 2, m: "16px auto", maxWidth: 1400, borderRadius: 3, textAlign: "center",
        background: "rgba(255,255,255,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.25)" }}>
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "var(--ms-blue)" }}>
          {`${greeting}, ${auth?.firstName} ${auth?.lastName}!`}
        </Typography>
        <Typography sx={{ color: "#555" }}>Welcome back to your Radiology Chat Assistant Dashboard.</Typography>
      </Paper>

      <Box sx={{ display: "flex", px: 2, pb: 3, gap: 2, width: "100%", maxWidth: "1600px", margin: "0 auto" }}>
        <Paper
          elevation={6}
          sx={{
            width: "260px",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            maxHeight: "63vh",
            overflow: "hidden",
            position: "sticky",
            top: "20px",
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          {/* Gradient Header */}
          <Box
            sx={{
              p: 2,
              color: "white",
              background:
                "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
            }}
          >
            <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>Chats</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Start or pick a conversation
            </Typography>
          </Box>

          {/* Body (scrolls) */}
          <Box sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            {/* Center ONLY the buttons */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <Button
                variant="contained"
                size="small"
                onClick={() => createNewChat("schedule")}
                sx={{
                  width: "92%",
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 700,
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
                  width: "92%",
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 700,
                  background: "linear-gradient(90deg,#888,#bbb)",
                }}
              >
                + New Document Q&A
              </Button>
            </Box>

            {/* Make headers + lists left aligned with clean spacing */}
            <Typography
              variant="overline"
              sx={{ display: "block", color: "#6b7280", fontWeight: 800, letterSpacing: 0.8, mb: 0.5 }}
            >
              Scheduling
            </Typography>

            <List dense sx={{ pt: 0 }}>
              {scheduleChats.map((chat) => (
                <ListItemButton
                  key={chat.id}
                  selected={chat.id === currentChatId}
                  onClick={() => handleSelectChat(chat.id)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.6,
                    "&.Mui-selected": { background: "rgba(0,47,108,0.14)" },
                  }}
                >
                  <ListItemText
                    primary={chat.title}
                    primaryTypographyProps={{ sx: { fontSize: 14 } }}
                  />
                  <IconButton edge="end" onClick={(e) => handleDeleteChat(e, chat.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>

            <Divider sx={{ my: 1.5 }} />

            <Typography
              variant="overline"
              sx={{ display: "block", color: "#6b7280", fontWeight: 800, letterSpacing: 0.8, mb: 0.5 }}
            >
              Document Q&A
            </Typography>

            <List dense sx={{ pt: 0 }}>
              {ragChats.map((chat) => (
                <ListItemButton
                  key={chat.id}
                  selected={chat.id === currentChatId}
                  onClick={() => handleSelectChat(chat.id)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.6,
                    "&.Mui-selected": { background: "rgba(0,47,108,0.14)" },
                  }}
                >
                  <ListItemText
                    primary={chat.title}
                    primaryTypographyProps={{ sx: { fontSize: 14 } }}
                  />
                  <IconButton edge="end" onClick={(e) => handleDeleteChat(e, chat.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Paper>


        <Paper
          elevation={6}
          sx={{
            flex: 1,
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
          {/* Gradient Header */}
          <Box
            sx={{
              p: 2,
              color: "white",
              background:
                "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
              textAlign: "center",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Radiology Assistant Chat
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {currentChat.mode === "schedule"
                ? "Scheduling support"
                : "Document Q&A support"}
            </Typography>
          </Box>

          {/* Body */}
          <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <List sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
              {currentChat.messages.map((msg, i) => (
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
                sx={{ background: "white", borderRadius: 2 }}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                sx={{
                  px: 4,
                  borderRadius: 2,
                  background: "linear-gradient(90deg,var(--ms-pink),var(--ms-cyan))",
                  fontWeight: 600,
                }}
              >
                Send
              </Button>
            </Box>
          </Box>
        </Paper>

      </Box>

      <Drawer anchor="right" open={showDocs} onClose={() => setShowDocs(false)}
        PaperProps={{ sx: { width: 700, background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}}>
        <Box sx={{ p: 3, background: "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)", color: "white" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Knowledge Base</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Browse all uploaded documents and notes</Typography>
            </Box>
            <Button variant="outlined" onClick={() => setShowDocs(false)}
              sx={{ color: "white", borderColor: "white", '&:hover': { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" }}}>
              Close
            </Button>
          </Box>
        </Box>

        <Box sx={{ p: 3, pb: 2 }}>
          <TextField fullWidth placeholder="Search by filename or category..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
            sx={{ background: "white", borderRadius: 2,
              '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: '#002F6C' }, '&.Mui-focused fieldset': { borderColor: '#002F6C' }}}}
          />
        </Box>

        <Box sx={{ px: 3, pb: 2 }}>
          <Tabs value={filterTab} onChange={(e, newValue) => setFilterTab(newValue)}
            sx={{ '& .MuiTab-root': { minWidth: 100, textTransform: "none", fontWeight: 600 },
              '& .Mui-selected': { color: '#002F6C' }, '& .MuiTabs-indicator': { backgroundColor: '#002F6C' }}}>
            <Tab icon={<Badge badgeContent={files.length} color="primary"><FolderIcon /></Badge>} label="All" iconPosition="start" />
            <Tab icon={<Badge badgeContent={protocolCount} color="primary"><DescriptionIcon /></Badge>} label="Protocols" iconPosition="start" />
            <Tab icon={<Badge badgeContent={noteCount} color="error"><StickyNote2Icon /></Badge>} label="Notes" iconPosition="start" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3, pb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <Chip key={cat} label={cat === "all" ? "All Categories" : cat} onClick={() => setCategoryFilter(cat)}
              sx={{ fontWeight: 600,
                background: categoryFilter === cat ? "linear-gradient(90deg, #002F6C, #642F6C)" : "white",
                color: categoryFilter === cat ? "white" : "#002F6C",
                '&:hover': { background: categoryFilter === cat ? "linear-gradient(90deg, #002F6C, #642F6C)" : "#f0f0f0" }}}
            />
          ))}
        </Box>

        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="body2" sx={{ color: "#555", fontWeight: 600 }}>
            Showing {filteredFiles.length} of {files.length} files
          </Typography>
        </Box>

        <Box sx={{ px: 3, pb: 3, flexGrow: 1, overflowY: "auto" }}>
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2, maxHeight: "calc(100vh - 450px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: "#f8f9fa", color: "#002F6C" }}>File Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "#f8f9fa", color: "#002F6C" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredFiles.length ? (
                  filteredFiles.map((file, idx) => (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: "#f5f5f5" }}}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {file.type === "note" ? <StickyNote2Icon sx={{ color: "#E41C77" }} /> : <DescriptionIcon sx={{ color: "#002F6C" }} />}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.name}</Typography>
                            <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                              <Chip label={file.type === "note" ? "Note" : "Protocol"} size="small"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, color: "white",
                                  background: file.type === "note" ? "linear-gradient(90deg, #E41C77, #ff6b9d)" : "linear-gradient(90deg, #002F6C, #1e5a9a)" }}
                              />
                              {file.category && (
                                <Chip label={file.category} size="small"
                                  sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600, background: "#00ADEF", color: "white" }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton color="primary" onClick={() => handleView(file.url)}
                          sx={{ '&:hover': { background: "rgba(0,47,108,0.1)" }}}>
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No files match your filters</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Drawer>
    </Box>
  );
}

export default AgentChat;