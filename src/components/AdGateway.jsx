// src/components/AdGateway.jsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function AdGateway() {
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const next = params.get("next") || "";

  useEffect(() => {
    // Wait 2–3 seconds for vignette ad
    const timer = setTimeout(() => {
      navigate(`/${next}`);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>Loading...</h2>
      <p>Preparing your reward...</p>
    </div>
  );
}
