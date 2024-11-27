import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  );