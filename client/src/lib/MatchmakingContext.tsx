import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { socket } from "./socket";
import { auth } from "./firebase";
import {
  MatchmakingContext,
  type ChatMessage,
  type MatchStatus,
} from "./matchmakingContextBase";

export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [reportConfirmed, setReportConfirmed] = useState(false);

  useEffect(() => {
    function handleSearching() {
      setStatus("searching");
      setError(null);
      setSearchStartedAt(Date.now());
    }
    function handleMatched() {
      setStatus("connected");
      setMessages([]);
      setNotice(null);
      setSearchStartedAt(null);
      setReportConfirmed(false);
    }
    function handleReturnedToQueue({ reason }: { reason: "next" | "disconnected" }) {
      setStatus("searching");
      setMessages([]);
      setNotice(reason === "disconnected" ? "Stranger disconnected." : null);
      setSearchStartedAt(Date.now());
    }
    function handleQueueError({ error }: { error: string }) {
      setError(error);
      setStatus("idle");
      setSearchStartedAt(null);
    }
    function handleReceiveMessage(message: ChatMessage) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("searching", handleSearching);
    socket.on("matched", handleMatched);
    socket.on("returned_to_queue", handleReturnedToQueue);
    socket.on("queue_error", handleQueueError);
    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("searching", handleSearching);
      socket.off("matched", handleMatched);
      socket.off("returned_to_queue", handleReturnedToQueue);
      socket.off("queue_error", handleQueueError);
      socket.off("receive_message", handleReceiveMessage);
    };
  }, []);

  const startChat = useCallback(async () => {
    setError(null);
    setNotice(null);
    setReportConfirmed(false);
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      setError("You must be signed in to start a chat.");
      return;
    }
    if (!socket.connected) socket.connect();
    socket.emit("join_queue", { idToken });
  }, []);

  const nextStranger = useCallback(() => {
    socket.emit("next_stranger");
  }, []);

  const endChat = useCallback(() => {
    socket.emit("leave_queue");
    setStatus("idle");
    setError(null);
    setMessages([]);
    setNotice(null);
    setSearchStartedAt(null);
    setReportConfirmed(false);
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit("send_message", { text: trimmed });
  }, []);

  const reportUser = useCallback((reason: string) => {
    setReportConfirmed(true);
    socket.emit("report_user", { reason });
  }, []);

  return (
    <MatchmakingContext.Provider
      value={{
        status,
        error,
        notice,
        messages,
        searchStartedAt,
        reportConfirmed,
        startChat,
        nextStranger,
        endChat,
        sendMessage,
        reportUser,
      }}
    >
      {children}
    </MatchmakingContext.Provider>
  );
}
