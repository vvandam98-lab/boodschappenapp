// src/Auth.web.jsx — Web versie van de login (popup)
// Deze file wordt ALLEEN gebruikt op main branch (webapp)

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getAuthReady, G, GL, Btn, HouseholdScreen, HouseholdModal, useAuth, LoadingScreen } from "./auth-shared.jsx";

function LoginScreen({ onLogin }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleGoogle() {
    setBusy(true); setErr("");
    try {
      const auth = await getAuthReady();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (e) {
      if (e.code === "auth/popup-blocked") {
        setErr("Popup geblokkeerd. Sta popups toe voor deze site.");
      } else if (e.code !== "auth/cancelled-popup-request" && e.code !== "auth/popup-closed-by-user") {
        setErr("Inloggen mislukt. Probeer opnieuw.");
      }
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
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

export { HouseholdModal };

export function AuthGate({ children }) {
  const { user, householdId, authReady, needsHousehold, onHouseholdReady } = useAuth();
  if (!authReady) return <LoadingScreen />;
  if (!user) return <LoginScreen onLogin={() => {}} />;
  if (needsHousehold) return <HouseholdScreen user={user} onReady={onHouseholdReady} />;
  if (!householdId) return <LoadingScreen message="Huishouden laden..." />;
  return children({ user, householdId });
}
