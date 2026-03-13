import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeSnapshot } from "@/lib/snapshot";
import { getAccountSnapshot, syncAccountSnapshot } from "@/lib/db-progress";
import type { ProgressSnapshot } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getAccountSnapshot(userId);
  return NextResponse.json({ snapshot });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { snapshot?: ProgressSnapshot };
  if (!payload.snapshot) {
    return NextResponse.json({ error: "Missing snapshot" }, { status: 400 });
  }

  const normalized = normalizeSnapshot(payload.snapshot);
  const snapshot = await syncAccountSnapshot(userId, normalized);
  return NextResponse.json({ snapshot });
}
