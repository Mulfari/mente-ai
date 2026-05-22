import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin - VeChat" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body::before, body::after { display: none !important; }
      `}</style>
      {children}
    </>
  );
}