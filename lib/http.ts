import { NextResponse } from "next/server";

export function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new NextResponse(JSON.stringify(body, null, 2), {
    ...init,
    headers,
  });
}
