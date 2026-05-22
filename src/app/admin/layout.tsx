import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - VeChat" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#0B1418",
        overflow: "auto",
      }}
    >
      {children}
    </div>
  );
}