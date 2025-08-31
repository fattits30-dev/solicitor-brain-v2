import { createRoot } from "react-dom/client";

// Ultra simple component with no dependencies
function UltraSimple() {
  return (
    <div style={{ padding: "50px", fontSize: "24px", backgroundColor: "lightblue" }}>
      <h1>React is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
      <button onClick={() => alert("Button clicked!")}>Test Button</button>
    </div>
  );
}

// Direct rendering without any wrappers
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<UltraSimple />);
  console.log("Ultra simple app rendered");
} else {
  document.body.innerHTML = '<h1 style="color: red;">No root element found!</h1>';
}