// src/useSync.js
// Realtime sync met Firebase Realtime Database
// Luistert naar veranderingen en pusht updates naar de cloud

import { useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set, off } from "firebase/database";
import { FIREBASE_CONFIG } from "./firebase.js";

// Singleton Firebase app
let app, db;
function getDB() {
  if (!db) {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
  }
  return db;
}

// Keys we sync — tab is local-only (each person can be on their own tab)
const SYNC_KEYS = ["persons", "week", "recipes", "inventory", "shopping"];

export function useFirebaseSync(state, onRemoteUpdate) {
  const ignoreNext = useRef(false); // prevent echo: we wrote → we receive → we write again

  // Listen for remote changes
  useEffect(() => {
    const database = getDB();
    const dbRef = ref(database, "boodschappenapp");

    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (ignoreNext.current) {
        ignoreNext.current = false;
        return;
      }
      const data = snapshot.val();
      if (data) {
        onRemoteUpdate(data);
      }
    }, (error) => {
      console.error("Firebase sync error:", error);
    });

    return () => off(dbRef, "value", unsubscribe);
  }, [onRemoteUpdate]);

  // Push local changes to Firebase
  const pushToFirebase = useCallback((state) => {
    const database = getDB();
    const dbRef = ref(database, "boodschappenapp");
    const payload = {};
    SYNC_KEYS.forEach(k => { payload[k] = state[k] ?? null; });
    ignoreNext.current = true;
    set(dbRef, payload).catch(err => console.error("Firebase write error:", err));
  }, []);

  return { pushToFirebase };
}
