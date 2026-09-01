import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import { AuthProvider } from "./lib/AuthContext";
import { MatchmakingProvider } from "./lib/MatchmakingContext";
import { RequireAuth, RedirectIfAuthed } from "./components/RouteGuards";

function App() {
  return (
    <AuthProvider>
      <MatchmakingProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <Chat />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MatchmakingProvider>
    </AuthProvider>
  );
}

export default App;
