import { Server, Socket } from "socket.io";
import { prisma } from "./prisma";
import { firebaseAuth } from "./firebaseAdmin";
import { MatchmakingService } from "./MatchmakingService";

// Wires Socket.IO events to the MatchmakingService. Auth verification happens
// here since join_queue is the only event that needs to resolve a Prisma user.
export function registerMatchmaking(io: Server, socket: Socket, matchmaking: MatchmakingService) {
  socket.on("join_queue", async (payload: { idToken?: string }) => {
    console.log(`[DEBUG] join_queue received from socket ${socket.id}`);
    try {
      const idToken = payload?.idToken;
      if (!idToken) {
        console.log(`[DEBUG] join_queue rejected: missing idToken (socket ${socket.id})`);
        socket.emit("queue_error", { error: "Missing auth token" });
        return;
      }

      const decoded = await firebaseAuth().verifyIdToken(idToken);
      console.log(`[DEBUG] Firebase token verification success for socket ${socket.id}`, {
        email: decoded.email,
      });
      if (!decoded.email) {
        console.log(`[DEBUG] join_queue rejected: token has no email (socket ${socket.id})`);
        socket.emit("queue_error", { error: "Invalid auth token" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: decoded.email.toLowerCase() },
      });

      if (!user || user.banned) {
        console.log(`[DEBUG] join_queue rejected: user not found or banned (socket ${socket.id})`, {
          email: decoded.email,
        });
        socket.emit("queue_error", { error: "Not authorized to join the queue" });
        return;
      }

      console.log(`[DEBUG] User ID resolved for socket ${socket.id}: ${user.id}`);
      await matchmaking.enqueue(socket, user.id);
    } catch (err) {
      console.log(`[DEBUG] Firebase token verification FAILED for socket ${socket.id}`, err);
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
