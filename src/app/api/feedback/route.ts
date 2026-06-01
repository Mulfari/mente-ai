import { NextResponse } from "next/server";

const VPS_URL = process.env.VPS_URL || "http://localhost:3000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${VPS_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Feedback Proxy] Error:", err);
    return NextResponse.json({ error: "Error al guardar feedback" }, { status: 500 });
  }
}