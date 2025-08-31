import { createRoot } from "react-dom/client";

console.log("Test app starting...");

function TestApp() {
  console.log("TestApp rendering");
  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0", minHeight: "100vh" }}>
      <h1>Test App is Working!</h1>
      <p>If you can see this, React is loading correctly.</p>
      <button onClick={() => alert("Button clicked!")}>Test Button</button>
    </div>
  );
}

const rootElement = document.getElementById("root");
console.log("Test app root element:", rootElement);

if (rootElement) {
  console.log("Creating test app root...");
  const root = createRoot(rootElement);
  root.render(<TestApp />);
  console.log("Test app rendered");
} else {
  console.error("Root element not found!");
}