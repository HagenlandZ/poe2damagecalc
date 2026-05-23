import { useState } from "react";
import "./App.css";
import { SimpleDamage } from "./views/SimpleDamage";
import { ReferenceDamage } from "./views/ReferenceDamage";

type Page = "simple" | "reference";

function App() {
  const [page, setPage] = useState<Page>("simple");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__left">
          <h1>POE2 Damage Dealer</h1>
          <p>
            {page === "simple"
              ? "Interactive damage calculator"
              : "Full pipeline reference — Stage 1: Single Hit"}
          </p>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${page === "simple" ? "nav-btn--active" : ""}`}
            onClick={() => setPage("simple")}
          >
            Calculator
          </button>
          <button
            className={`nav-btn ${page === "reference" ? "nav-btn--active" : ""}`}
            onClick={() => setPage("reference")}
          >
            Reference
          </button>
        </nav>
      </header>

      {page === "simple" ? <SimpleDamage /> : <ReferenceDamage />}
    </div>
  );
}

export default App;
