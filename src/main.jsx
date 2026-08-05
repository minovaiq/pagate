import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "./styles/global.css";

import { registerPushServiceWorker } from "./services/pushNotifications";

registerPushServiceWorker().catch((error) => {
  console.warn("Push service worker registration failed:", error);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);