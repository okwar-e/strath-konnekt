import { Server, Socket } from "socket.io";
import { MatchmakingService } from "./MatchmakingService";

// Pure relay: forwards each signaling message to the sender's matched partner only.
// No persistence, no inspection of SDP/ICE payloads.
export function registerWebRTC(io: Server, socket: Socket, matchmaking: MatchmakingService) {
  function relayToPartner(event: string) {
    return (payload: unknown) => {
      const match = matchmaking.getActiveMatch(socket.id);
      if (!match) return;

      io.sockets.sockets.get(match.partnerSocketId)?.emit(event, payload);
    };
  }

  socket.on("webrtc_offer", relayToPartner("webrtc_offer"));
  socket.on("webrtc_answer", relayToPartner("webrtc_answer"));
  socket.on("webrtc_ice_candidate", relayToPartner("webrtc_ice_candidate"));
}
