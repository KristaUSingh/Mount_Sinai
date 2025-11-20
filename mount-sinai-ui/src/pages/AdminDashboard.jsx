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
  const [fileType, setFileType] = useState(""); // ✅ New dropdown state
  const [openConfirm, setOpenConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const navigate = useNavigate();

  // ✅ Handle file upload + attach chosen type
  const handleFileUpload = (event) => {
    const uploaded = Array.from(event.target.files).map((f) => ({
      name: f.name,
      category: fileType || "Other",
      type: "protocol",
      url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...uploaded]);
  };

  // ✅ Handle adding notes as JSON
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
    const url = URL.createObjectURL(blob);

    const newNote = {
      name: `${noteTitle}.json`,
      type: "note",
      url,
    };

    setFiles((prev) => [...prev, newNote]);
    setNoteTitle("");
    setNoteContent("");
  };

  // ✅ File preview + delete logic
  const handleView = (url) => window.open(url, "_blank");
  const confirmDelete = () => {
    setFiles((prev) => prev.filter((file) => file.name !== fileToDelete));
    setFileToDelete(null);
    setOpenConfirm(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Box sx={{ bgcolor: "#F7F9FC", minHeight: "100vh" }}>
      {/* Navbar */}
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
          {getGreeting()}, {auth?.firstName || "Admin"} {auth?.lastName || ""}!
        </Typography>
        <Typography sx={{ color: "#555", mt: 1 }}>
          Welcome back to the Mount Sinai Radiology Admin Dashboard.
        </Typography>
      </Box>

      {/* Main content */}
      <Box sx={{ px: 4, pb: 6 }}>
        <Grid container spacing={4} justifyContent="center">
          {/* ✅ Upload Files */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3, textAlign: "center" }} elevation={4}>
              <Typography variant="h6" sx={{ color: "#002F6C", fontWeight: 600 }}>
                Upload Protocol Files
              </Typography>

              {/* Dropdown for Type */}
              <FormControl fullWidth sx={{ mt: 2 }}>
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

              <Button
                variant="contained"
                component="label"
                disabled={!fileType}
                sx={{
                  mt: 3,
                  fontWeight: "bold",
                  background: fileType
                    ? "linear-gradient(90deg, #002F6C, #642F6C)"
                    : "#ccc",
                  "&:hover": {
                    background: fileType
                      ? "linear-gradient(90deg, #E41C77, #00ADEF)"
                      : "#ccc",
                  },
                }}
              >
                Upload Files
                <input hidden type="file" multiple onChange={handleFileUpload} />
              </Button>
              {!fileType && (
                <Typography
                  variant="caption"
                  sx={{ mt: 1, display: "block", color: "gray" }}
                >
                  Please select a type before uploading
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Add Notes */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3, textAlign: "center" }} elevation={4}>
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
                rows={3}
                placeholder="Enter note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
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
                  },
                }}
                fullWidth
                onClick={handleAddPolicy}
              >
                Save Policy
              </Button>
            </Paper>
          </Grid>

          {/* Uploaded Policies */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3 }} elevation={4}>
              <Typography
                variant="h6"
                sx={{ color: "#002F6C", fontWeight: 600, textAlign: "center" }}
              >
                Uploaded Policies
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: "#002F6C" }}>
                        Policy / File
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 600, color: "#002F6C" }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.length > 0 ? (
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
                                  file.type === "note"
                                    ? "#E41C77"
                                    : "#002F6C",
                              }}
                            />
                            {/* Show uploaded type */}
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
                        <TableCell
                          colSpan={2}
                          align="center"
                          sx={{ color: "#777" }}
                        >
                          No files uploaded yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openConfirm}
          TransitionComponent={Transition}
          keepMounted
          onClose={() => setOpenConfirm(false)}
          aria-labelledby="delete-confirmation"
          PaperProps={{
            sx: { borderRadius: 3, p: 1, boxShadow: 6 },
          }}
          BackdropProps={{
            sx: { backdropFilter: "blur(3px)" },
          }}
        >
          <DialogTitle id="delete-confirmation" sx={{ fontWeight: "bold" }}>
            Confirm Deletion
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{fileToDelete}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenConfirm(false)}
              sx={{ color: "#002F6C", fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              sx={{
                background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                color: "white",
                fontWeight: "bold",
                "&:hover": {
                  background: "linear-gradient(90deg, #002F6C, #642F6C)",
                },
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
