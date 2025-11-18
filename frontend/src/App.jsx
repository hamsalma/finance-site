import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import ScrollToTop from "./ScrollToTop";

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
      <ScrollToTop />

      <Routes>
        {/* Page d’accueil */}
        <Route path="/" element={<Home />} />

        {/* Simulation */}
        <Route path="/simulate" element={<SimulationForm />} />

        {/* Comparaison ACWI */}
        <Route path="/compare" element={<Compare />} />

        {/* Prédiction */}
        <Route path="/predict" element={<Predict />} />

        {/* Comparaison stratégies DCA / LumpSum */}
        <Route path="/compare_strategies" element={<Strategies />} />

        {/* Redirection si route inconnue */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
