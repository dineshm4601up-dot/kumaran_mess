import { NextResponse } from "next/server";
import { searchAddress } from "@/lib/geocoding/geocode";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";

  if (query.trim().length < 3) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchAddress(query);
  return NextResponse.json({ results });
}
