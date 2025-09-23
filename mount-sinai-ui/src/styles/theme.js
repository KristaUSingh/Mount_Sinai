import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#002F6C", // Mount Sinai Blue
    },
    secondary: {
      main: "#E41C2C", // Mount Sinai Red
    },
    background: {
      default: "#ffffff",
    },
  },
  typography: {
    fontFamily: "Arial, sans-serif",
  },
});

export default theme;
