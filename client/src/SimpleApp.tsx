import { Switch, Route } from "wouter";
import Login from "./pages/Login";
import Dashboard from "./pages/dashboard";

function SimpleApp() {
  console.log("SimpleApp rendering");
  
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <h1 style={{ padding: "20px", textAlign: "center" }}>Solicitor Brain v2</h1>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route>
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h2>404 - Page not found</h2>
          </div>
        </Route>
      </Switch>
    </div>
  );
}

export default SimpleApp;