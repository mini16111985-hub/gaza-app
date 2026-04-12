"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [bandName, setBandName] = useState("");
  const [bandId, setBandId] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setMessage("Nedostaje token.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setMessage("Moraš biti prijavljen da pošalješ zahtjev.");
        return;
      }

      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("bands")
        .select("id, name")
        .eq("invite_token", token)
        .single();

      if (error || !data) {
        setMessage("Bend nije pronađen.");
        return;
      }

      setBandId(data.id);
      setBandName(data.name);

      const { data: existingRequest } = await supabase
        .from("band_join_requests")
        .select("id, status")
        .eq("band_id", data.id)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (existingRequest) {
        setMessage("Zahtjev je već poslan.");
      }
    };

    void init();
  }, [token]);

  const handleJoinRequest = async () => {
    if (!bandId || !userId) {
      setMessage("Nedostaju podaci za zahtjev.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: existingRequest } = await supabase
        .from("band_join_requests")
        .select("id, status")
        .eq("band_id", bandId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRequest) {
        setMessage("Zahtjev je već poslan.");
        return;
      }

      const { error } = await supabase.from("band_join_requests").insert({
        band_id: bandId,
        user_id: userId,
        status: "pending",
      });

      if (error) {
        setMessage("Greška: " + error.message);
        return;
      }

      setMessage("Zahtjev za pristup bendu je poslan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-xl">
        <h1 className="text-3xl font-bold">Gaža</h1>

        <h2 className="mt-6 text-xl font-semibold">Pridruži se bendu</h2>

        {bandName ? (
          <>
            <p className="mt-3 text-zinc-300">
              Želiš poslati zahtjev za ulazak u bend:
            </p>
            <p className="mt-2 text-lg font-semibold text-blue-400">
              {bandName}
            </p>

            <button
              type="button"
              onClick={handleJoinRequest}
              disabled={loading || message === "Zahtjev je već poslan."}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
            >
              {loading ? "Šaljem..." : "Pošalji zahtjev"}
            </button>
          </>
        ) : (
          <p className="mt-4 text-zinc-300">{message || "Učitavanje..."}</p>
        )}

        {message && bandName && (
          <p className="mt-4 text-sm text-zinc-300">{message}</p>
        )}
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-xl">
            <h1 className="text-3xl font-bold">Gaža</h1>
            <p className="mt-4 text-zinc-300">Učitavanje...</p>
          </div>
        </main>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}