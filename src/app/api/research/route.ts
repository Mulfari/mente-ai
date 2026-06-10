import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

const VPS_HOST = "177.7.46.156";
const VPS_USER = "root";
const VPS_PASS = ";iaOHpMn'J88a'Ww'8eH";

async function sshCommand(cmd: string): Promise<string> {
  const { exec } = await import("child_process");
  return new Promise((resolve, reject) => {
    const script = `
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('${VPS_HOST}', username='${VPS_USER}', password="${VPS_PASS}", allow_agent=False, look_for_keys=False)
stdin, stdout, stderr = client.exec_command(${JSON.stringify(cmd)})
print(stdout.read().decode('utf-8', errors='replace') + stderr.read().decode('utf-8', errors='replace'))
client.close()
`;
    exec(`python -c "${script.replace(/"/g, '\\"')}"`, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout + stderr);
    });
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { query, category, action } = await req.json();

  if (!query || !category) {
    return NextResponse.json({ error: "Missing query or category" }, { status: 400 });
  }

  try {
    if (action === "save") {
      const draftFile = `/root/research-data/draft_${category}.json`;
      const dataFile = `/root/research-data/data_${category}.json`;
      const result = await sshCommand(`python3 /root/research.py save ${draftFile} ${dataFile} 2>&1`);
      return NextResponse.json({ success: true, result });
    }

    if (action === "list") {
      const result = await sshCommand('ls /root/research-data/data_*.json 2>&1');
      return NextResponse.json({ success: true, files: result.trim().split('\n').filter(Boolean) });
    }

    if (action === "get") {
      const dataFile = `/root/research-data/data_${category}.json`;
      const result = await sshCommand(`cat ${dataFile} 2>&1`);
      try {
        const data = JSON.parse(result);
        return NextResponse.json({ success: true, data });
      } catch {
        return NextResponse.json({ error: "Failed to parse data file" }, { status: 500 });
      }
    }

    // Default: run research
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
    const result = await sshCommand(`python3 /root/research.py "${query}" "${category}" 2>&1`);
    const draftFile = `/root/research-data/draft_${category}.json`;
    const draftContent = await sshCommand(`cat ${draftFile} 2>&1`);

    let items: any[] = [];
    try {
      const draft = JSON.parse(draftContent);
      items = draft.items || [];
    } catch {}

    return NextResponse.json({
      success: true,
      query,
      category,
      items,
      count: items.length,
      message: "Results ready for review. Call with action=save to confirm and save."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Research failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    info: "POST to /api/research with { query, category, action? }",
    actions: {
      "none/empty": "Run research and return draft results",
      "save": "Save draft to permanent data file",
      "list": "List all saved data files",
      "get": "Get saved data for a category"
    }
  });
}