// Applies the saved theme and language before the first paint, so a user who chose dark (or
// English) never sees a flash of the other one. Loaded as a blocking classic script from
// index.html; kept outside the bundle so the CSP can stay `script-src 'self'`.
(() => {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem("amh:theme");
    if (theme === "light" || theme === "dark") {
      root.dataset.theme = theme;
      // The browser UI follows a forced theme too. Same values as THEME_COLORS in src/lib/theme.ts.
      const color = theme === "dark" ? "#0a1019" : "#eef2f7";
      for (const tag of document.querySelectorAll('meta[name="theme-color"]')) {
        tag.setAttribute("content", color);
      }
    }
    const language = localStorage.getItem("amh:language");
    if (language === "bn" || language === "en") root.lang = language;
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the defaults then apply.
  }
})();
