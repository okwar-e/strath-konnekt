import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { registerMatchmaking } from "./matchmaking";
import { registerMessaging } from "./messaging";
import { registerReporting } from "./report";
import { MatchmakingService } from "./MatchmakingService";

// Socket.IO foundation: connection/disconnect logging + matchmaking queue + messaging + reporting.
export function initSocket(httpServer: HttpServer, clientUrl: string): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ["GET", "POST"],
    },
  });

  const matchmaking = new MatchmakingService(io);

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    console.log(`[DEBUG] Socket connected with socket ID: ${socket.id}`);

    registerMatchmaking(io, socket, matchmaking);
    registerMessaging(io, socket, matchmaking);
    registerReporting(io, socket, matchmaking);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
