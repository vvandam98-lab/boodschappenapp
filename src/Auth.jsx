// src/Auth.jsx — Login & household setup screens
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { FIREBASE_CONFIG } from "./firebase.js";
import { createHousehold, joinHousehold, getUserHousehold, getHouseholdMeta } from "./useSync.js";

let authInstance;
function getAuthInstance() {
  if (!authInstance) {
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    authInstance = getAuth(app);
  }
  return authInstance;
}

const G = "#639922", GL = "#EAF3DE", GM = "#3B6D11";

function Btn({ children, onClick, disabled, full, ghost, google }) {
  if (google) return (
    <button onClick={onClick} disabled={disabled} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", border: "1.5px solid #ddd", borderRadius: 10, padding: "11px 20px", fontSize: 15, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500, width: full ? "100%" : undefined, transition: "box-shadow 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      {children}
    </button>
  );
  if (ghost) return (
    <button onClick={onClick} disabled={disabled} style={{ background: "none", border: "0.5px solid #ccc", borderRadius: 8, color: "#666", padding: "9px 15px", fontSize: 13, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500, width: full ? "100%" : undefined }}>{children}</button>
  );
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "#eee" : G, color: disabled ? "#aaa" : "#fff", border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 14, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontWeight: 600, width: full ? "100%" : undefined }}>{children}</button>
  );
}

function Inp({ value, onChange, placeholder, style = {} }) {
  return <input value={value} onChange={onChange} placeholder={placeholder}
    style={{ fontSize: 14, padding: "10px 12px", border: "0.5px solid #ddd", borderRadius: 8, background: "#f8f8f6", color: "#1a1a18", fontFamily: "inherit", outline: "none", width: "100%", ...style }} />;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(true);

  // On mount: check if we just came back from a Google redirect
  useEffect(() => {
    const auth = getAuthInstance();
    getRedirectResult(auth)
      .then(result => {
        if (result?.user) {
          onLogin(result.user);
        } else {
          setChecking(false);
        }
      })
      .catch(e => {
        console.error("Redirect result error:", e);
        setChecking(false);
      });
  }, []);

  async function handleGoogle() {
    setBusy(true); setErr("");
    try {
      const auth = getAuthInstance();
      const provider = new GoogleAuthProvider();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return; // page reloads, code below never runs
      } else {
        const result = await signInWithPopup(auth, provider);
        onLogin(result.user);
      }
    } catch (e) {
      setErr("Inloggen mislukt. Probeer opnieuw.");
      setBusy(false);
    }
  }

  // Show loading while checking redirect result
  if (checking) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", gap: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>bood<span style={{ color: G }}>schappen</span>app</div>
        <div style={{ fontSize: 13, color: "#aaa" }}>Inloggen...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>bood<span style={{ color: G }}>schappen</span>app</div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>Plan je week, maak boodschappenlijsten<br />en shop samen met je partner</div>
      </div>
      <Btn google full onClick={handleGoogle} disabled={busy}>
        {busy ? "Bezig..." : "Inloggen met Google"}
      </Btn>
      {err && <div style={{ fontSize: 13, color: "#dc2626", textAlign: "center", marginTop: 12 }}>{err}</div>}
    </div>
  );
}

