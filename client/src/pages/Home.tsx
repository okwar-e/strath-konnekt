import { useNavigate } from "react-router-dom";
import { useMatchmaking } from "../lib/matchmakingContextBase";

export default function Home() {
  const navigate = useNavigate();
  const { startChat, error } = useMatchmaking();

  async function handleStartChat() {
    await startChat();
    navigate("/chat");
  }

  return (
    <div className="page">
      <h1>Strath Konnekt</h1>
      <p>Chat anonymously with verified Strathmore students.</p>
      <button onClick={handleStartChat}>Start Chat</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
