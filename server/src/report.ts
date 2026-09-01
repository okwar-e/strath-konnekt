import { Server, Socket } from "socket.io";
import { prisma } from "./prisma";
import { MatchmakingService } from "./MatchmakingService";

const VALID_REASONS = new Set(["Nudity", "Harassment", "Threats", "Spam", "Other"]);

// Ensures a given match can only ever produce one report, even under retries/races.
const reportedMatchIds = new Set<string>();

// Strikes only count unique reporters — reporting the same person repeatedly
// from one account never pushes them further.
async function applyStrikeRules(reportedId: string) {
  const uniqueReporters = await prisma.report.findMany({
    where: { reportedId },
    distinct: ["reporterId"],
    select: { reporterId: true },
  });

  const uniqueCount = uniqueReporters.length;
  let strikeCount = 0;
  let banned = false;

  if (uniqueCount >= 9) {
    banned = true;
    strikeCount = 3;
  } else if (uniqueCount >= 6) {
    strikeCount = 2;
  } else if (uniqueCount >= 3) {
    strikeCount = 1;
  }

  await prisma.user.update({
    where: { id: reportedId },
    data: { strikeCount, banned },
  });
}

export function registerReporting(io: Server, socket: Socket, matchmaking: MatchmakingService) {
  socket.on("report_user", async (payload: { reason?: string }) => {
    const reason = payload?.reason;
    if (!reason || !VALID_REASONS.has(reason)) return;

    // Only matched users can report each other.
    const match = matchmaking.getActiveMatch(socket.id);
    if (!match) return;

    // One report per match.
    if (reportedMatchIds.has(match.matchId)) return;
    reportedMatchIds.add(match.matchId);

    const reporterId = matchmaking.getUserId(socket.id);
    const reportedId = matchmaking.getUserId(match.partnerSocketId);

    if (reporterId && reportedId) {
      await prisma.report.create({ data: { reporterId, reportedId, reason } });
      await applyStrikeRules(reportedId);
    }

    // Ends the match, applies the skip cooldown, and requeues both users.
    await matchmaking.next(socket);
  });
}
