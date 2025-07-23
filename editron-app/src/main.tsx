import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/tauri-mock";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
