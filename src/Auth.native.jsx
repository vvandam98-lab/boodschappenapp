// src/Auth.native.jsx — Android/Native versie van de login (Capacitor Google Auth)
// Deze file wordt ALLEEN gebruikt op de android branch

import { useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { getAuthReady, G, Btn, HouseholdScreen, HouseholdModal, useAuth, LoadingScreen } from "./auth-shared.jsx";

export const WEB_CLIENT_ID = "52803396691-7m0lr5crtr656odohmvju2d29q2fj24c.apps.googleusercontent.com";

function LoginScreen({ onLogin }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleGoogle() {
    setBusy(true); setErr("");
    try {
      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
      await GoogleAuth.initialize({
        clientId: WEB_CLIENT_ID,
        scopes: ["profile", "email"],
        grantOfflineAccess: true,
      });
      const googleUser = await GoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
      const auth = await getAuthReady();
      const result = await signInWithCredential(auth, credential);
      onLogin(result.user);
    } catch (e) {
      console.error("Native login error:", e);
      setErr("Inloggen mislukt. Probeer opnieuw.");
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
