import React, { useState } from "react";
import OwnerPropertiesModal from "./OwnerPropertiesModal";

interface RegionClientsModalProps {
  region: { governorate: string; count: number; clients: any[] };
  view: any;
  onClose: () => void;
}

const RegionClientsModal: React.FC<RegionClientsModalProps> = ({ region, view, onClose }) => {
  const [filter, setFilter] = useState<"all" | "owner" | "client">("all");
  const [selectedOwner, setSelectedOwner] = useState<any>(null);

  const filteredClients = region.clients.filter(client => {
    if (filter === "all") return true;
    if (filter === "owner") return client.role === "owner";
    if (filter === "client") return client.role !== "owner";
    return true;
  });

  const getRoleBadge = (role: string) => {
    if (role === "owner") return { label: "Owner", color: "#3fb950", bg: "#1a3a1a" };
    return { label: "Client", color: "#d29922", bg: "#2a2010" };
  };

  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ backgroundColor: "#0d1117", borderRadius: "12px", width: "600px", maxWidth: "94vw", border: "1px solid #30363d", color: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, color: "#58a6ff", fontSize: "18px" }}>📍 {region.governorate}</h2>
              <span style={{ color: "#8b949e", fontSize: "12px" }}>{region.count} client(s) from this region</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", fontSize: "26px", cursor: "pointer" }}>×</button>
          </div>

          <div style={{ display: "flex", gap: "8px", padding: "12px 24px", borderBottom: "1px solid #30363d" }}>
            {(["all", "owner", "client"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold", transition: "all 0.2s", backgroundColor: filter === f ? "#1f6feb" : "#21262d", color: filter === f ? "#fff" : "#8b949e" }}>
                {f === "all" ? "👥 All" : f === "owner" ? "👑 Owners" : "📋 Other Clients"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredClients.length > 0 ? filteredClients.map((client, idx) => {
              const badge = getRoleBadge(client.role);
              return (
                <div key={client._id || idx} onClick={() => client.role === "owner" ? setSelectedOwner(client) : null} style={{ backgroundColor: "#161b22", padding: "12px 16px", borderRadius: "8px", border: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: client.role === "owner" ? "pointer" : "default", transition: "background 0.2s" }} onMouseEnter={e => { if (client.role === "owner") e.currentTarget.style.backgroundColor = "#1f2633"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#161b22"; }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ color: "#e6edf3", fontWeight: "bold", fontSize: "14px" }}>{client.name}</span>
                    <span style={{ color: "#8b949e", fontSize: "12px" }}>📞 {client.phone}</span>
                    {client.email && <span style={{ color: "#8b949e", fontSize: "12px" }}>✉️ {client.email}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}44`, padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" }}>{badge.label}</span>
                    {client.role === "owner" && <span style={{ color: "#58a6ff", fontSize: "11px" }}>View Properties 🏠</span>}
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", color: "#8b949e", padding: "30px 0", fontSize: "14px" }}>No clients found for this filter.</div>
            )}
          </div>
        </div>
      </div>

      {selectedOwner && (
        <OwnerPropertiesModal owner={selectedOwner} view={view} onClose={() => setSelectedOwner(null)} />
      )}
    </>
  );
};

export default RegionClientsModal;
