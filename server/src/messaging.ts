import { Server, Socket } from "socket.io";
import { MatchmakingService } from "./MatchmakingService";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MAX_MESSAGES = 5;
const RATE_LIMIT_WINDOW_MS = 3000;

const messageTimestamps = new Map<string, number[]>(); // socketId -> recent send timestamps

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const recent = (messageTimestamps.get(socketId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
    messageTimestamps.set(socketId, recent);
    return true;
  }

  recent.push(now);
  messageTimestamps.set(socketId, recent);
  return false;
}

function sanitize(raw: string): string {
  const withoutControlChars = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return withoutControlChars.replace(/\s+/g, " ").trim();
}

// Ephemeral relay only: messages are never persisted, only forwarded between
// the two sockets currently paired in an active match.
export function registerMessaging(io: Server, socket: Socket, matchmaking: MatchmakingService) {
  socket.on("send_message", (payload: { text?: string }) => {
    const match = matchmaking.getActiveMatch(socket.id);
    if (!match) return;

    if (isRateLimited(socket.id)) return;

    const text = sanitize(payload?.text ?? "");
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;

    const timestamp = Date.now();
    const partnerSocket = io.sockets.sockets.get(match.partnerSocketId);

    socket.emit("receive_message", { text, sender: "self", timestamp });
    partnerSocket?.emit("receive_message", { text, sender: "stranger", timestamp });
  });

  socket.on("disconnect", () => {
    messageTimestamps.delete(socket.id);
  });
}
