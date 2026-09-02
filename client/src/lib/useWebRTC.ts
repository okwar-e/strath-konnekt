import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Manages a single peer-to-peer video/audio call over the existing Socket.IO
 * connection (used only for signaling: webrtc_offer/answer/ice_candidate).
 * Starts capturing media and negotiating as soon as `active` becomes true,
 * and fully tears everything down (tracks, peer connection, video elements)
 * whenever `active` becomes false or the component unmounts — this covers
 * Next, End, and disconnect, since all three flip matchmaking status away
 * from "connected".
 */
export function useWebRTC(active: boolean, isInitiator: boolean) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    const localVideoEl = localVideoRef.current;
    const remoteVideoEl = remoteVideoRef.current;

    let cancelled = false;
    let peer: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;

    async function handleOffer({ offer }: { offer: RTCSessionDescriptionInit }) {
      if (!peer) return;
      console.log("[WEBRTC-DEBUG] Received offer");
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[WEBRTC-DEBUG] Remote description set (offer)");
      console.log("[WEBRTC-DEBUG] Creating answer");
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.log("[WEBRTC-DEBUG] Local description set (answer)");
      socket.emit("webrtc_answer", { answer });
    }

    async function handleAnswer({ answer }: { answer: RTCSessionDescriptionInit }) {
      if (!peer) return;
      console.log("[WEBRTC-DEBUG] Received answer");
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("[WEBRTC-DEBUG] Remote description set (answer)");
    }

    async function handleIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      if (!peer || !candidate) return;
      console.log("[WEBRTC-DEBUG] ICE candidate received", candidate);
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Late/invalid candidates are safe to ignore.
      }
    }

    async function start() {
      setMediaError(null);

      console.log("[WEBRTC-DEBUG] getUserMedia: requesting permissions");
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("[WEBRTC-DEBUG] getUserMedia: permission granted");
        console.log(
          `[WEBRTC-DEBUG] getUserMedia: number of local tracks = ${localStream.getTracks().length}`,
          localStream.getTracks().map((t) => t.kind)
        );
      } catch (err) {
        console.log("[WEBRTC-DEBUG] getUserMedia: permission denied", err);
        setMediaError("Camera or microphone access is required.");
        return;
      }

      if (cancelled) {
        localStream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (localVideoEl) {
        localVideoEl.srcObject = localStream;
        console.log("[WEBRTC-DEBUG] Video: local video attached");
      }

      console.log("[WEBRTC-DEBUG] Peer connection: creating RTCPeerConnection");
      peer = new RTCPeerConnection(RTC_CONFIG);
      localStream.getTracks().forEach((track) => peer!.addTrack(track, localStream!));

      peer.ontrack = (event) => {
        console.log("[WEBRTC-DEBUG] Video: remote stream received (ontrack)");
        if (remoteVideoEl) remoteVideoEl.srcObject = event.streams[0];
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[WEBRTC-DEBUG] ICE candidate generated", event.candidate);
          socket.emit("webrtc_ice_candidate", { candidate: event.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        console.log(`[WEBRTC-DEBUG] connectionState: ${peer?.connectionState}`);
      };

      peer.oniceconnectionstatechange = () => {
        console.log(`[WEBRTC-DEBUG] ICE: ${peer?.iceConnectionState}`);
      };

      peer.onsignalingstatechange = () => {
        console.log(`[WEBRTC-DEBUG] signalingState: ${peer?.signalingState}`);
      };

      socket.on("webrtc_offer", handleOffer);
      socket.on("webrtc_answer", handleAnswer);
      socket.on("webrtc_ice_candidate", handleIceCandidate);

      if (isInitiator) {
        console.log("[WEBRTC-DEBUG] Peer connection: creating offer");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        console.log("[WEBRTC-DEBUG] Local description set (offer)");
        socket.emit("webrtc_offer", { offer });
      }
    }

    start();

    return () => {
      cancelled = true;

      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);

      peer?.close();
      peer = null;

      localStream?.getTracks().forEach((track) => track.stop());
      localStream = null;

      if (localVideoEl) localVideoEl.srcObject = null;
      if (remoteVideoEl) remoteVideoEl.srcObject = null;
    };
  }, [active, isInitiator]);

  return { localVideoRef, remoteVideoRef, mediaError };
}
