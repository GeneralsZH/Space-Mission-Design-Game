import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { publicAsset } from "./features/publicAsset";
import "./styles.css";
import "./immersive.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(publicAsset("sw.js"), { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        /* Local persistence and the current page remain usable if caching is unavailable. */
      });
  });
}
