import { Server, Socket } from "socket.io";
import { prisma } from "./prisma";
import { firebaseAuth } from "./firebaseAdmin";
import { MatchmakingService } from "./MatchmakingService";

// Wires Socket.IO events to the MatchmakingService. Auth verification happens
// here since join_queue is the only event that needs to resolve a Prisma user.
export function registerMatchmaking(io: Server, socket: Socket, matchmaking: MatchmakingService) {
  socket.on("join_queue", async (payload: { idToken?: string }) => {
    try {
      const idToken = payload?.idToken;
      if (!idToken) {
        socket.emit("queue_error", { error: "Missing auth token" });
        return;
      }

      const decoded = await firebaseAuth().verifyIdToken(idToken);
      if (!decoded.email) {
        socket.emit("queue_error", { error: "Invalid auth token" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: decoded.email.toLowerCase() },
      });

      if (!user || user.banned) {
        socket.emit("queue_error", { error: "Not authorized to join the queue" });
        return;
      }

      await matchmaking.enqueue(socket, user.id);
    } catch {
      socket.emit("queue_error", { error: "Authentication failed" });
    }
  });

  socket.on("leave_queue", () => {
    matchmaking.dequeue(socket);
  });

  socket.on("next_stranger", () => {
    matchmaking.next(socket);
  });

  socket.on("disconnect", () => {
    matchmaking.disconnect(socket);
  });
}
