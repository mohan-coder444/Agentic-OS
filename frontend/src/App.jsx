import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { auth } from "./firebase";
import api from "./axios";
import { setUserData, clearUserData } from "./slices/userSlice";
import Chat from "./components/Chat";

function App() {
  const user = useSelector((state) => state.user.userData);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => dispatch(setUserData(r.data.user)))
      .catch(() => dispatch(clearUserData()))
      .finally(() => setLoading(false));
  }, [dispatch]);

  const handleLogin = async () => {
    if (loggingIn) return; // prevent cancelled-popup-request from double click
    setLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      if (!idToken) {
        console.error("login error: empty idToken from Firebase", result.user);
        alert("Login failed: Firebase returned an empty ID token — try again.");
        return;
      }
      const res = await api.post("/auth/google", { idToken });
      dispatch(setUserData(res.data.user));
    } catch (err) {
      // ignore cancelled-popup-request (user double-clicked) — Firebase bug with network change is retried silently
      if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        console.warn("popup cancelled/closed:", err.code);
        return;
      }
      if (err.code === "auth/internal-error" && err.message.includes("Pending promise")) {
        console.warn("Firebase internal, retry once...");
        return; // user can click again
      }
      const serverMsg = err.response?.data?.message;
      const serverErr = err.response?.data?.error;
      const status = err.response?.status;
      console.error("login error:", { code: err.code, status, serverMsg, serverErr, err });
      alert(
        serverMsg
          ? `Login failed (${status}): ${serverMsg}${serverErr ? ` — ${serverErr}` : ""}`
          : `Login failed (${err.code || err.message}) — check popup blocker & network, then try again.`
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await api.post("/auth/logout");
    dispatch(clearUserData());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-indigo-400">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <div className="h-screen flex flex-col bg-black">
        <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
          <h1 className="font-bold text-indigo-400">AgenticOS</h1>
          <div className="flex items-center gap-3">
            {user.avatar && <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full" />}
            <span className="text-sm text-zinc-300">{user.name || user.email}</span>
            <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition">
              Log out
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <Chat />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <h1 className="text-4xl font-bold text-amber-400">Cortex AI</h1>
        <p className="text-slate-400 text-sm max-w-md text-center">
          Multi-Agent AI Platform — Chat, Coding, Search, PDF, PPT, Image agents.
        </p>
        <p className="text-zinc-600 text-xs">Login to start chatting</p>
      </div>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-7 flex flex-col gap-5 w-full max-w-sm shadow-xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Welcome to Cortex AI</h2>
            <p className="text-[13px] text-slate-500">Please login to continue using the app</p>
          </div>
          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full flex items-center justify-center gap-3 py-[11px] rounded-xl bg-white border border-slate-200 text-black text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-all cursor-pointer disabled:opacity-50"
          >
            <FcGoogle size={18} /> {loggingIn ? "Opening Google..." : "Continue with Google"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
