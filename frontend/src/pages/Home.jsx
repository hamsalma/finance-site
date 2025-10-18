import React from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const Home = () => {
  const navigate = useNavigate();

  const lineData = [
    { month: "Jan", value: 1000 },
    { month: "Fév", value: 1200 },
    { month: "Mar", value: 1500 },
    { month: "Avr", value: 1800 },
    { month: "Mai", value: 2100 },
    { month: "Juin", value: 2500 },
  ];

  const pieData = [
    { name: "Actions", value: 65 },
    { name: "Obligations", value: 25 },
    { name: "ETF", value: 10 },
  ];

  const barData = [
    { name: "2020", rendement: 6.5 },
    { name: "2021", rendement: 8.2 },
    { name: "2022", rendement: 3.1 },
    { name: "2023", rendement: 9.4 },
  ];

  const COLORS = ["#6a5acd", "#483d8b", "#9b8cff"];

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-text">
          <h1>Commencez votre investissement dès aujourd’hui</h1>
          <p>
            Simulez vos rendements, explorez vos stratégies d’investissement et optimisez votre portefeuille.
          </p>
          <button className="cta-button" onClick={() => navigate("/simulate")}>
            Lancer une simulation
          </button>
        </div>

        <div className="home-graphs">
          <div className="graph-card">
            <h3>Évolution du portefeuille</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData}>
                <Line type="monotone" dataKey="value" stroke="#7b68ee" strokeWidth={3} />
                <XAxis dataKey="month" stroke="#aaa" />
                <YAxis hide />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="graph-card">
            <h3>Allocation d’actifs</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={5}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="graph-card full-width">
            <h3>Rendements annuels (%)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData}>
                <XAxis dataKey="name" stroke="#aaa" />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="rendement" fill="#6a5acd" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
