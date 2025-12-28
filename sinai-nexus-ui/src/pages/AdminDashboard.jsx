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
 
 
 import { useState, useEffect, forwardRef } from "react";
 import { useNavigate } from "react-router-dom";
 import MSLogoWhite from "../assets/MSLogoWhite.png";
 import { supabase } from '../api/supabaseClient';
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
       const safeFolder = fileType.replace(/\//g, "_").replace(/ /g, "_"); // Locations_Rooms, General_Tips 
      const filePath = `${safeFolder}/${file.name}`;
     try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
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
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
      });
    }
    else {
      // Everything else → /upload
      const formData = new FormData();
      formData.append("file", file);           // actual File object
      formData.append("priority", "3");        // default priority (JSON notes can override to 1)
      formData.append("path", fullPath);       //Path for file
 
 
      await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,                        // multipart/form-data
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
      }
       else if (
        err.message &&
        err.message.includes("The resource") &&
        err.message.includes("already exists")
      ) {
        setAlert({
          open:true,
          msg: "A file with this name already exists. To replace it, delete the existing file and upload the new one",
          type: "error",
        });
      }
       else {console.error(err);
      setAlert({
        open: true,
        msg: "Error uploading file.",
        type: "error",
      });}
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
  // -----------------------------
// Add text note
// -----------------------------
  const handleAddPolicy = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    const noteData = {
      title: noteTitle.trim(),
      content: noteContent.trim(),
      created_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(noteData, null, 2)], {
      type: "application/json",
    });
    // Sanitize filename and add .json extension
    const sanitizedTitle = noteTitle.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${sanitizedTitle}.json`;
    // Upload locations
    const uploads = [
      { bucket: "epic-scheduling", folder: "Scheduling_Notes" },
      { bucket: "other-content", folder: "Other_Notes" },
    ];
    try {
      let publicUrl = null;
      for (const { bucket, folder } of uploads) {
        const safeFolder = folder.replace(/\//g, "_").replace(/ /g, "_");
        const filePath = `${safeFolder}/${fileName}`;
        // Upload
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


        // Other_Notes → /upload (UploadFile + priority)
        if (folder === "Other_Notes") {
          // Convert Blob to File with proper filename
          const file = new File([blob], fileName, { type: "application/json" });
          
          const formData = new FormData();
          formData.append("file", file);  // Send File object instead of Blob
          formData.append("priority", "1");
          formData.append("path", `${bucket}/${filePath}`);


          await fetch("http://127.0.0.1:8000/upload", {
            method: "POST",
            body: formData,
          });
        }


        //  Scheduling_Notes → skip for now (folder === "Scheduling_Notes")
        else {
          // intentionally do nothing
          console.log("Skipping Scheduling_Notes backend upload for now.");
        }
      }
      // Add to React state using real Supabase URL
      const newNote = {
        name: fileName,
        type: "note",
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
      // Reload lists
      loadAllFiles();
    }
    catch (err) {
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
     for(const folder of loc_folders) {
      const { data: locRooms, error: err1 } = await supabase.storage
        .from("epic-scheduling")
        .list(folder, { limit: 200 });
      if (err1) console.error(err1);
      else {
        locRooms.forEach((f) =>
          results.push({
            name: f.name,
            bucket: "epic-scheduling",
            folder,
            fullPath: `${folder}/${f.name}`,
            url: supabase.storage
              .from("epic-scheduling")
              .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
              type: folder === "Scheduling_Notes" ? "note" : "protocol"
          })
        );
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
        data.forEach((f) =>
          results.push({
            name: f.name,
            bucket: "other-content",
            folder,
            fullPath: `${folder}/${f.name}`,
            url: supabase.storage
              .from("other-content")
              .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
              type: folder === "Other_Notes" ? "note" : "protocol"
             
          })
        );
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
  
      // If it's a note that was uploaded to both buckets, delete from the other bucket too
      if (file.type === "note") {
        const otherBucket = file.bucket === "epic-scheduling" ? "other-content" : "epic-scheduling";
        const otherFolder = file.bucket === "epic-scheduling" ? "Other_Notes" : "Scheduling_Notes";
        const otherPath = `${otherFolder}/${file.name}`;
        const otherFullPath = `${otherBucket}/${otherPath}`;
        
        // Also delete embeddings for the other bucket path
        await fetch("http://127.0.0.1:8000/delete-file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ file_path: otherFullPath }),
        });
        
        // Delete from the other storage bucket (ignore errors if it doesn't exist)
        await supabase.storage.from(otherBucket).remove([otherPath]);
      }
  
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
                    onClick={() => selectedFile && handleUploadSupabase(selectedFile)}
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
                          handleUploadSupabase(selectedFile)
                          .then(() => {
                            // Refresh list after successful upload
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
                                    setFileToDelete(file);
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
                <strong>{fileToDelete?.name}</strong>?
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