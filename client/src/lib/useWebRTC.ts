import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Manages the local camera/mic preview plus a single peer-to-peer video/audio
 * call, signaled over the existing Socket.IO connection (webrtc_offer/answer/
 * ice_candidate only).
 *
 * Local media is requested as soon as `mediaEnabled` is true (i.e. as soon as
 * the user is on the Chat page, even while still searching) so the self-view
 * shows immediately. The peer connection is only created/negotiated once
 * `matched` is true, and reuses whatever local stream is already available.
 *
 * Everything is torn down (tracks stopped, peer connection closed, video
 * elements cleared) whenever the corresponding flag flips back to false or
 * the component unmounts — this covers Next, End, and disconnect, since all
 * three flip matchmaking status away from "connected", and leaving the Chat
 * page flips `mediaEnabled` off too.
 */
export function useWebRTC(mediaEnabled: boolean, matched: boolean, isInitiator: boolean) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Local camera/mic preview — independent of match status.
  useEffect(() => {
    if (!mediaEnabled) return;

    const localVideoEl = localVideoRef.current;
    let cancelled = false;

    async function start() {
      setMediaError(null);
      console.log("[WEBRTC-DEBUG] getUserMedia: requesting permissions");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("[WEBRTC-DEBUG] getUserMedia: permission granted");
        console.log(
          `[WEBRTC-DEBUG] getUserMedia: number of local tracks = ${stream.getTracks().length}`,
          stream.getTracks().map((t) => t.kind)
        );
      } catch (err) {
        console.log("[WEBRTC-DEBUG] getUserMedia: permission denied", err);
        setMediaError("Camera or microphone access is required.");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setLocalStream(stream);
      if (localVideoEl) {
        localVideoEl.srcObject = stream;
        console.log("[WEBRTC-DEBUG] Video: local video attached");
      }
    }

    start();

    return () => {
      cancelled = true;

      setLocalStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return null;
      });

      if (localVideoEl) localVideoEl.srcObject = null;
    };
  }, [mediaEnabled]);

  // Peer connection + signaling — only once matched AND local media is ready.
  useEffect(() => {
    if (!matched || !localStream) return;

    const remoteVideoEl = remoteVideoRef.current;

    let peer: RTCPeerConnection | null = null;
    let pendingOffer: RTCSessionDescriptionInit | null = null;
    let pendingCandidates: RTCIceCandidateInit[] = [];

    async function flushPendingCandidates() {
      if (!peer) return;
      const queued = pendingCandidates;
      pendingCandidates = [];
      for (const candidate of queued) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // Invalid candidates are safe to ignore.
        }
      }
    }

    async function handleOffer({ offer }: { offer: RTCSessionDescriptionInit }) {
      if (!peer) {
        pendingOffer = offer;
        return;
      }
      console.log("[WEBRTC-DEBUG] Received offer");
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("[WEBRTC-DEBUG] Remote description set (offer)");
      await flushPendingCandidates();
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
      await flushPendingCandidates();
    }

    async function handleIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      if (!candidate) return;
      if (!peer || !peer.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
      }
      console.log("[WEBRTC-DEBUG] ICE candidate received", candidate);
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Late/invalid candidates are safe to ignore.
      }
    }

    // Registered immediately (before RTCPeerConnection creation) so an
    // offer/answer/ICE candidate arriving early is queued above instead of dropped.
    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("webrtc_ice_candidate", handleIceCandidate);

    console.log("[WEBRTC-DEBUG] Peer connection: creating RTCPeerConnection");
    peer = new RTCPeerConnection(RTC_CONFIG);
    localStream.getTracks().forEach((track) => peer!.addTrack(track, localStream));

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

    async function negotiate() {
      if (isInitiator) {
        console.log("[WEBRTC-DEBUG] Peer connection: creating offer");
        const offer = await peer!.createOffer();
        await peer!.setLocalDescription(offer);
        console.log("[WEBRTC-DEBUG] Local description set (offer)");
        socket.emit("webrtc_offer", { offer });
      } else if (pendingOffer) {
        await handleOffer({ offer: pendingOffer });
        pendingOffer = null;
      }
    }

    negotiate();

    return () => {
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("webrtc_ice_candidate", handleIceCandidate);

      peer?.close();
      peer = null;

      if (remoteVideoEl) remoteVideoEl.srcObject = null;
    };
  }, [matched, isInitiator, localStream]);

  return { localVideoRef, remoteVideoRef, mediaError };
}
