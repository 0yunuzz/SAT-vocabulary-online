import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeSnapshot } from "@/lib/snapshot";
import { mergeGuestIntoAccount } from "@/lib/db-progress";
import type { MergeStrategy, ProgressSnapshot } from "@/lib/types";

function isMergeStrategy(value: string): value is MergeStrategy {
  return value === "keep_account" || value === "replace_account" || value === "merge";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    strategy?: string;
    localSnapshot?: ProgressSnapshot;
  };

  if (!payload.strategy || !isMergeStrategy(payload.strategy)) {
    return NextResponse.json({ error: "Invalid strategy" }, { status: 400 });
  }
  if (!payload.localSnapshot) {
    return NextResponse.json({ error: "Missing local snapshot" }, { status: 400 });
  }

  const snapshot = await mergeGuestIntoAccount(
    userId,
    normalizeSnapshot(payload.localSnapshot),
    payload.strategy
  );

  return NextResponse.json({ snapshot });
}
