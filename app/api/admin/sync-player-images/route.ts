import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function isLocalImage(image?: string | null) {
  return !!image && image.startsWith("/players/");
}

function isExternalImage(image?: string | null) {
  return !!image && 
         (image.startsWith("http://") || image.startsWith("https://")) &&
         !image.includes("flagcdn.com");
}

function getBestSportsDbImage(p: any) {
  return (
    p.strCutout ||
    p.strThumb ||
    p.strRender ||
    p.strFanart1 ||
    p.strFanart2 ||
    p.strFanart3 ||
    p.strFanart4 ||
    null
  );
}

function hasAnyImage(p: any) {
  return !!getBestSportsDbImage(p);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || '';
    const isAdmin = session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
    if (!session || !session.user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.THESPORTSDB_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "THESPORTSDB_API_KEY is missing" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const limit = Number(body.limit || 50);

    const assets = await prisma.asset.findMany({
      where: { type: "PLAYER" },
      take: limit,
      orderBy: { name: "asc" },
    });

    const results = [];

    for (const asset of assets) {
      try {
        if (!force && (isLocalImage(asset.image) || isExternalImage(asset.image))) {
          results.push({
            id: asset.id,
            name: asset.name,
            status: "skipped",
            reason: "image already exists",
          });
          continue;
        }

        const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchplayers.php?p=${encodeURIComponent(asset.name)}`;

        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
          results.push({
            id: asset.id,
            name: asset.name,
            status: "failed",
            reason: `TheSportsDB error ${res.status}`,
          });
          continue;
        }

        const data = await res.json();
        const players = data.player || [];

        if (!players.length) {
          results.push({
            id: asset.id,
            name: asset.name,
            status: "not_found",
          });
          continue;
        }

        // Filter for soccer/football players
        const footballPlayers = players.filter((p: any) => {
          const sport = String(p.strSport || "").toLowerCase();
          return sport.includes("soccer") || sport.includes("football");
        });

        // Exact name match priority
        const exactMatch = footballPlayers.find((p: any) =>
          String(p.strPlayer || "").toLowerCase() === asset.name.toLowerCase()
        );

        // Selection: Exact -> Football with image -> Any player with image
        const selected =
          exactMatch ||
          footballPlayers.find(hasAnyImage) ||
          players.find(hasAnyImage);

        const image = selected ? getBestSportsDbImage(selected) : null;

        if (!image) {
          results.push({
            id: asset.id,
            name: asset.name,
            status: "no_image",
          });
          continue;
        }

        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            image,
          },
        });

        results.push({
          id: asset.id,
          name: asset.name,
          status: "updated",
          image,
          providerName: selected?.strPlayer,
        });

        // Sleep to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 250));

      } catch (error: any) {
        results.push({
          id: asset.id,
          name: asset.name,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      notFound: results.filter((r) => r.status === "not_found").length,
      noImage: results.filter((r) => r.status === "no_image").length,
      failed: results.filter((r) => r.status === "failed" || r.status === "error").length,
      results,
    });
  } catch (err: any) {
    console.error("Sync player images handler error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
