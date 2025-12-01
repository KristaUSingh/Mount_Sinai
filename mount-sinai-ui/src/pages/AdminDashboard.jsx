// ===============================================
// AdminDashboard (Upgraded UI + Apple-style Toggle)
// ===============================================

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Paper,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slide,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import MSLogoWhite from "../assets/MSLogoWhite.png";

import AgentChat from "./AgentChat";

// Slide transition for delete modal
const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function AdminDashboard({ auth }) {
  const navigate = useNavigate();

  // Admin data states
  const [files, setFiles] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const [fileType, setFileType] = useState("");
  const [fileExtension, setFileExtension] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [openConfirm, setOpenConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [alert, setAlert] = useState({ open: false, msg: "", type: "success" });

  // Toggle between Admin Dashboard and Chat Assistant
  const [showChat, setShowChat] = useState(false);

  // -----------------------------
  // Backend Upload
  // -----------------------------
  const handleUploadBackend = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setAlert({
        open: true,
        msg: data.message || "Upload failed.",
        type: data.message ? "success" : "error",
      });
    } catch {
      setAlert({
        open: true,
        msg: "Error uploading to backend.",
        type: "error",
      });
    }
  };

  // -----------------------------
  // Reset FAISS Index
  // -----------------------------
  const handleResetIndex = async () => {
    try {
      const res = await fetch("http://localhost:8000/init_index", {
        method: "POST",
      });
      const data = await res.json();
      setAlert({ open: true, msg: data.message, type: "success" });
    } catch {
      setAlert({
        open: true,
        msg: "Failed to reset index.",
        type: "error",
      });
    }
  };

  // -----------------------------
  // Add text note
  // -----------------------------
  const handleAddPolicy = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    const noteData = {
      title: noteTitle.trim(),
      content: noteContent.trim(),
      created_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(noteData, null, 2)], {
      type: "application/json",
    });

    const newNote = {
      name: `${noteTitle}.json`,
      type: "note",
      url: URL.createObjectURL(blob),
    };

    setFiles((prev) => [...prev, newNote]);
    setNoteTitle("");
    setNoteContent("");
  };

  // View selected file
  const handleView = (url) => window.open(url, "_blank");

  // Delete file
  const confirmDelete = () => {
    setFiles((prev) => prev.filter((f) => f.name !== fileToDelete));
    setOpenConfirm(false);
  };

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Apple-style toggle styling
  const SwitchStyles = {
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "#E41C77",
    },
    "& .MuiSwitch-track": {
      background:
        "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
      opacity: 1,
    },
    transform: "scale(1.3)",
  };

  return (
    <Box sx={{ bgcolor: "#F4F7FB", minHeight: "100vh" }}>
      {/* ================= NAVBAR (ALWAYS SHOWN) ================= */}
      <AppBar
        position="static"
        sx={{
          bgcolor: "#002F6C",
          boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          {/* LEFT */}
          <Box display="flex" alignItems="center" gap={1.5}>
            <img src={MSLogoWhite} alt="Mount Sinai" width={42} />
            <Typography variant="h6" fontWeight="bold">
              Mount Sinai Radiology Admin
            </Typography>
          </Box>

          {/* RIGHT */}
          <Box display="flex" alignItems="center" gap={4}>
            {/* APPLE TOGGLE SWITCH */}
            <FormControlLabel
              control={
                <Switch
                  checked={showChat}
                  onChange={() => setShowChat(!showChat)}
                  sx={SwitchStyles}
                />
              }
              label={
                <Typography
                  sx={{
                    color: "white",
                    fontWeight: "600",
                    fontSize: "15px",
                  }}
                >
                  {showChat ? "Chat Assistant" : "Admin Dashboard"}
                </Typography>
              }
            />

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

      {/* ================= BODY AREA (CONDITIONAL) ================= */}
      {showChat ? (
        // CHAT MODE (NO duplicate navbar)
        <AgentChat auth={auth} hideNavbar={true} />
      ) : (
        // ADMIN MODE
        <>
          {/* GREETING */}
          <Paper
            elevation={4}
            sx={{
              p: 3,
              m: "20px auto",
              maxWidth: 1200,
              borderRadius: 3,
              textAlign: "center",
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: "bold", color: "#002F6C" }}>
              {getGreeting()}, {auth?.firstName} {auth?.lastName}!
            </Typography>
            <Typography sx={{ color: "#555" }}>
              Welcome back to your Radiology Admin Dashboard.
            </Typography>
          </Paper>

          {/* MAIN CONTENT */}
          <Box sx={{ px: 4, pb: 6 }}>
            <Grid container spacing={4} justifyContent="center">
              {/* ================= UPLOAD CARD ================= */}
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={6}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: "white",
                    height: 360,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
                    Upload Protocol Files
                  </Typography>

                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={fileType}
                      label="Type"
                      onChange={(e) => setFileType(e.target.value)}
                    >
                      <MenuItem value="Locations/Rooms">Locations / Rooms</MenuItem>
                      <MenuItem value="General Tips">General Tips</MenuItem>
                      <MenuItem value="Preps">Preps</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>File Extension</InputLabel>
                    <Select
                      value={fileExtension}
                      label="File Extension"
                      onChange={(e) => setFileExtension(e.target.value)}
                    >
                      <MenuItem value="pdf">PDF</MenuItem>
                      <MenuItem value="docx">Word (.docx)</MenuItem>
                      <MenuItem value="csv">CSV</MenuItem>
                      <MenuItem value="md">Markdown (.md)</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    component="label"
                    disabled={!fileType || !fileExtension}
                    sx={{
                      fontWeight: 600,
                      background:
                        fileType && fileExtension
                          ? "linear-gradient(90deg, #002F6C, #642F6C)"
                          : "#ccc",
                    }}
                  >
                    Select File
                    <input
                      hidden
                      type="file"
                      accept={`.${fileExtension}`}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setSelectedFile(file);
                        e.target.value = "";
                      }}
                    />
                  </Button>

                  {selectedFile && (
                    <>
                      <Typography>
                        <strong>Selected:</strong> {selectedFile.name}
                      </Typography>

                      <Button
                        fullWidth
                        sx={{
                          fontWeight: "bold",
                          background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                          color: "white",
                        }}
                        onClick={() => {
                          handleUploadBackend(selectedFile);

                          setFiles((prev) => [
                            ...prev,
                            {
                              name: selectedFile.name,
                              category: fileType,
                              type: "protocol",
                              url: URL.createObjectURL(selectedFile),
                            },
                          ]);

                          setSelectedFile(null);
                          setFileType("");
                          setFileExtension("");
                        }}
                      >
                        Submit to Knowledge Base
                      </Button>
                    </>
                  )}
                </Paper>
              </Grid>

              {/* ================= NOTES CARD ================= */}
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={6}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: "white",
                    height: 360,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
                    Add / Edit Policy Notes
                  </Typography>

                  <TextField
                    label="Title"
                    fullWidth
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                  />

                  <TextField
                    fullWidth
                    rows={2}
                    multiline
                    placeholder="Enter note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                  />

                  <Button
                    sx={{
                      mt: "auto",
                      fontWeight: "bold",
                      color: "white",
                      background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                    }}
                    onClick={handleAddPolicy}
                  >
                    Save Policy
                  </Button>
                </Paper>
              </Grid>

              {/* ================= UPLOADED FILES ================= */}
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={6}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    height: 360,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: "#002F6C", fontWeight: 600, textAlign: "center" }}
                  >
                    Uploaded Policies
                  </Typography>

                  <TableContainer sx={{ flexGrow: 1, mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Policy / File</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {files.length ? (
                          files.map((file, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                {file.name}
                                <Chip
                                  label={file.type === "note" ? "Note" : "Protocol"}
                                  size="small"
                                  sx={{
                                    ml: 1,
                                    fontWeight: 600,
                                    color: "white",
                                    background:
                                      file.type === "note" ? "#E41C77" : "#002F6C",
                                  }}
                                />
                                {file.category && (
                                  <Chip
                                    label={file.category}
                                    size="small"
                                    sx={{
                                      ml: 1,
                                      background: "#00ADEF",
                                      color: "white",
                                    }}
                                  />
                                )}
                              </TableCell>

                              <TableCell align="right">
                                <IconButton
                                  color="primary"
                                  onClick={() => handleView(file.url)}
                                >
                                  <VisibilityIcon />
                                </IconButton>

                                <IconButton
                                  color="error"
                                  onClick={() => {
                                    setFileToDelete(file.name);
                                    setOpenConfirm(true);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              No files uploaded yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Button
                    sx={{
                      mt: 2,
                      fontWeight: "bold",
                      background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                      color: "white",
                    }}
                    onClick={handleResetIndex}
                  >
                    Reset Knowledge Base
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* ================= DELETE CONFIRM MODAL ================= */}
          <Dialog
            open={openConfirm}
            TransitionComponent={Transition}
            keepMounted
            onClose={() => setOpenConfirm(false)}
            PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
          >
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Confirm Deletion
            </DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete{" "}
                <strong>{fileToDelete}</strong>?
              </Typography>
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setOpenConfirm(false)}>Cancel</Button>
              <Button
                sx={{
                  background: "linear-gradient(90deg,#E41C77,#00ADEF)",
                  color: "white",
                  fontWeight: "bold",
                }}
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* ================= ALERT ================= */}
          <Snackbar
            open={alert.open}
            autoHideDuration={4000}
            onClose={() => setAlert({ ...alert, open: false })}
          >
            <Alert severity={alert.type}>{alert.msg}</Alert>
          </Snackbar>
        </>
      )}
    </Box>
  );
}

export default AdminDashboard;