"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    const initSession = async () => {
      if (!accessToken || !refreshToken) {
        setMessage("Reset link nije ispravan ili je istekao.");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMessage("Greška kod otvaranja reset sesije: " + error.message);
        return;
      }

      setReady(true);
    };

    void initSession();
  }, []);

  const handleUpdatePassword = async () => {
    if (!password || password.length < 6) {
      setMessage("Lozinka mora imati barem 6 znakova.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Lozinke se ne podudaraju.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage("Greška kod spremanja nove lozinke: " + error.message);
        return;
      }

      setMessage("Lozinka je uspješno promijenjena. Sada se možeš prijaviti.");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-xl">
        <h1 className="text-3xl font-bold">Nova lozinka</h1>

        {!ready && !message && (
          <p className="mt-4 text-zinc-300">Provjeravam reset link...</p>
        )}

        <div className="mt-6">
          <label className="mb-2 block text-sm">Nova lozinka</label>
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!ready || loading}
          />
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm">Ponovi novu lozinku</label>
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!ready || loading}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleUpdatePassword()}
          disabled={!ready || loading}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
        >
          {loading ? "Spremam..." : "Spremi novu lozinku"}
        </button>

        {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
      </div>
    </main>
  );
}