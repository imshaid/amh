import "./styles/index.css";
import "./i18n/i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root is missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <main />
  </StrictMode>,
);
