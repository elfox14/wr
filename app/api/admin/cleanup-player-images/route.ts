import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function isEmoji(value: string) {
  if (!value) return false;
  return (
    value.length <= 8 &&
    /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u.test(value)
  );
}

function shouldCleanImage(image?: string | null) {
  if (!image) return true;
  if (image === "👤") return true;
  if (isEmoji(image)) return true;
  if (image.includes("flagcdn.com")) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.email !== "admin@worldcup.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const players = await prisma.asset.findMany({
      where: { type: "PLAYER" },
      select: { id: true, name: true, image: true }
    });

    const cleanedPlayers = [];

    for (const player of players) {
      if (shouldCleanImage(player.image)) {
        await prisma.asset.update({
          where: { id: player.id },
          data: { image: "" }
        });
        cleanedPlayers.push({ id: player.id, name: player.name, previousImage: player.image });
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: players.length,
      totalCleaned: cleanedPlayers.length,
      cleaned: cleanedPlayers
    });
  } catch (err: any) {
    console.error("Cleanup player images error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
