import { Server, Socket } from "socket.io";
import { prisma } from "./prisma";

interface QueueEntry {
  socketId: string;
  userId: string;
}

export interface ActiveMatch {
  matchId: string;
  roomId: string;
  partnerSocketId: string;
}

interface CooldownEntry {
  partnerUserId: string;
  expiresAt: number;
}

const LAST_PARTNER_COOLDOWN_MS = 10_000;

/**
 * Encapsulates all matchmaking state and rules behind a small service interface
 * (enqueue/dequeue/next/disconnect) so the in-memory implementation can later be
 * swapped for something like Redis without touching the Socket.IO wiring.
 */
export class MatchmakingService {
  private queue: QueueEntry[] = [];
  private socketUsers = new Map<string, string>(); // socketId -> userId
  private activeMatches = new Map<string, ActiveMatch>(); // socketId -> match info
  private lastPartner = new Map<string, CooldownEntry>(); // userId -> recent partner + expiry

  constructor(private io: Server) {}

  getActiveMatch(socketId: string): ActiveMatch | undefined {
    return this.activeMatches.get(socketId);
  }

  getUserId(socketId: string): string | undefined {
    return this.socketUsers.get(socketId);
  }

  async enqueue(socket: Socket, userId: string) {
    this.socketUsers.set(socket.id, userId);
    // One user can only appear once in the queue.
    this.removeFromQueueByUserId(userId);
    this.queue.push({ socketId: socket.id, userId });
    socket.emit("searching");

    await this.tryMatch();
  }

  async dequeue(socket: Socket) {
    this.removeFromQueueBySocketId(socket.id);
    const match = await this.endActiveMatch(socket.id);
    if (!match) return;

    const partnerSocket = this.io.sockets.sockets.get(match.partnerSocketId);
    const partnerUserId = this.socketUsers.get(match.partnerSocketId);
    if (partnerSocket && partnerUserId) {
      this.requeue(partnerSocket, partnerUserId, "disconnected");
      await this.tryMatch();
    }
  }

  async next(socket: Socket) {
    const match = await this.endActiveMatch(socket.id);
    if (!match) return;

    const selfUserId = this.socketUsers.get(socket.id);
    const partnerSocket = this.io.sockets.sockets.get(match.partnerSocketId);
    const partnerUserId = this.socketUsers.get(match.partnerSocketId);

    if (selfUserId && partnerUserId) {
      this.setLastPartner(selfUserId, partnerUserId);
    }

    if (selfUserId) this.requeue(socket, selfUserId, "next");
    if (partnerSocket && partnerUserId) this.requeue(partnerSocket, partnerUserId, "next");

    await this.tryMatch();

    // If they're the only two people online, retry once the cooldown expires.
    if (selfUserId && partnerUserId) {
      setTimeout(() => {
        this.tryMatch();
      }, LAST_PARTNER_COOLDOWN_MS + 50);
    }
  }

  async disconnect(socket: Socket) {
    this.removeFromQueueBySocketId(socket.id);
    const match = await this.endActiveMatch(socket.id);

    if (match) {
      const partnerSocket = this.io.sockets.sockets.get(match.partnerSocketId);
      const partnerUserId = this.socketUsers.get(match.partnerSocketId);
      if (partnerSocket && partnerUserId) {
        this.requeue(partnerSocket, partnerUserId, "disconnected");
        await this.tryMatch();
      }
    }

    this.socketUsers.delete(socket.id);
  }

  private removeFromQueueByUserId(userId: string) {
    const idx = this.queue.findIndex((e) => e.userId === userId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  private removeFromQueueBySocketId(socketId: string) {
    const idx = this.queue.findIndex((e) => e.socketId === socketId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  private requeue(socket: Socket, userId: string, reason: "next" | "disconnected") {
    this.removeFromQueueByUserId(userId);
    this.queue.push({ socketId: socket.id, userId });
    socket.emit("returned_to_queue", { reason });
  }

  private setLastPartner(userIdA: string, userIdB: string) {
    const expiresAt = Date.now() + LAST_PARTNER_COOLDOWN_MS;
    this.lastPartner.set(userIdA, { partnerUserId: userIdB, expiresAt });
    this.lastPartner.set(userIdB, { partnerUserId: userIdA, expiresAt });
  }

  private isOnCooldown(userIdA: string, userIdB: string): boolean {
    const entry = this.lastPartner.get(userIdA);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.lastPartner.delete(userIdA);
      return false;
    }
    return entry.partnerUserId === userIdB;
  }

  private async tryMatch() {
    let matchedInPass = true;

    while (matchedInPass) {
      matchedInPass = false;

      for (let i = 0; i < this.queue.length && !matchedInPass; i++) {
        for (let j = i + 1; j < this.queue.length; j++) {
          const a = this.queue[i];
          const b = this.queue[j];

          // Never match a user with themselves.
          if (a.userId === b.userId) continue;
          // Skip an immediate rematch with the stranger they just skipped.
          if (this.isOnCooldown(a.userId, b.userId)) continue;

          this.queue.splice(j, 1);
          this.queue.splice(i, 1);

          await this.createMatch(a, b);
          matchedInPass = true;
          break;
        }
      }
    }
  }

  private async createMatch(a: QueueEntry, b: QueueEntry) {
    const aSocket = this.io.sockets.sockets.get(a.socketId);
    const bSocket = this.io.sockets.sockets.get(b.socketId);

    if (!aSocket && !bSocket) return;
    if (!aSocket) {
      this.queue.push(b);
      return;
    }
    if (!bSocket) {
      this.queue.push(a);
      return;
    }

    const match = await prisma.match.create({
      data: { user1Id: a.userId, user2Id: b.userId },
    });
    const roomId = match.id;

    aSocket.join(roomId);
    bSocket.join(roomId);

    this.activeMatches.set(a.socketId, { matchId: match.id, roomId, partnerSocketId: b.socketId });
    this.activeMatches.set(b.socketId, { matchId: match.id, roomId, partnerSocketId: a.socketId });

    aSocket.emit("matched");
    bSocket.emit("matched");
  }

  private async endActiveMatch(socketId: string) {
    const match = this.activeMatches.get(socketId);
    if (!match) return null;

    this.activeMatches.delete(socketId);
    this.activeMatches.delete(match.partnerSocketId);

    this.io.sockets.sockets.get(socketId)?.leave(match.roomId);
    this.io.sockets.sockets.get(match.partnerSocketId)?.leave(match.roomId);

    await prisma.match
      .update({ where: { id: match.matchId }, data: { endedAt: new Date() } })
      .catch(() => {});

    return match;
  }
}
