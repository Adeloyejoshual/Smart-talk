export default function TabButton({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        fontSize: 16,
        color: active ? "#007bff" : "#666",
        fontWeight: active ? "600" : "400",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}
