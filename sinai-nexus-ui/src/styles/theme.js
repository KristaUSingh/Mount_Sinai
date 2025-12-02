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
    fontFamily: `"Inter", sans-serif`,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "@global": {
          /* BODY GLOWS — TOP LEFT + TOP RIGHT */
          body: {
            fontFamily: `"Inter", sans-serif !important`,
            background: "linear-gradient(135deg, #eef3ff 0%, #ffffff 60%)",
            overflowX: "hidden",
            position: "relative",
            minHeight: "100vh",
          },

          /* TOP-LEFT */
          "body::before": {
            content: '""',
            position: "fixed",
            top: "-80px",
            left: "-80px",
            width: "450px",
            height: "450px",
            background: "radial-gradient(circle, #a3d8ff66, transparent 70%)",
            filter: "blur(30px)",
            zIndex: -2,
          },

          /* TOP-RIGHT */
          "body::after": {
            content: '""',
            position: "fixed",
            top: "-80px",
            right: "-80px",
            width: "450px",
            height: "450px",
            background: "radial-gradient(circle, #00adef66, transparent 70%)",
            filter: "blur(30px)",
            zIndex: -2,
          },

          /* ROOT GLOWS — BOTTOM LEFT + BOTTOM RIGHT */
          "#root::before": {
            content: '""',
            position: "fixed",
            bottom: "-80px",
            left: "-80px",
            width: "450px",
            height: "450px",
            background: "radial-gradient(circle, #e41c7766, transparent 70%)",
            filter: "blur(30px)",
            zIndex: -2,
          },

          "html::after": {
            content: '""',
            position: "fixed",
            bottom: "40px",        // moved UP
            right: "40px",         // moved INWARD
            width: "380px",        // smaller so it doesn’t collide
            height: "380px",
            background: "radial-gradient(circle, #642f6c88, transparent 70%)",
            filter: "blur(35px)",
            zIndex: -1,            // above #root glows, below content
          },

          
        },
      },
    },
  },
});

export default theme;
