// src/useSync.js
import { useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set, off } from "firebase/database";
import { FIREBASE_CONFIG } from "./firebase.js";

let app, db;
function getDB() {
  if (!db) {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
  }
  return db;
}

const SYNC_KEYS = ["persons", "week", "recipes", "inventory", "shopping"];

export function useFirebaseSync(onRemoteUpdate, onSyncStatus) {
  const ignoreNext = useRef(false);
  const pushRef = useRef(null);

  useEffect(() => {
    let database;
    try {
      database = getDB();
    } catch (e) {
      console.error("Firebase init error:", e);
      onSyncStatus("error");
      return;
    }

    const dbRef = ref(database, "boodschappenapp");

    // onValue fires immediately with current data, then again on every change
    const unsubscribe = onValue(dbRef, (snapshot) => {
      onSyncStatus("synced");

      if (ignoreNext.current) {
        ignoreNext.current = false;
        return;
      }

      const data = snapshot.val();
      // Always apply remote data — even on first load (replaces empty default state)
      if (data) onRemoteUpdate(data);

    }, (error) => {
      console.error("Firebase listen error:", error);
      onSyncStatus("error");
    });

    // Store ref so pushToFirebase can use it
    pushRef.current = dbRef;

    return () => off(dbRef, "value", unsubscribe);
  }, []);

  const pushToFirebase = useCallback((nextState) => {
    let database;
    try { database = getDB(); } catch (e) { onSyncStatus("error"); return; }

    const dbRef = ref(database, "boodschappenapp");
    const payload = {};
    SYNC_KEYS.forEach(k => { payload[k] = nextState[k] ?? null; });

    // Mark that the next incoming update is our own echo — ignore it
    ignoreNext.current = true;
    onSyncStatus("saving");

    set(dbRef, payload)
      .then(() => onSyncStatus("synced"))
      .catch(err => {
        console.error("Firebase write error:", err);
        ignoreNext.current = false;
        onSyncStatus("error");
      });
  }, []);

  return { pushToFirebase };
}
