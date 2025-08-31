import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

console.log("Main.tsx loading...");

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

if (rootElement) {
  console.log("Creating React root...");
  try {
    const root = createRoot(rootElement);
    console.log("Rendering App component...");
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log("App rendered successfully");
  } catch (error) {
    console.error("Error rendering app:", error);
    // Display error in DOM
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h1>Error Loading Application</h1>
        <pre>${error}</pre>
      </div>
    `;
  }
} else {
  console.error("Root element not found!");
  document.body.innerHTML = '<h1>Root element not found!</h1>';
}
