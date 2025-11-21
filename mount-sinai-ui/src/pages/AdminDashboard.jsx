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
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import MSLogo from "../assets/MSLogo.png";

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function AdminDashboard({ auth }) {
  const [files, setFiles] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const [fileType, setFileType] = useState("");
  const [fileExtension, setFileExtension] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [openConfirm, setOpenConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [alert, setAlert] = useState({ open: false, msg: "", type: "success" });

  const navigate = useNavigate();

  // =========================================================
  // BACKEND UPLOAD FILE
  // =========================================================
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

  // =========================================================
  // RESET FAISS INDEX
  // =========================================================
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

  // =========================================================
  // ADD TEXT-BASED POLICY NOTE
  // =========================================================
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

  // =========================================================
  // VIEW + DELETE
  // =========================================================
  const handleView = (url) => window.open(url, "_blank");

  const confirmDelete = () => {
    setFiles((prev) => prev.filter((f) => f.name !== fileToDelete));
    setFileToDelete(null);
    setOpenConfirm(false);
  };

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      {/* NAVBAR */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box component="img" src={MSLogo} alt="Mount Sinai" sx={{ width: 42 }} />
            <Typography variant="h6" fontWeight="bold">
              Mount Sinai Radiology Admin
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography sx={{ color: "white", fontWeight: 500 }}>
              {auth?.firstName || "Admin"} {auth?.lastName || ""}
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
          background: "linear-gradient(135deg, #E6F0FA 0%, #FFFFFF 100%)",
          m: 4,
          p: 3,
          borderRadius: 3,
          textAlign: "center",
          boxShadow: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#002F6C" }}>
          {getGreeting()}, {auth?.firstName || "Admin"} {auth?.lastName || ""}!
        </Typography>
        <Typography sx={{ color: "#555", mt: 1 }}>
          Welcome back to the Mount Sinai Radiology Admin Dashboard.
        </Typography>
      </Box>

      {/* MAIN CONTENT */}
      <Box sx={{ px: 4, pb: 6 }}>
        <Grid container spacing={4} justifyContent="center">
          {/* ====================== UPLOAD CARD ====================== */}
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                textAlign: "center",
                height: 350,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
              elevation={4}
            >
              <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
                Upload Protocol Files
              </Typography>

              {/* TYPE DROPDOWN */}
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

              {/* EXTENSION DROPDOWN */}
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
                  <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                  <MenuItem value="md">Markdown (.md)</MenuItem>
                </Select>
              </FormControl>

              {/* SELECT FILE */}
              <Button
                variant="contained"
                component="label"
                disabled={!fileType || !fileExtension}
                sx={{
                  fontWeight: "bold",
                  background:
                    fileType && fileExtension
                      ? "linear-gradient(90deg, #002F6C, #642F6C)"
                      : "#ccc",
                  "&:hover": {
                    background:
                      fileType && fileExtension
                        ? "linear-gradient(90deg, #E41C77, #00ADEF)"
                        : "#ccc",
                  },
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

              {/* FILE PREVIEW + SUBMIT */}
              {selectedFile && (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: 14 }}>
                    <strong>Selected:</strong> {selectedFile.name}
                  </Typography>

                  <Button
                    fullWidth
                    sx={{
                      mt: 1,
                      fontWeight: "bold",
                      color: "white",
                      background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                      "&:hover": {
                        background: "linear-gradient(90deg, #002F6C, #642F6C)",
                      },
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

                      // RESET UI
                      setSelectedFile(null);
                      setFileType("");
                      setFileExtension("");
                    }}
                  >
                    Submit to Knowledge Base
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* ====================== NOTES CARD ====================== */}
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                textAlign: "center",
                height: 350,
                display: "flex",
                flexDirection: "column",
              }}
              elevation={4}
            >
              <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
                Add / Edit Policy Notes
              </Typography>

              <TextField
                label="Title"
                fullWidth
                margin="normal"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Enter note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />

              <Button
                sx={{
                  mt: 2,
                  fontWeight: "bold",
                  color: "white",
                  background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #002F6C, #642F6C)",
                  },
                }}
                onClick={handleAddPolicy}
              >
                Save Policy
              </Button>
            </Paper>
          </Grid>

          {/* ====================== UPLOADED POLICIES ====================== */}
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                height: 350,
                display: "flex",
                flexDirection: "column",
              }}
              elevation={4}
            >
              <Typography
                variant="h6"
                sx={{ color: "#002F6C", fontWeight: 600, textAlign: "center" }}
              >
                Uploaded Policies
              </Typography>

              <TableContainer sx={{ flexGrow: 1, overflowY: "auto", mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: "#002F6C" }}>
                        Policy / File
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 600, color: "#002F6C" }}
                        align="right"
                      >
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
                                color: "white",
                                fontWeight: 600,
                                background:
                                  file.type === "note"
                                    ? "#E41C77"
                                    : "#002F6C",
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
                                  fontWeight: 500,
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
                        <TableCell colSpan={2} align="center" sx={{ color: "#777" }}>
                          No files uploaded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* RESET INDEX BUTTON */}
              <Button
                fullWidth
                sx={{
                  mt: 2,
                  fontWeight: "bold",
                  color: "white",
                  background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                }}
                onClick={handleResetIndex}
              >
                Reset Knowledge Base
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* CONFIRM DELETE */}
        <Dialog
          open={openConfirm}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setOpenConfirm(false)}
          PaperProps={{ sx: { borderRadius: 3, p: 1, boxShadow: 6 } }}
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
            <Button
              sx={{ color: "#002F6C", fontWeight: 600 }}
              onClick={() => setOpenConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              sx={{
                background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                color: "white",
                fontWeight: "bold",
                "&:hover": {
                  background: "linear-gradient(90deg, #002F6C, #642F6C)",
                },
              }}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* ALERTS */}
        <Snackbar
          open={alert.open}
          autoHideDuration={4000}
          onClose={() => setAlert({ ...alert, open: false })}
        >
          <Alert severity={alert.type} sx={{ width: "100%" }}>
            {alert.msg}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
