import { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(setData);
  }, []);
  return (
    <div>
      <h1>Site financier</h1>
      <p>Backend status: {data ? data.status : "..."}</p>
    </div>
  );
}

export default App;
