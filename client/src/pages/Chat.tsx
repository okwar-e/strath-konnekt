import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatchmaking } from "../lib/matchmakingContextBase";

const REPORT_REASONS = ["Nudity", "Harassment", "Threats", "Spam", "Other"];

function getSearchMessage(elapsedSeconds: number): string {
  if (elapsedSeconds >= 60) return "No one is available right now. Please hang tight...";
  if (elapsedSeconds >= 30) return "This is taking longer than usual...";
  if (elapsedSeconds >= 15) return "Still looking for a stranger...";
  return "Finding a stranger...";
}

export default function Chat() {
  const navigate = useNavigate();
  const {
    status,
    notice,
    messages,
    searchStartedAt,
    reportConfirmed,
    nextStranger,
    endChat,
    sendMessage,
    reportUser,
  } = useMatchmaking();
  const [draft, setDraft] = useState("");
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (status !== "searching" || !searchStartedAt) {
      return;
    }
    const startedAt = searchStartedAt;
    function tick() {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [status, searchStartedAt]);

  function handleEnd() {
    endChat();
    navigate("/");
  }

  function handleNext() {
    setDraft("");
    nextStranger();
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  }

  function handleSelectReason(reason: string) {
    setShowReportSheet(false);
    reportUser(reason);
  }

  const statusText =
    status === "connected"
      ? "You are now chatting with a random stranger."
      : reportConfirmed
        ? "Thanks. Your report has been submitted."
        : (notice ?? getSearchMessage(elapsedSeconds));

  const stageLabel = status === "connected" ? "Connected on Strath Konnekt" : "Finding a stranger...";

  return (
    <div className="video-call-page">
      <div className="video-stage">
        <div className="stage-overlay-top">{stageLabel}</div>

        <div className="stage-placeholder">
          <svg
            className="avatar-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="self-view">
          <span>You</span>
        </div>

        <div className="video-controls">
          <button
            className="control-btn control-btn-primary"
            onClick={handleNext}
            disabled={status !== "connected"}
          >
            Next
          </button>
          <button
            className="control-btn"
            onClick={() => setShowReportSheet(true)}
            disabled={status !== "connected"}
          >
            Report
          </button>
          <button className="control-btn control-btn-danger" onClick={handleEnd}>
            End
          </button>
        </div>
      </div>

      <div className="chat-panel">
        <div className="chat-panel-header">
          <p>{statusText}</p>
        </div>

        <div className="chat-messages">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`bubble ${message.sender === "self" ? "bubble-self" : "bubble-stranger"}`}
            >
              {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={status !== "connected"}
          />
          <button type="submit" disabled={status !== "connected" || !draft.trim()}>
            Send
          </button>
        </form>
      </div>

      {showReportSheet && (
        <div className="report-sheet-backdrop" onClick={() => setShowReportSheet(false)}>
          <div className="report-sheet" onClick={(e) => e.stopPropagation()}>
            <p>Why are you reporting this person?</p>
            {REPORT_REASONS.map((reason) => (
              <button key={reason} onClick={() => handleSelectReason(reason)}>
                {reason}
              </button>
            ))}
            <button className="report-cancel" onClick={() => setShowReportSheet(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
