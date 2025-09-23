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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useState } from "react";
import { useNavigate } from "react-router-dom";


function AdminDashboard() {
  const [files, setFiles] = useState([]);
  const [newPolicy, setNewPolicy] = useState("");
  const navigate = useNavigate();

  const handleFileUpload = (event) => {
    const uploaded = Array.from(event.target.files);
    setFiles([...files, ...uploaded.map((f) => f.name)]);
  };

  const handleAddPolicy = () => {
    if (!newPolicy.trim()) return;
    setFiles([...files, newPolicy]);
    setNewPolicy("");
  };

  const handleLogout = () => {
    // clear any local auth if needed
    navigate("/login"); 
  };


  return (
    <Box sx={{ bgcolor: "#F9F9F9", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#002F6C" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6" color="inherit">
            Mount Sinai Radiology Admin
          </Typography>
          <Button color="inherit" variant="outlined" sx={{ borderColor: "white" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <Grid container spacing={3}>
          {/* Upload Section */}
          <Grid item xs={12} md={4}>
            <Paper elevation={4} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" gutterBottom>
                Upload Protocol Files
              </Typography>
              <Button
                variant="contained"
                component="label"
                sx={{ bgcolor: "#002F6C", "&:hover": { bgcolor: "#001B40" } }}
              >
                Upload Files
                <input hidden type="file" multiple onChange={handleFileUpload} />
              </Button>
            </Paper>
          </Grid>

          {/* Policy Editor */}
          <Grid item xs={12} md={4}>
            <Paper elevation={4} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" gutterBottom>
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
                  bgcolor: "#E41C2C",
                  "&:hover": { bgcolor: "#B3141F" },
                }}
                variant="contained"
                fullWidth
                onClick={handleAddPolicy}
              >
                Save Policy
              </Button>
            </Paper>
          </Grid>

          {/* Uploaded Policies */}
          <Grid item xs={12} md={4}>
            <Paper elevation={4} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" gutterBottom>
                Uploaded Policies
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Policy / File</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.map((f, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{f}</TableCell>
                        <TableCell align="right">
                          <IconButton color="primary">
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton color="error">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