// ─── Household Setup Screen ───────────────────────────────────────────────────
function HouseholdScreen({ user, onReady }) {
  const [mode, setMode] = useState(null); // "create" | "join"
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null); // { inviteCode }

  async function handleCreate() {
    setBusy(true); setErr("");
    try {
      const { householdId, inviteCode } = await createHousehold(user.uid, user.displayName);
      setCreated({ inviteCode });
      setTimeout(() => onReady(householdId), 0);
    } catch (e) {
      setErr("Aanmaken mislukt: " + e.message);
    }
    setBusy(false);
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setBusy(true); setErr("");
    try {
      const householdId = await joinHousehold(user.uid, user.displayName, inviteCode.trim());
      onReady(householdId);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  if (created) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Huishouden aangemaakt!</div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 24 }}>Stuur deze code naar je partner zodat hij/zij kan aansluiten:</div>
        <div style={{ background: GL, borderRadius: 12, padding: "20px", marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 6, color: GM }}>{created.inviteCode}</div>
        </div>
        <div style={{ fontSize: 12, color: "#aaa" }}>De app opent automatisch...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>bood<span style={{ color: G }}>schappen</span>app</div>
        <div style={{ fontSize: 14, color: "#888" }}>Welkom, {user.displayName?.split(" ")[0]}!</div>
      </div>

      {!mode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#555", textAlign: "center", marginBottom: 8 }}>Hoe wil je beginnen?</div>
          <button onClick={() => setMode("create")} style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nieuw huishouden aanmaken</div>
            <div style={{ fontSize: 13, color: "#888" }}>Start een nieuwe boodschappenapp en nodig je partner uit</div>
          </button>
          <button onClick={() => setMode("join")} style={{ background: "#fff", border: "0.5px solid #ddd", borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Aansluiten bij bestaand huishouden</div>
            <div style={{ fontSize: 13, color: "#888" }}>Je hebt een uitnodigingscode ontvangen van je partner</div>
          </button>
        </div>
      ) : mode === "create" ? (
        <div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 20, lineHeight: 1.6 }}>
            Je maakt een nieuw huishouden aan. Je krijgt een uitnodigingscode die je met je partner kunt delen.
          </div>
          <Btn full onClick={handleCreate} disabled={busy}>{busy ? "Aanmaken..." : "Huishouden aanmaken"}</Btn>
          {err && <div style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{err}</div>}
          <div style={{ marginTop: 12 }}><Btn ghost onClick={() => setMode(null)}>Terug</Btn></div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>Voer de uitnodigingscode in die je van je partner hebt ontvangen:</div>
          <Inp value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="bijv. A1B2C3" style={{ textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 4, marginBottom: 12 }} />
          <Btn full onClick={handleJoin} disabled={busy || !inviteCode.trim()}>{busy ? "Verbinden..." : "Aansluiten"}</Btn>
          {err && <div style={{ fontSize: 13, color: "#dc2626", marginTop: 10 }}>{err}</div>}
          <div style={{ marginTop: 12 }}><Btn ghost onClick={() => setMode(null)}>Terug</Btn></div>
        </div>
      )}
    </div>
  );
}

// ─── Household Info Modal ─────────────────────────────────────────────────────
export function HouseholdModal({ show, onClose, user, householdId }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (show && householdId) {
      getHouseholdMeta(householdId).then(setMeta);
    }
  }, [show, householdId]);

  if (!show) return null;

  async function handleSignOut() {
    const auth = getAuthInstance();
    await signOut(auth);
    window.location.reload();
  }

  const members = meta?.members ? Object.values(meta.members) : [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.25rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.09)", padding: "1.4rem", width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Huishouden</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Leden</div>
          {members.map((name, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < members.length - 1 ? "0.5px solid #f0f0f0" : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: GL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: GM }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 14 }}>{name}</span>
              {name === user.displayName && <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>jij</span>}
            </div>
          ))}
        </div>

        {meta?.inviteCode && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Uitnodigingscode</div>
            <div style={{ background: GL, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: GM }}>{meta.inviteCode}</span>
              <button onClick={() => navigator.clipboard?.writeText(meta.inviteCode)} style={{ fontSize: 12, color: GM, background: "none", border: `0.5px solid ${G}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>Kopieer</button>
            </div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Deel deze code met je partner om samen te werken</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <button onClick={handleSignOut} style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Uitloggen</button>
          <Btn ghost onClick={onClose}>Sluiten</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Provider ────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState(null);
  const [householdId, setHouseholdId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsHousehold, setNeedsHousehold] = useState(false);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const hid = await getUserHousehold(u.uid);
        if (hid) {
          setHouseholdId(hid);
          setNeedsHousehold(false);
        } else {
          setNeedsHousehold(true);
        }
      } else {
        setUser(null);
        setHouseholdId(null);
        setNeedsHousehold(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  function onHouseholdReady(hid) {
    setHouseholdId(hid);
    setNeedsHousehold(false);
  }

  return { user, householdId, authReady, needsHousehold, onHouseholdReady };
}

// ─── Auth Gate — wraps the whole app ─────────────────────────────────────────
export function AuthGate({ children }) {
  const { user, householdId, authReady, needsHousehold, onHouseholdReady } = useAuth();

  if (!authReady) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f5f5f3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>bood<span style={{ color: G }}>schappen</span>app</div>
        <div style={{ fontSize: 13, color: "#aaa" }}>Laden...</div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={() => {}} />;
  if (needsHousehold) return <HouseholdScreen user={user} onReady={onHouseholdReady} />;
  if (!householdId) return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
      <div style={{ fontSize: 13, color: "#aaa" }}>Huishouden laden...</div>
    </div>
  );

  return children({ user, householdId });
}
