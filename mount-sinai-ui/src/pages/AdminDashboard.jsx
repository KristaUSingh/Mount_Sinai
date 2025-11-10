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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import MSLogo from "../assets/MSLogo.png";

function AdminDashboard() {
  const [files, setFiles] = useState([]);
  const [newPolicy, setNewPolicy] = useState("");
  const [userName, setUserName] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setUserName(`${data.first_name} ${data.last_name}`);
      } else {
        setUserName("Admin");
      }
    };

    fetchUser();
  }, [navigate]);

  // ✅ Upload local files with blob URLs and tag as "protocol"
  const handleFileUpload = (event) => {
    const uploaded = Array.from(event.target.files).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      tag: "Protocol",
    }));

    setFiles((prev) => [...prev, ...uploaded]);
  };

  // ✅ Add note manually tagged as "Note"
  const handleAddPolicy = () => {
    if (!newPolicy.trim()) return;
    const noteItem = { name: newPolicy, url: null, tag: "Note" };
    setFiles([...files, noteItem]);
    setNewPolicy("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ✅ Open local file blob URL
  const handleViewFile = (file) => {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
    } else {
      alert("No file preview available for this entry.");
    }
  };

  // ✅ Delete confirmation
  const confirmDelete = (fileName) => {
    setFileToDelete(fileName);
    setOpenDialog(true);
  };

  const handleDeleteConfirmed = () => {
    setFiles(files.filter((f) => f.name !== fileToDelete));
    setOpenDialog(false);
    setFileToDelete(null);
  };

  const handleCancelDelete = () => {
    setOpenDialog(false);
    setFileToDelete(null);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      {/* ✅ Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C", boxShadow: "none", py: 0.5 }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box component="img" src={MSLogo} alt="Mount Sinai" sx={{ width: 45, height: "auto", objectFit: "contain" }} />
            <Typography variant="h6" color="inherit" fontWeight="bold" sx={{ letterSpacing: 0.3 }}>
              Mount Sinai Radiology Admin
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body1" sx={{ color: "white", fontWeight: 500 }}>
              {userName}
            </Typography>
            <Button
              color="inherit"
              variant="outlined"
              sx={{
                borderColor: "white",
                fontWeight: 600,
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

      {/* ✅ Greeting Banner */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #E6F0FA 0%, #FFFFFF 100%)",
          m: 4,
          p: 3,
          borderRadius: 3,
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#002F6C", mb: 1 }}>
          {getGreeting()}, {userName || "Admin"}!
        </Typography>
        <Typography sx={{ color: "#555", fontSize: "0.95rem" }}>
          Welcome back to the Mount Sinai Radiology Admin Dashboard.
        </Typography>
      </Box>

      {/* ✅ Main Content */}
      <Box sx={{ px: 4, pb: 6 }}>
        <Grid container spacing={4} justifyContent="center" sx={{ maxWidth: "1200px", mx: "auto" }}>
          {/* Upload Files */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                textAlign: "center",
                transition: "all 0.3s ease",
                "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: "#002F6C", fontWeight: 600 }}>
                Upload Protocol Files
              </Typography>
              <Button
                variant="contained"
                component="label"
                sx={{
                  mt: 1,
                  px: 4,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: "bold",
                  color: "white",
                  background: "linear-gradient(90deg, #002F6C, #642F6C)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                    transform: "scale(1.05)",
                  },
                }}
              >
                UPLOAD FILES
                <input hidden type="file" multiple onChange={handleFileUpload} />
              </Button>
            </Paper>
          </Grid>

          {/* Policy Notes */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                textAlign: "center",
                transition: "all 0.3s ease",
                "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: "#002F6C", fontWeight: 600 }}>
                Add / Edit Policy Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Enter new policy or notes..."
                value={newPolicy}
                onChange={(e) => setNewPolicy(e.target.value)}
              />
              <Button
                sx={{
                  mt: 2,
                  py: 1,
                  fontWeight: "bold",
                  color: "white",
                  background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #002F6C, #642F6C)",
                    transform: "scale(1.05)",
                  },
                }}
                variant="contained"
                fullWidth
                onClick={handleAddPolicy}
              >
                SAVE POLICY
              </Button>
            </Paper>
          </Grid>

          {/* Uploaded Policies */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                transition: "all 0.3s ease",
                "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: "#002F6C", fontWeight: 600, textAlign: "center" }}>
                Uploaded Policies
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: "#002F6C" }}>Policy / File</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: "#002F6C" }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.length > 0 ? (
                      files.map((file, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 500 }}>{file.name}</Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Chip
                                label={file.tag}
                                size="small"
                                sx={{
                                  color: "white",
                                  fontWeight: 600,
                                  fontSize: "0.7rem",
                                  bgcolor: file.tag === "Protocol" ? "#002F6C" : "#E41C77",
                                  "& .MuiChip-label": { px: 1.5 },
                                }}
                              />
                            </Stack>
                          </TableCell>

                          <TableCell align="right">
                            {/* 👁️ Active if Protocol, gray & disabled if Note */}
                            {file.tag === "Protocol" ? (
                              <IconButton color="primary" onClick={() => handleViewFile(file)}>
                                <VisibilityIcon />
                              </IconButton>
                            ) : (
                              <IconButton
                                disabled
                                sx={{
                                  color: "#B0B0B0",
                                  cursor: "not-allowed",
                                }}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            )}

                            {/* 🗑️ Delete Button */}
                            <IconButton color="error" onClick={() => confirmDelete(file.name)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          align="center"
                          sx={{ color: "#777", fontStyle: "italic" }}
                        >
                          No files or notes yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* ✅ Delete Confirmation Dialog */}
      <Dialog open={openDialog} onClose={handleCancelDelete}>
        <DialogTitle sx={{ fontWeight: "bold", color: "#002F6C" }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong style={{ color: "#E41C77" }}>{fileToDelete}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirmed}
            color="error"
            variant="contained"
            sx={{
              background: "linear-gradient(90deg, #E41C77, #00ADEF)",
              "&:hover": { background: "linear-gradient(90deg, #002F6C, #642F6C)" },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminDashboard;
