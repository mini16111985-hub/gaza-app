"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";
type RoleType = "admin" | "member" | "";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  instrument: string | null;
};

type Band = {
  id: string;
  name: string;
  invite_token: string | null;
};

type JoinRequest = {
  id: string;
  user_id: string;
  status: string;
  profile?: {
    full_name: string | null;
    instrument: string | null;
  } | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  profiles:
    | {
        full_name: string | null;
        instrument: string | null;
      }
    | {
        full_name: string | null;
        instrument: string | null;
      }[]
    | null;
};

type EventItem = {
  id: string;
  event_type: "gig" | "rehearsal";
  status: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  city: string | null;
};

type AttendanceItem = {
  id: string;
  event_id: string;
  user_id: string;
  attendance_status: "coming" | "not_coming" | string;
  profile?: {
    full_name: string | null;
    instrument: string | null;
  } | null;
};

type FinancialTransaction = {
  id: string;
  band_id: string;
  event_id: string | null;
  transaction_type: "income" | "expense";
  source_type: string | null;
  description: string | null;
  amount: number;
  transaction_date: string;
  created_by: string | null;
};

function randomInviteToken() {
  return crypto.randomUUID();
}

function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthName(date: Date) {
  return date.toLocaleDateString("hr-HR", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function getEventStatusLabel(
  eventType: "gig" | "rehearsal",
  status: string
) {
  if (eventType === "gig") {
    if (status === "scheduled") return "Zakazano";
    if (status === "completed") return "Odrađeno";
    if (status === "closed") return "Zatvoreno";
    if (status === "cancelled") return "Otkazano";
  }

  if (eventType === "rehearsal") {
    if (status === "scheduled") return "Zakazana";
    if (status === "completed") return "Odrađena";
    if (status === "cancelled") return "Otkazana";
  }

  return status;
}

function getEventStatusOptions(eventType: "gig" | "rehearsal") {
  if (eventType === "gig") {
    return [
      { value: "scheduled", label: "Zakazano" },
      { value: "completed", label: "Odrađeno" },
      { value: "closed", label: "Zatvoreno" },
      { value: "cancelled", label: "Otkazano" },
    ];
  }

  return [
    { value: "scheduled", label: "Zakazana" },
    { value: "completed", label: "Odrađena" },
    { value: "cancelled", label: "Otkazana" },
  ];
}

function getEventStatusBadgeClass(status: string) {
  if (status === "scheduled") return "bg-zinc-700 text-zinc-200";
  if (status === "completed") return "bg-green-600/30 text-green-300";
  if (status === "closed") return "bg-blue-600/30 text-blue-300";
  if (status === "cancelled") return "bg-red-600/30 text-red-300";
  return "bg-zinc-700 text-zinc-200";
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [instrument, setInstrument] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState<RoleType>("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [bandName, setBandName] = useState("");
  const [myBand, setMyBand] = useState<Band | null>(null);

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendanceByEvent, setAttendanceByEvent] = useState<
    Record<string, AttendanceItem[]>
  >({});

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [newTransactionType, setNewTransactionType] = useState<
    "income" | "expense"
  >("income");
  const [newTransactionDescription, setNewTransactionDescription] =
    useState("");
  const [newTransactionDate, setNewTransactionDate] = useState("");
  const [newTransactionAmount, setNewTransactionAmount] = useState("");

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(today));

  const [newEventType, setNewEventType] = useState<"gig" | "rehearsal">("gig");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [newEventVenue, setNewEventVenue] = useState("");
  const [newEventCity, setNewEventCity] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      setUserEmail(session.user.email ?? "");
      setUserId(session.user.id);

      await loadProfile(session.user.id);
      await loadMyBand(session.user.id);
    };

    void checkSession();
  }, []);

  const loadProfile = async (profileUserId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, instrument")
      .eq("id", profileUserId)
      .single();

    if (!error && data) setProfile(data);
  };

  const loadMembers = async (bandId: string) => {
    const { data, error } = await supabase
      .from("band_members")
      .select("id, user_id, role, profiles (full_name, instrument)")
      .eq("band_id", bandId)
      .eq("status", "active");

    if (error) {
      setMembers([]);
      return;
    }

    setMembers((data ?? []) as MemberRow[]);
  };

  const loadRequests = async (bandId: string) => {
    const { data, error } = await supabase
      .from("band_join_requests")
      .select("id, user_id, status")
      .eq("band_id", bandId)
      .eq("status", "pending");

    if (error) {
      setRequests([]);
      return;
    }

    const baseRequests = (data ?? []) as JoinRequest[];

    if (baseRequests.length === 0) {
      setRequests([]);
      return;
    }

    const { data: activeMembers } = await supabase
      .from("band_members")
      .select("user_id")
      .eq("band_id", bandId)
      .eq("status", "active");

    const activeUserIds = new Set((activeMembers ?? []).map((m) => m.user_id));
    const filteredRequests = baseRequests.filter(
      (req) => !activeUserIds.has(req.user_id)
    );

    if (filteredRequests.length === 0) {
      setRequests([]);
      return;
    }

    const userIds = filteredRequests.map((req) => req.user_id);

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, instrument")
      .in("id", userIds);

    if (profilesError) {
      setRequests(filteredRequests);
      return;
    }

    const profileMap = new Map(
      (profilesData ?? []).map((p) => [
        p.id,
        {
          full_name: p.full_name,
          instrument: p.instrument,
        },
      ])
    );

    setRequests(
      filteredRequests.map((req) => ({
        ...req,
        profile: profileMap.get(req.user_id) ?? null,
      }))
    );
  };

  const loadAttendanceForEvents = async (eventList: EventItem[]) => {
    if (eventList.length === 0) {
      setAttendanceByEvent({});
      return;
    }

    const eventIds = eventList.map((e) => e.id);

    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("event_attendance")
      .select("id, event_id, user_id, attendance_status")
      .in("event_id", eventIds);

    if (attendanceError) {
      setAttendanceByEvent({});
      return;
    }

    const rows = (attendanceRows ?? []) as AttendanceItem[];

    if (rows.length === 0) {
      setAttendanceByEvent({});
      return;
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, instrument")
      .in("id", userIds);

    const profileMap = new Map(
      (profilesData ?? []).map((p) => [
        p.id,
        {
          full_name: p.full_name,
          instrument: p.instrument,
        },
      ])
    );

    const merged = rows.map((row) => ({
      ...row,
      profile: profileMap.get(row.user_id) ?? null,
    }));

    const grouped: Record<string, AttendanceItem[]> = {};
    for (const row of merged) {
      if (!grouped[row.event_id]) grouped[row.event_id] = [];
      grouped[row.event_id].push(row);
    }

    setAttendanceByEvent(grouped);
  };

  const loadEvents = async (bandId: string) => {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, event_type, status, title, event_date, start_time, end_time, venue_name, city"
      )
      .eq("band_id", bandId)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      setEvents([]);
      setAttendanceByEvent({});
      return;
    }

    const eventList = (data ?? []) as EventItem[];
    setEvents(eventList);
    await loadAttendanceForEvents(eventList);
  };

  const loadTransactions = async (bandId: string) => {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(
        "id, band_id, event_id, transaction_type, source_type, description, amount, transaction_date, created_by"
      )
      .eq("band_id", bandId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setTransactions([]);
      return;
    }

    setTransactions((data ?? []) as FinancialTransaction[]);
  };

  const loadMyBand = async (profileUserId: string) => {
    const { data, error } = await supabase
      .from("band_members")
      .select(
        `
        band_id,
        role,
        status,
        bands (
          id,
          name,
          invite_token
        )
      `
      )
      .eq("user_id", profileUserId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.bands) {
      setMyBand(null);
      setMyRole("");
      setRequests([]);
      setMembers([]);
      setEvents([]);
      setAttendanceByEvent({});
      setTransactions([]);
      return;
    }

    const bandData = Array.isArray(data.bands) ? data.bands[0] : data.bands;

    setMyBand({
      id: bandData.id,
      name: bandData.name,
      invite_token: bandData.invite_token,
    });

    setMyRole((data.role as RoleType) ?? "");

    await loadRequests(bandData.id);
    await loadMembers(bandData.id);
    await loadEvents(bandData.id);
    await loadTransactions(bandData.id);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage("Greška: " + error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setMessage("Korisnik nije kreiran.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName || null,
        phone: phone || null,
        instrument: instrument || null,
      });

      if (profileError) {
        setMessage(
          "Auth je prošao, ali profil nije spremljen: " + profileError.message
        );
        return;
      }

      setUserEmail(user.email ?? "");
      setUserId(user.id);

      await loadProfile(user.id);
      await loadMyBand(user.id);

      setMessage("Registracija i profil su uspješno spremljeni.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage("Greška: " + error.message);
        return;
      }

      setUserEmail(data.user.email ?? "");
      setUserId(data.user.id);

      await loadProfile(data.user.id);
      await loadMyBand(data.user.id);

      setMessage("Prijava uspješna.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setMessage("Greška pri odjavi: " + error.message);
        return;
      }

      setUserEmail("");
      setUserId("");
      setMyRole("");
      setProfile(null);
      setMyBand(null);
      setRequests([]);
      setMembers([]);
      setEvents([]);
      setAttendanceByEvent({});
      setTransactions([]);
      setBandName("");
      setMessage("Odjavljen si.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBand = async () => {
    if (!userId) {
      setMessage("Nema prijavljenog korisnika.");
      return;
    }

    if (!bandName.trim()) {
      setMessage("Upiši naziv benda.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const inviteToken = randomInviteToken();

      const { data: band, error: bandError } = await supabase
        .from("bands")
        .insert({
          name: bandName.trim(),
          invite_token: inviteToken,
          created_by: userId,
        })
        .select("id, name, invite_token")
        .single();

      if (bandError || !band) {
        setMessage(
          "Greška kod kreiranja benda: " +
            (bandError?.message ?? "Nepoznata greška")
        );
        return;
      }

      const { error: memberError } = await supabase.from("band_members").insert({
        band_id: band.id,
        user_id: userId,
        role: "admin",
        status: "active",
        joined_at: new Date().toISOString(),
      });

      if (memberError) {
        setMessage(
          "Bend je kreiran, ali članstvo nije spremljeno: " +
            memberError.message
        );
        return;
      }

      setMyBand({
        id: band.id,
        name: band.name,
        invite_token: band.invite_token,
      });
      setMyRole("admin");
      setBandName("");

      await loadRequests(band.id);
      await loadMembers(band.id);
      await loadEvents(band.id);
      await loadTransactions(band.id);

      setMessage("Bend je uspješno kreiran.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    if (!myBand || !userId || myRole !== "admin") return;

    setLoading(true);
    setMessage("");

    try {
      const { data: existingMember, error: existingMemberError } = await supabase
        .from("band_members")
        .select("id, status")
        .eq("band_id", myBand.id)
        .eq("user_id", request.user_id)
        .maybeSingle();

      if (existingMemberError) {
        setMessage("Greška kod provjere člana: " + existingMemberError.message);
        return;
      }

      if (existingMember) {
        const { error: updateMemberError } = await supabase
          .from("band_members")
          .update({
            role: "member",
            status: "active",
            joined_at: new Date().toISOString(),
          })
          .eq("id", existingMember.id);

        if (updateMemberError) {
          setMessage(
            "Greška kod ažuriranja člana: " + updateMemberError.message
          );
          return;
        }
      } else {
        const { error: memberInsertError } = await supabase
          .from("band_members")
          .insert({
            band_id: myBand.id,
            user_id: request.user_id,
            role: "member",
            status: "active",
            joined_at: new Date().toISOString(),
          });

        if (memberInsertError) {
          setMessage("Greška kod prihvaćanja člana: " + memberInsertError.message);
          return;
        }
      }

      const { error: requestError } = await supabase
        .from("band_join_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
        })
        .eq("id", request.id);

      if (requestError) {
        setMessage(
          "Član je dodan, ali zahtjev nije ažuriran: " + requestError.message
        );
        return;
      }

      await loadRequests(myBand.id);
      await loadMembers(myBand.id);
      setMessage("Zahtjev je prihvaćen.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request: JoinRequest) => {
    if (!myBand || !userId || myRole !== "admin") return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("band_join_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
        })
        .eq("id", request.id);

      if (error) {
        setMessage("Greška kod odbijanja zahtjeva: " + error.message);
        return;
      }

      await loadRequests(myBand.id);
      setMessage("Zahtjev je odbijen.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member: MemberRow) => {
    if (!myBand || myRole !== "admin") return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("band_members")
        .update({ status: "removed" })
        .eq("id", member.id);

      if (error) {
        setMessage("Greška kod uklanjanja člana: " + error.message);
        return;
      }

      await loadMembers(myBand.id);
      setMessage("Član je uklonjen.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEventStatus = async (
    eventId: string,
    nextStatus: string
  ) => {
    if (!myBand || myRole !== "admin") return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("events")
        .update({ status: nextStatus })
        .eq("id", eventId);

      if (error) {
        setMessage("Greška kod promjene statusa: " + error.message);
        return;
      }

      await loadEvents(myBand.id);
      setMessage("Status termina je ažuriran.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!myBand || !userId || myRole !== "admin") {
      setMessage("Samo admin može dodavati termine.");
      return;
    }

    if (!newEventTitle.trim()) {
      setMessage("Upiši naziv termina.");
      return;
    }

    if (!newEventDate) {
      setMessage("Odaberi datum.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.from("events").insert({
        band_id: myBand.id,
        event_type: newEventType,
        status: "scheduled",
        title: newEventTitle.trim(),
        event_date: newEventDate,
        start_time: newEventStartTime || null,
        end_time: newEventEndTime || null,
        venue_name: newEventVenue || null,
        city: newEventCity || null,
        created_by: userId,
      });

      if (error) {
        setMessage("Greška kod spremanja termina: " + error.message);
        return;
      }

      const createdDate = newEventDate;

      setNewEventType("gig");
      setNewEventTitle("");
      setNewEventDate("");
      setNewEventStartTime("");
      setNewEventEndTime("");
      setNewEventVenue("");
      setNewEventCity("");

      await loadEvents(myBand.id);
      setSelectedDate(createdDate);
      setMessage("Termin je uspješno dodan.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!myBand || !userId || myRole !== "admin") {
      setMessage("Samo admin može unositi financije.");
      return;
    }

    if (!newTransactionDescription.trim()) {
      setMessage("Upiši kratki opis.");
      return;
    }

    if (!newTransactionDate) {
      setMessage("Odaberi datum.");
      return;
    }

    if (!newTransactionAmount || Number(newTransactionAmount) <= 0) {
      setMessage("Upiši ispravan iznos.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.from("financial_transactions").insert({
        band_id: myBand.id,
        event_id: null,
        transaction_type: newTransactionType,
        source_type: "manual",
        description: newTransactionDescription.trim(),
        amount: Number(newTransactionAmount),
        transaction_date: newTransactionDate,
        created_by: userId,
      });

      if (error) {
        setMessage("Greška kod spremanja transakcije: " + error.message);
        return;
      }

      setNewTransactionType("income");
      setNewTransactionDescription("");
      setNewTransactionDate("");
      setNewTransactionAmount("");

      await loadTransactions(myBand.id);
      setMessage("Transakcija je uspješno spremljena.");
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceResponse = async (
    eventId: string,
    status: "coming" | "not_coming"
  ) => {
    if (!userId) return;

    setLoading(true);
    setMessage("");

    try {
      const { data: existingRow, error: findError } = await supabase
        .from("event_attendance")
        .select("id, event_id, user_id, attendance_status")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (findError) {
        setMessage("Greška kod provjere dolaska: " + findError.message);
        return;
      }

      if (existingRow) {
        const { error: updateError } = await supabase
          .from("event_attendance")
          .update({
            attendance_status: status,
            set_by_admin: false,
            updated_by: userId,
          })
          .eq("id", existingRow.id)
          .select();

        if (updateError) {
          setMessage("Greška kod ažuriranja dolaska: " + updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("event_attendance")
          .insert({
            event_id: eventId,
            user_id: userId,
            attendance_status: status,
            set_by_admin: false,
            updated_by: userId,
          })
          .select();

        if (insertError) {
          setMessage("Greška kod spremanja dolaska: " + insertError.message);
          return;
        }
      }

      if (myBand) {
        await loadEvents(myBand.id);
      }

      setMessage(
        status === "coming"
          ? "Označio si: dolazim."
          : "Označio si: ne dolazim."
      );
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of events) {
      const arr = map.get(event.event_date) ?? [];
      arr.push(event);
      map.set(event.event_date, arr);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDate) ?? [];
  }, [eventsByDate, selectedDate]);

  const currentBalance = useMemo(() => {
    return transactions.reduce((sum, tx) => {
      if (tx.transaction_type === "income") return sum + Number(tx.amount);
      return sum - Number(tx.amount);
    }, 0);
  }, [transactions]);

  const lastIncome = useMemo(() => {
    return transactions.find((tx) => tx.transaction_type === "income") ?? null;
  }, [transactions]);

  const lastExpense = useMemo(() => {
    return transactions.find((tx) => tx.transaction_type === "expense") ?? null;
  }, [transactions]);

  const weekDays = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

  if (userEmail) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
          <div className="rounded-2xl bg-zinc-900 p-5 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Gaža</h1>
                <p className="mt-2 text-sm text-zinc-300">
                  Prijavljen korisnik: {userEmail}
                </p>
                {profile?.full_name && (
                  <p className="mt-1 text-sm text-zinc-400">
                    {profile.full_name}
                    {profile.instrument ? ` · ${profile.instrument}` : ""}
                  </p>
                )}
                {myRole && (
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                    {myRole}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold disabled:opacity-60"
              >
                {loading ? "Odjava..." : "Odjava"}
              </button>
            </div>

            {myBand ? (
              <>
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Kalendar</h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth() - 1,
                                1
                              )
                            )
                          }
                          className="rounded-lg bg-zinc-700 px-3 py-1 text-sm"
                        >
                          ←
                        </button>
                        <p className="min-w-[150px] text-center text-sm font-semibold capitalize">
                          {getMonthName(calendarMonth)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setCalendarMonth(
                              new Date(
                                calendarMonth.getFullYear(),
                                calendarMonth.getMonth() + 1,
                                1
                              )
                            )
                          }
                          className="rounded-lg bg-zinc-700 px-3 py-1 text-sm"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-7 gap-2">
                      {weekDays.map((day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((day) => {
                        const dayKey = formatDateLocal(day);
                        const dayEvents = eventsByDate.get(dayKey) ?? [];
                        const isCurrentMonth =
                          day.getMonth() === calendarMonth.getMonth();
                        const isSelected = selectedDate === dayKey;
                        const isToday =
                          formatDateLocal(day) === formatDateLocal(today);

                        const hasGig = dayEvents.some(
                          (e) => e.event_type === "gig"
                        );
                        const hasRehearsal = dayEvents.some(
                          (e) => e.event_type === "rehearsal"
                        );

                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => setSelectedDate(dayKey)}
                            className={`min-h-[74px] rounded-xl border p-2 text-left transition ${
                              isSelected
                                ? "border-blue-500 bg-zinc-700"
                                : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                            } ${!isCurrentMonth ? "opacity-45" : ""}`}
                          >
                            <div className="flex items-start justify-between">
                              <span
                                className={`text-sm font-semibold ${
                                  isToday ? "text-blue-400" : "text-white"
                                }`}
                              >
                                {day.getDate()}
                              </span>

                              {dayEvents.length > 1 && (
                                <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-bold">
                                  {dayEvents.length}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1">
                              {hasGig && (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                              {hasRehearsal && (
                                <span className="h-2 w-2 rounded-full bg-orange-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <span>Gaža</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        <span>Proba</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                    <h2 className="text-xl font-semibold">Odabrani datum</h2>
                    <p className="mt-2 text-sm text-zinc-400">{selectedDate}</p>

                    {selectedDayEvents.length === 0 ? (
                      <p className="mt-4 text-sm text-zinc-400">
                        Nema termina za ovaj datum.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {selectedDayEvents.map((event) => {
                          const attendance = attendanceByEvent[event.id] ?? [];
                          const myAttendance = attendance.find(
                            (a) => a.user_id === userId
                          );

                          return (
                            <div
                              key={event.id}
                              className="rounded-lg bg-zinc-900 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold">{event.title}</p>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                      event.event_type === "gig"
                                        ? "bg-blue-600/30 text-blue-300"
                                        : "bg-orange-600/30 text-orange-300"
                                    }`}
                                  >
                                    {event.event_type === "gig"
                                      ? "Gaža"
                                      : "Proba"}
                                  </span>

                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${getEventStatusBadgeClass(
                                      event.status
                                    )}`}
                                  >
                                    {getEventStatusLabel(
                                      event.event_type,
                                      event.status
                                    )}
                                  </span>
                                </div>
                              </div>

                              <p className="mt-2 text-sm text-zinc-400">
                                {event.start_time ? event.start_time : "—"}
                                {event.end_time ? ` - ${event.end_time}` : ""}
                              </p>

                              {(event.venue_name || event.city) && (
                                <p className="mt-1 text-sm text-zinc-500">
                                  {[event.venue_name, event.city]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}

                              {myRole === "admin" && (
                                <div className="mt-4">
                                  <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
                                    Status termina
                                  </label>

                                  <select
                                    value={event.status}
                                    onChange={(e) =>
                                      void handleUpdateEventStatus(
                                        event.id,
                                        e.target.value
                                      )
                                    }
                                    disabled={loading}
                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm disabled:opacity-60"
                                  >
                                    {getEventStatusOptions(event.event_type).map(
                                      (option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              )}

                              <div className="mt-4">
                                <p className="text-xs uppercase tracking-wide text-zinc-500">
                                  Moj status
                                </p>
                                <p className="mt-1 text-sm text-zinc-300">
                                  {myAttendance?.attendance_status === "coming"
                                    ? "Dolazim"
                                    : myAttendance?.attendance_status ===
                                      "not_coming"
                                    ? "Ne dolazim"
                                    : "Još nije označeno"}
                                </p>

                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAttendanceResponse(
                                        event.id,
                                        "coming"
                                      )
                                    }
                                    disabled={loading}
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                                      myAttendance?.attendance_status === "coming"
                                        ? "bg-green-600"
                                        : "bg-zinc-700"
                                    }`}
                                  >
                                    Dolazim
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAttendanceResponse(
                                        event.id,
                                        "not_coming"
                                      )
                                    }
                                    disabled={loading}
                                    className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                                      myAttendance?.attendance_status ===
                                      "not_coming"
                                        ? "bg-red-600"
                                        : "bg-zinc-700"
                                    }`}
                                  >
                                    Ne dolazim
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="text-xs uppercase tracking-wide text-zinc-500">
                                  Odgovori članova
                                </p>

                                {attendance.length === 0 ? (
                                  <p className="mt-2 text-sm text-zinc-400">
                                    Još nema odgovora.
                                  </p>
                                ) : (
                                  <div className="mt-2 space-y-2">
                                    {attendance.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2"
                                      >
                                        <div>
                                          <p className="text-sm font-semibold">
                                            {item.profile?.full_name ||
                                              "Nepoznato ime"}
                                          </p>
                                          <p className="text-xs text-zinc-500">
                                            {item.profile?.instrument || ""}
                                          </p>
                                        </div>

                                        <span
                                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                            item.attendance_status === "coming"
                                              ? "bg-green-600/30 text-green-300"
                                              : "bg-red-600/30 text-red-300"
                                          }`}
                                        >
                                          {item.attendance_status === "coming"
                                            ? "Dolazi"
                                            : "Ne dolazi"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                  <h2 className="text-xl font-semibold">Tvoj bend</h2>
                  <p className="mt-3 text-lg">{myBand.name}</p>

                  <div className="mt-4 rounded-lg bg-zinc-900 p-3">
                    <p className="text-sm text-zinc-400">Pozivni link</p>
                    <p className="mt-2 break-all text-sm text-blue-400">
                      {typeof window !== "undefined" && myBand.invite_token
                        ? `${window.location.origin}/join?token=${encodeURIComponent(
                            myBand.invite_token
                          )}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                  <h2 className="text-xl font-semibold">Stanje benda</h2>

                  <div className="mt-4 rounded-xl bg-zinc-900 p-4">
                    <p className="text-sm text-zinc-400">Trenutno stanje</p>
                    <p className="mt-2 text-3xl font-bold">
                      {currentBalance.toFixed(2)} €
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-zinc-900 p-4">
                      <p className="text-sm text-zinc-400">Zadnji prihod</p>
                      {lastIncome ? (
                        <>
                          <p className="mt-2 font-semibold">
                            {lastIncome.description || "Bez opisa"}
                          </p>
                          <p className="text-sm text-zinc-400">
                            {lastIncome.transaction_date}
                          </p>
                          <p className="mt-1 font-semibold text-green-400">
                            +{Number(lastIncome.amount).toFixed(2)} €
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">
                          Nema prihoda.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-zinc-900 p-4">
                      <p className="text-sm text-zinc-400">Zadnji trošak</p>
                      {lastExpense ? (
                        <>
                          <p className="mt-2 font-semibold">
                            {lastExpense.description || "Bez opisa"}
                          </p>
                          <p className="text-sm text-zinc-400">
                            {lastExpense.transaction_date}
                          </p>
                          <p className="mt-1 font-semibold text-red-400">
                            -{Number(lastExpense.amount).toFixed(2)} €
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">
                          Nema troškova.
                        </p>
                      )}
                    </div>
                  </div>

                  {myRole === "admin" && (
                    <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
                      <h3 className="text-lg font-semibold">Nova transakcija</h3>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm">Tip</label>
                          <select
                            value={newTransactionType}
                            onChange={(e) =>
                              setNewTransactionType(
                                e.target.value as "income" | "expense"
                              )
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                          >
                            <option value="income">Prihod</option>
                            <option value="expense">Trošak</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm">Datum</label>
                          <input
                            type="date"
                            value={newTransactionDate}
                            onChange={(e) =>
                              setNewTransactionDate(e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm">
                            Kratki opis
                          </label>
                          <input
                            type="text"
                            value={newTransactionDescription}
                            onChange={(e) =>
                              setNewTransactionDescription(e.target.value)
                            }
                            placeholder="Npr. Bakša, gorivo, najam..."
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm">Iznos</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newTransactionAmount}
                            onChange={(e) =>
                              setNewTransactionAmount(e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleCreateTransaction()}
                        disabled={loading}
                        className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
                      >
                        {loading ? "Spremam..." : "Spremi transakciju"}
                      </button>
                    </div>
                  )}
                </div>

                {myRole === "admin" && (
                  <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                    <h2 className="text-xl font-semibold">
                      Zahtjevi za pridruživanje
                    </h2>

                    {requests.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-400">
                        Trenutno nema zahtjeva.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {requests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between rounded-lg bg-zinc-900 p-3"
                          >
                            <div>
                              <p className="font-semibold">
                                {req.profile?.full_name || "Nepoznato ime"}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {req.profile?.instrument || ""}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApprove(req)}
                                disabled={loading}
                                className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold disabled:opacity-60"
                              >
                                Prihvati
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleReject(req)}
                                disabled={loading}
                                className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold disabled:opacity-60"
                              >
                                Odbij
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                  <h2 className="text-xl font-semibold">Članovi benda</h2>

                  {members.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-400">Nema članova.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {members.map((member) => {
                        const memberProfile = Array.isArray(member.profiles)
                          ? member.profiles[0]
                          : member.profiles;

                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded-lg bg-zinc-900 p-3"
                          >
                            <div>
                              <p className="font-semibold">
                                {memberProfile?.full_name || "Nepoznato ime"}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {memberProfile?.instrument || ""}
                              </p>
                              <p className="text-xs uppercase tracking-wide text-zinc-500">
                                {member.role}
                              </p>
                            </div>

                            {myRole === "admin" && member.role !== "admin" && (
                              <button
                                type="button"
                                onClick={() => void handleRemoveMember(member)}
                                disabled={loading}
                                className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold disabled:opacity-60"
                              >
                                Makni
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {myRole === "admin" && (
                  <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                    <h2 className="text-xl font-semibold">Novi termin</h2>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm">Tip termina</label>
                        <select
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventType}
                          onChange={(e) =>
                            setNewEventType(
                              e.target.value as "gig" | "rehearsal"
                            )
                          }
                        >
                          <option value="gig">Gaža</option>
                          <option value="rehearsal">Proba</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Naziv</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventTitle}
                          onChange={(e) => setNewEventTitle(e.target.value)}
                          placeholder="Npr. Svadba Horvat"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Datum</label>
                        <input
                          type="date"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Vrijeme od</label>
                        <input
                          type="time"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventStartTime}
                          onChange={(e) => setNewEventStartTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Vrijeme do</label>
                        <input
                          type="time"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventEndTime}
                          onChange={(e) => setNewEventEndTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Mjesto</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventVenue}
                          onChange={(e) => setNewEventVenue(e.target.value)}
                          placeholder="Npr. Hotel Panorama"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm">Grad</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                          value={newEventCity}
                          onChange={(e) => setNewEventCity(e.target.value)}
                          placeholder="Npr. Zagreb"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCreateEvent()}
                      disabled={loading}
                      className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
                    >
                      {loading ? "Spremam..." : "Dodaj termin"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
                <h2 className="text-xl font-semibold">Kreiraj bend</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Za početak upiši naziv benda. Automatski ćeš postati admin.
                </p>

                <div className="mt-4">
                  <label className="mb-2 block text-sm">Naziv benda</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                    value={bandName}
                    onChange={(e) => setBandName(e.target.value)}
                    placeholder="Npr. Noćna smjena"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateBand}
                  disabled={loading}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
                >
                  {loading ? "Spremam..." : "Kreiraj bend"}
                </button>
              </div>
            )}

            {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl">
        <h1 className="mb-6 text-3xl font-bold text-center">Gaža</h1>

        <div className="mb-6 flex rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "login" ? "bg-blue-600" : "bg-transparent"
            }`}
          >
            Prijava
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "signup" ? "bg-blue-600" : "bg-transparent"
            }`}
          >
            Registracija
          </button>
        </div>

        {mode === "signup" && (
          <>
            <div className="mb-4">
              <label className="mb-2 block text-sm">Ime i prezime</label>
              <input
                type="text"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm">Broj mobitela</label>
              <input
                type="text"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm">Instrument</label>
              <input
                type="text"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-sm">Email</label>
          <input
            type="email"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm">Lozinka</label>
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {mode === "signup" ? (
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {loading ? "Spremam..." : "Registriraj se"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {loading ? "Prijava..." : "Prijavi se"}
          </button>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-zinc-300">{message}</p>
        )}
      </div>
    </main>
  );
}