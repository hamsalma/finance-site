import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SimulationForm from "./components/SimulationForm";
import Home from "./pages/Home";
import "./index.css";
import "./styles/Home.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Page d'accueil */}
        <Route path="/" element={<Home />} />

        {/* Page de simulation */}
        <Route path="/simulate" element={<SimulationForm />} />

        {/* Redirection si route inconnue */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
