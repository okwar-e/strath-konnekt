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
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("webrtc_answer", { answer });
    }

    async function handleAnswer({ answer }: { answer: RTCSessionDescriptionInit }) {
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }

    async function handleIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      if (!peer || !candidate) return;
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Late/invalid candidates are safe to ignore.
      }
    }

    async function start() {
      setMediaError(null);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setMediaError("Camera or microphone access is required.");
        return;
      }

      if (cancelled) {
        localStream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (localVideoEl) localVideoEl.srcObject = localStream;

      peer = new RTCPeerConnection(RTC_CONFIG);
      localStream.getTracks().forEach((track) => peer!.addTrack(track, localStream!));

      peer.ontrack = (event) => {
        if (remoteVideoEl) remoteVideoEl.srcObject = event.streams[0];
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc_ice_candidate", { candidate: event.candidate });
        }
      };

      socket.on("webrtc_offer", handleOffer);
      socket.on("webrtc_answer", handleAnswer);
      socket.on("webrtc_ice_candidate", handleIceCandidate);

      if (isInitiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
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
