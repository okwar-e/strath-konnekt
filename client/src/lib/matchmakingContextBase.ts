import { createContext, useContext } from "react";

export type MatchStatus = "idle" | "searching" | "connected";

export interface ChatMessage {
  text: string;
  sender: "self" | "stranger";
  timestamp: number;
}

export interface MatchmakingContextValue {
  status: MatchStatus;
  error: string | null;
  notice: string | null;
  messages: ChatMessage[];
  searchStartedAt: number | null;
  reportConfirmed: boolean;
  startChat: () => Promise<void>;
  nextStranger: () => void;
  endChat: () => void;
  sendMessage: (text: string) => void;
  reportUser: (reason: string) => void;
}

export const MatchmakingContext = createContext<MatchmakingContextValue>({
  status: "idle",
  error: null,
  notice: null,
  messages: [],
  searchStartedAt: null,
  reportConfirmed: false,
  startChat: async () => {},
  nextStranger: () => {},
  endChat: () => {},
  sendMessage: () => {},
  reportUser: () => {},
});

export function useMatchmaking() {
  return useContext(MatchmakingContext);
}
