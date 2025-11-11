import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SimulationForm from "./components/SimulationForm";
import Compare from "./pages/Compare";
import Predict from "./pages/Predict";
import Home from "./pages/Home";
import Strategies from "./pages/Strategies";
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
        {/* Page de comparaison */}
        <Route path="/compare" element={<Compare />} />
        {/* Page de prediction */}
        <Route path="/predict" element={<Predict />} />
        {/* Page de comparaison strategies */}
        <Route path="/compare_strategies" element={<Strategies />} />

      </Routes>
    </Router>
  );
}

export default App;
