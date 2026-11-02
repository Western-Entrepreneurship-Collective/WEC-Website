// Each team keeps one colour and code everywhere, so a team reads the same on every screen.
const LOOKS: Record<string, { code: string; tile: string }> = {
  "President's Office": { code: "PO", tile: "#1E1626" },
  Events: { code: "EV", tile: "#B0266F" },
  Operations: { code: "OP", tile: "#4A4453" },
  Community: { code: "CM", tile: "#0F6674" },
  Content: { code: "CO", tile: "#582C83" },
  Outreach: { code: "OU", tile: "#034638" },
  Sponsorship: { code: "SP", tile: "#8A4B08" },
  "Venture Development": { code: "VD", tile: "#5A5F0A" },
  Finance: { code: "FI", tile: "#1F4E79" },
  Communications: { code: "CN", tile: "#2F5FB3" },
};

// A team an administrator adds later still gets a tile.
export const teamLook = (name: string | null | undefined) => (name && LOOKS[name]) || { code: (name ?? "?").slice(0, 2).toUpperCase(), tile: "#582C83" };
