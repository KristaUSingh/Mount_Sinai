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

import { useState, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import MSLogoWhite from "../assets/MSLogoWhite.png";
import { supabase } from "../api/supabaseClient";
import AgentChat from "./AgentChat";

// Slide transition for delete modal
const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const LOCATION_OPTIONS = [
  "10 UNION SQ E",
  "1090 AMST AVE",
  "1176 5TH AVE",
  "1470 MADISON AVE",
  "425 W 59TH ST",
  "787 11TH AVE",
  "325 W 15TH ST",
  "MSQ OP RAD",
  "300 CADMAN PLAZA",
  "MSM",
  "MSB",
];


function AdminDashboard({ auth }) {
  const navigate = useNavigate();

  // Admin data states
  const [files, setFiles] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("");
  const [noteLocation, setNoteLocation] = useState(""); // location prefix string


  const [fileType, setFileType] = useState("");
  const [fileExtension, setFileExtension] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [openConfirm, setOpenConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [alert, setAlert] = useState({ open: false, msg: "", type: "success" });

  // Toggle between Admin Dashboard and Chat Assistant
  const [showChat, setShowChat] = useState(false);

  // UI-only Knowledge Base filters (does not affect your backend logic)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState(0); // 0=All, 1=Protocols, 2=Notes
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    loadAllFiles();
  }, []);

  // -----------------------------
  // Backend Upload
  // -----------------------------
  const handleUploadSupabase = async (file) => {
    if (!file || !fileType || !fileExtension) return;

    // Get actual file extension
    const fileParts = file.name.split(".");
    const actualExtension = fileParts[fileParts.length - 1].toLowerCase();

    // Check if actual extension matches selected fileExtension
    if (actualExtension !== fileExtension.toLowerCase()) {
      setAlert({
        open: true,
        msg: "File uploaded does not match file extension chosen",
        type: "error",
      });
      return; // Stop upload
    }

    // Choose bucket
    const bucketName =
      fileType === "Locations/Rooms" ? "epic-scheduling" : "other-content";

    const safeFolder = fileType.replace(/\//g, "_").replace(/ /g, "_");
    const filePath = `${safeFolder}/${file.name}`;

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      setAlert({
        open: true,
        msg: "File uploaded successfully!",
        type: "success",
      });

      console.log("Uploaded file info:", data);

      const fullPath = `${bucketName}/${filePath}`;

      // -----------------------------
      // Post-upload backend processing
      // -----------------------------
      //FIX ME: NEED EXAMS_CLEANUP ENDPOINT
      if (fileType === "Locations/Rooms") {
        // Call exams_cleanup for Locations/Rooms
        await fetch("http://127.0.0.1:8000/exams_cleanup", {
          method: "POST",
          body: JSON.stringify({ file_path: fullPath }),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
      } else {
        // Everything else → /upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("priority", "3");
        formData.append("path", fullPath);

        await fetch("http://127.0.0.1:8000/upload", {
          method: "POST",
          body: formData,
        });
      }
    } catch (err) {
      if (
        err.message &&
        err.message.includes("mime type") &&
        err.message.includes("is not supported")
      ) {
        setAlert({
          open: true,
          msg: "Storage does not support this file type",
          type: "error",
        });
      } else if (
        err.message &&
        err.message.includes("The resource") &&
        err.message.includes("already exists")
      ) {
        setAlert({
          open: true,
          msg: "A file with this name already exists. To replace it, delete the existing file and upload the new one",
          type: "error",
        });
      } else {
        console.error(err);
        setAlert({
          open: true,
          msg: "Error uploading file.",
          type: "error",
        });
      }
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
  // Add text note with CATEGORY SUPPORT
  // -----------------------------
  const handleAddPolicy = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || !noteCategory) return;
    // If Scheduling + location note, require location selection
    if (noteCategory === "Scheduling" && !noteLocation) return;

    const noteData = {
      title: noteTitle.trim(),
      content: noteContent.trim(),
      category: noteCategory,
      location: noteCategory === "Scheduling" ? noteLocation : null,
      created_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(noteData, null, 2)], {
      type: "application/json",
    });

    // Sanitize filename and add .json extension
    const sanitizedTitle = noteTitle.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLoc =
      noteCategory === "Scheduling" && noteLocation
        ? noteLocation.replace(/[^a-zA-Z0-9_-]/g, "_")
        : null;

    const fileName = safeLoc
      ? `LOC_${safeLoc}__${sanitizedTitle}.json`
      : `${sanitizedTitle}.json`;

    // Map category to folder structure
    const categoryFolderMap = {
      "General Tips": "General_Tips",
      Preps: "Preps",
      Scheduling: "Scheduling_Notes",
      Other: "Other_Notes",
    };

    const targetFolder = categoryFolderMap[noteCategory];


    // Upload to other-content bucket by default
    const uploads =
      noteCategory === "Scheduling"
        ? [{ bucket: "epic-scheduling", folder: "Scheduling_Notes" }]
        : [{ bucket: "other-content", folder: targetFolder }];

    try {
      let publicUrl = null;

      for (const { bucket, folder } of uploads) {
        const safeFolder = folder.replace(/\//g, "_").replace(/ /g, "_");
        const filePath = `${safeFolder}/${fileName}`;

        // Upload to Supabase Storage
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, blob, { cacheControl: "3600", upsert: true });

        if (error) throw error;

        // Get public URL (use the first bucket's URL)
        if (!publicUrl) {
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
          publicUrl = urlData.publicUrl;
        }

        // Convert Blob to File with proper filename
        const file = new File([blob], fileName, { type: "application/json" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("priority", "1");
        formData.append("path", `${bucket}/${filePath}`);
        if (noteCategory === "Scheduling") {
          formData.append("location", noteLocation);
        }

        await fetch("http://127.0.0.1:8000/upload", {
          method: "POST",
          body: formData,
        });
      }

      // Add to React state using real Supabase URL
      const newNote = {
        name: fileName,
        type: "note",
        category: noteCategory,
        url: publicUrl,
      };

      setFiles((prev) => [...prev, newNote]);

      setAlert({
        open: true,
        msg: "Policy notes successfully uploaded",
        type: "success",
      });

      // Reset
      setNoteTitle("");
      setNoteContent("");
      setNoteCategory("");
      setNoteLocation("");

      // Reload lists
      loadAllFiles();
    } catch (err) {
      console.error(err);
      setAlert({
        open: true,
        msg: "Error uploading policy note.",
        type: "error",
      });
    }
  };

  // =========================================================
  // VIEW + DELETE
  // =========================================================
  const loadAllFiles = async () => {
    const results = [];

    // -------------------------
    // 1. epic-scheduling bucket
    // -------------------------
    const loc_folders = ["Locations_Rooms", "Scheduling_Notes"];
    for (const folder of loc_folders) {
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
            category: folder === "Scheduling_Notes" ? "Scheduling" : undefined,
          });
        });
      }
    }

    // -------------------------
    // 2. other-content bucket
    // -------------------------
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
            category: category,
          });
        });
      }
    }

    setFiles(results);
  };

  // =========================================================
  // DELETE FILE
  // =========================================================
  const handleDeleteSupabase = async (file) => {
    if (!file || !file.bucket || !file.fullPath) {
      console.error("Invalid file object for deletion:", file);
      setAlert({
        open: true,
        msg: "Cannot delete: file info missing",
        type: "error",
      });
      return;
    }

    const fullPath_with_bucket = `${file.bucket}/${file.fullPath}`;

    try {
      // Call backend delete for ALL buckets to remove embeddings
      const res = await fetch("http://127.0.0.1:8000/delete-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ file_path: fullPath_with_bucket }),
      });

      const data = await res.json();

      console.log("🟦 delete_file response:", data);
      console.log("🟦 Sent file_path:", fullPath_with_bucket);

      if (!res.ok) {
        console.error("Backend delete failed:", data);
      }

      // Delete from Supabase storage (current bucket)
      const { error } = await supabase.storage
        .from(file.bucket)
        .remove([file.fullPath]);

      if (error) throw error;

      setAlert({ open: true, msg: "File deleted successfully!", type: "success" });

      // Refresh list after deleting
      loadAllFiles();
    } catch (err) {
      console.error("Supabase deletion error:", err);
      setAlert({ open: true, msg: "Error deleting file", type: "error" });
    }
  };

  const confirmDelete = () => {
    if (!fileToDelete) return;
    handleDeleteSupabase(fileToDelete);
    setOpenConfirm(false);
  };

  const handleView = (url) => window.open(url, "_blank");

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

  // UI-only filtering for KB list
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.category || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterTab === 0 ? true : filterTab === 1 ? file.type === "protocol" : file.type === "note";

    const matchesCategory =
      categoryFilter === "all" ? true : file.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const categories = ["all", ...new Set(files.map((f) => f.category).filter(Boolean))];
  const protocolCount = files.filter((f) => f.type === "protocol").length;
  const noteCount = files.filter((f) => f.type === "note").length;

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
              Sinai Nexus Admin
            </Typography>
          </Box>

          {/* RIGHT */}
          <Box display="flex" alignItems="center" gap={4}>
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
        <AgentChat auth={auth} hideNavbar={true} />
      ) : (
        <>
          {/* GREETING */}
          <Paper
            elevation={4}
            sx={{
              p: 3,
              mt: 3,
              mb: 3,
              mx: "auto",
              maxWidth: 1400, // match the page container maxWidth
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
          <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, md: 4 }, pb: 6}}>
            <Grid container spacing={4} justifyContent="center" alignItems="flex-start">
              {/* ================= ROW 1: Upload + Notes side-by-side ================= */}
              <Grid item xs={12}>
                <Grid
                  container
                  spacing={4}
                  justifyContent="center"
                  alignItems="stretch"
                  sx={{ width: "100%" }}
                >
                  {/* Upload Protocol Files */}
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={6}
                      sx={{
                        borderRadius: 3,
                        overflow: "hidden",
                        background: "white",
                        height: 360, // adjust if you want slightly taller/shorter
                        width: 650,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Gradient header */}
                      <Box
                        sx={{
                          p: 2,
                          color: "white",
                          background:
                            "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                          Upload Protocol Files
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Add documents to the Knowledge Base
                        </Typography>
                      </Box>

                      {/* Body (compact) */}
                      <Box
                        sx={{
                          p: 2,
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.25,
                        }}
                      >
                        <FormControl fullWidth size="small">
                          <InputLabel>Type</InputLabel>
                          <Select
                            value={fileType}
                            label="Type"
                            onChange={(e) => setFileType(e.target.value)}
                            sx={{ "& .MuiSelect-select": { py: 1 } }}
                          >
                            <MenuItem value="Locations/Rooms">Locations / Rooms</MenuItem>
                            <MenuItem value="General Tips">General Tips</MenuItem>
                            <MenuItem value="Preps">Preps</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                          <InputLabel>File Extension</InputLabel>
                          <Select
                            value={fileExtension}
                            label="File Extension"
                            onChange={(e) => setFileExtension(e.target.value)}
                            sx={{ "& .MuiSelect-select": { py: 1 } }}
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
                          onClick={() => selectedFile && handleUploadSupabase(selectedFile)}
                          sx={{
                            fontWeight: 800,
                            py: 1,
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
                            <Typography sx={{ fontSize: 13 }}>
                              <strong>Selected:</strong> {selectedFile.name}
                            </Typography>

                            <Button
                              fullWidth
                              sx={{
                                mt: "auto",
                                fontWeight: "bold",
                                py: 1,
                                background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                                color: "white",
                              }}
                              onClick={() => {
                                handleUploadSupabase(selectedFile).then(() => {
                                  loadAllFiles();
                                });

                                setSelectedFile(null);
                                setFileType("");
                                setFileExtension("");
                              }}
                            >
                              Submit to Knowledge Base
                            </Button>
                          </>
                        )}
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Add / Edit Policy Notes */}
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={6}
                      sx={{
                        borderRadius: 3,
                        overflow: "hidden",
                        background: "white",
                        height: 360,
                        width: 650,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Gradient header */}
                      <Box
                        sx={{
                          p: 2,
                          color: "white",
                          background:
                            "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                          Add / Edit Policy Notes
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          Create quick notes for agents
                        </Typography>
                      </Box>

                      {/* Body (compact) */}
                      <Box
                        sx={{
                          p: 2,
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.25,
                        }}
                      >
                        <FormControl fullWidth size="small">
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={noteCategory}
                            label="Category"
                            onChange={(e) => {
                              const next = e.target.value;
                              setNoteCategory(next);
                          
                              // reset scheduling-only fields when category changes
                              if (next !== "Scheduling") {
                                setNoteLocation("");
                              }
                            }}
                            sx={{ "& .MuiSelect-select": { py: 1 } }}
                          >
                            <MenuItem value="General Tips">General Tips</MenuItem>
                            <MenuItem value="Preps">Preps</MenuItem>
                            <MenuItem value="Scheduling">Locations / Rooms</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </Select>
                        </FormControl>

                        {noteCategory === "Scheduling" && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Location</InputLabel>
                            <Select
                              value={noteLocation}
                              label="Location"
                              onChange={(e) => setNoteLocation(e.target.value)}
                              sx={{ "& .MuiSelect-select": { py: 1 } }}
                            >
                              {LOCATION_OPTIONS.map((loc) => (
                                <MenuItem key={loc} value={loc}>
                                  {loc}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}

                        <TextField
                          size="small"
                          label="Title"
                          fullWidth
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                        />

                        <TextField
                          size="small"
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
                            py: 1,
                            color: "white",
                            background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                          }}
                          onClick={handleAddPolicy}
                          disabled={
                            !noteTitle.trim() ||
                            !noteContent.trim() ||
                            !noteCategory ||
                            (noteCategory === "Scheduling" && !noteLocation)
                          }
                        >
                          Save Policy
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </Grid>

              {/* ================= ROW 2: Knowledge Base full-width below ================= */}
              <Grid item xs={12}>
                <Paper
                  elevation={6}
                  sx={{
                    borderRadius: 3,
                    height: 600,
                    width: 1325,
                    maxWidth: 1400,
                    mx: "auto",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  {/* Gradient header */}
                  <Box
                    sx={{
                      p: 2,
                      color: "white",
                      background:
                        "linear-gradient(90deg, #002F6C 0%, #642F6C 50%, #E41C77 100%)",
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                      Knowledge Base
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Browse all uploaded documents and notes
                    </Typography>
                  </Box>

                  {/* Search */}
                  <Box sx={{ px: 2, pt: 2 }}>
                    <TextField
                      fullWidth
                      placeholder="Search by filename or category..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        background: "white",
                        borderRadius: 2,
                        "& .MuiOutlinedInput-root": {
                          "&:hover fieldset": { borderColor: "#002F6C" },
                          "&.Mui-focused fieldset": { borderColor: "#002F6C" },
                        },
                      }}
                    />
                  </Box>

                  {/* Tabs */}
                  <Box sx={{ px: 2, pt: 1 }}>
                    <Tabs
                      value={filterTab}
                      onChange={(e, v) => setFilterTab(v)}
                      variant="scrollable"
                      allowScrollButtonsMobile
                      sx={{
                        "& .MuiTab-root": {
                          minWidth: 120,
                          textTransform: "none",
                          fontWeight: 700,
                        },
                        "& .Mui-selected": { color: "#002F6C" },
                        "& .MuiTabs-indicator": { backgroundColor: "#002F6C" },
                      }}
                    >
                      <Tab
                        icon={
                          <Badge badgeContent={files.length} color="primary">
                            <FolderIcon />
                          </Badge>
                        }
                        label="All"
                        iconPosition="start"
                      />
                      <Tab
                        icon={
                          <Badge badgeContent={protocolCount} color="primary">
                            <DescriptionIcon />
                          </Badge>
                        }
                        label="Protocols"
                        iconPosition="start"
                      />
                      <Tab
                        icon={
                          <Badge badgeContent={noteCount} color="primary">
                            <StickyNote2Icon />
                          </Badge>
                        }
                        label="Notes"
                        iconPosition="start"
                      />
                    </Tabs>
                  </Box>

                  {/* Category chips */}
                  <Box sx={{ px: 2, pt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {categories.map((cat) => (
                      <Chip
                        key={cat}
                        label={cat === "all" ? "All Categories" : cat}
                        onClick={() => setCategoryFilter(cat)}
                        sx={{
                          fontWeight: 700,
                          background:
                            categoryFilter === cat
                              ? "linear-gradient(90deg, #002F6C, #642F6C)"
                              : "white",
                          color: categoryFilter === cat ? "white" : "#002F6C",
                          border: categoryFilter === cat ? "none" : "1px solid #d6deee",
                          "&:hover": {
                            background:
                              categoryFilter === cat
                                ? "linear-gradient(90deg, #002F6C, #642F6C)"
                                : "#f3f6fb",
                          },
                        }}
                      />
                    ))}
                  </Box>

                  {/* Showing count */}
                  <Box sx={{ px: 2, pt: 1 }}>
                    <Typography variant="body2" sx={{ color: "#555", fontWeight: 700 }}>
                      Showing {filteredFiles.length} of {files.length} files
                    </Typography>
                  </Box>

                  {/* Table (scroll area) */}
                  <Box sx={{ px: 2, pt: 1, flexGrow: 1, minHeight: 220, overflow: "hidden" }}>
                    <TableContainer
                      component={Paper}
                      elevation={0}
                      sx={{
                        borderRadius: 2,
                        border: "1px solid #e3ebfb",
                        height: "100%",
                        overflow: "auto",
                      }}
                    >
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800, bgcolor: "#f8f9fa", color: "#002F6C" }}>
                              File Name
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 800, bgcolor: "#f8f9fa", color: "#002F6C" }}
                            >
                              Actions
                            </TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {filteredFiles.length ? (
                            filteredFiles.map((file, idx) => (
                              <TableRow key={idx} sx={{ "&:hover": { bgcolor: "#f5f5f5" } }}>
                                <TableCell>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {file.type === "note" ? (
                                      <StickyNote2Icon sx={{ color: "#E41C77" }} />
                                    ) : (
                                      <DescriptionIcon sx={{ color: "#002F6C" }} />
                                    )}

                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {file.name}
                                      </Typography>

                                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                                        <Chip
                                          label={file.type === "note" ? "Note" : "Protocol"}
                                          size="small"
                                          sx={{
                                            height: 20,
                                            fontSize: "0.7rem",
                                            fontWeight: 800,
                                            color: "white",
                                            background:
                                              file.type === "note"
                                                ? "linear-gradient(90deg, #E41C77, #ff6b9d)"
                                                : "linear-gradient(90deg, #002F6C, #1e5a9a)",
                                          }}
                                        />
                                        {file.category && (
                                          <Chip
                                            label={file.category}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              fontSize: "0.7rem",
                                              fontWeight: 700,
                                              background: "#00ADEF",
                                              color: "white",
                                            }}
                                          />
                                        )}
                                      </Box>
                                    </Box>
                                  </Box>
                                </TableCell>

                                <TableCell align="right">
                                  <IconButton
                                    color="primary"
                                    onClick={() => handleView(file.url)}
                                    sx={{ "&:hover": { background: "rgba(0,47,108,0.08)" } }}
                                  >
                                    <VisibilityIcon />
                                  </IconButton>

                                  <IconButton
                                    color="error"
                                    onClick={() => {
                                      setFileToDelete(file);
                                      setOpenConfirm(true);
                                    }}
                                    sx={{ "&:hover": { background: "rgba(228,28,119,0.08)" } }}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} align="center" sx={{ py: 3 }}>
                                <Typography variant="body2" color="text.secondary">
                                  No files match your filters
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Reset button */}
                  <Box sx={{ p: 2, pt: 1 }}>
                    <Button
                      fullWidth
                      sx={{
                        fontWeight: "bold",
                        background: "linear-gradient(90deg, #E41C77, #00ADEF)",
                        color: "white",
                        py: 1,
                      }}
                      onClick={handleResetIndex}
                    >
                      Reset Knowledge Base
                    </Button>
                  </Box>
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
            <DialogTitle sx={{ fontWeight: "bold" }}>Confirm Deletion</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete <strong>{fileToDelete?.name}</strong>?
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