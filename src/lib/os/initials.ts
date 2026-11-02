export const initials = (name: string | null | undefined) =>
  (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "+";
