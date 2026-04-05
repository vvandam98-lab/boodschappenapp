// src/useSync.js
import { useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, set, off, goOnline } from "firebase/database";
import { FIREBASE_CONFIG } from "./firebase.js";

let app, db;
function getDB() {
  if (!db) {
    app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    goOnline(db);
  }
  return db;
}

const SYNC_KEYS = ["persons", "week", "recipes", "inventory", "shopping"];

export function useFirebaseSync(onRemoteUpdate, onSyncStatus) {
  const ignoreNext = useRef(false);

  useEffect(() => {
    let database;
    try {
      database = getDB();
    } catch(e) {
      console.error("Firebase init error:", e);
      onSyncStatus("error");
      return;
    }

    const dbRef = ref(database, "boodschappenapp");

    const unsubscribe = onValue(dbRef, (snapshot) => {
      // We're connected — even if database is empty, mark as synced
      onSyncStatus("synced");

      if (ignoreNext.current) {
        ignoreNext.current = false;
        return;
      }

      const data = snapshot.val();
      if (data) onRemoteUpdate(data);

    }, (error) => {
      console.error("Firebase listen error:", error);
      onSyncStatus("error");
    });

    return () => off(dbRef, "value", unsubscribe);
  }, []);

  const pushToFirebase = useCallback((nextState) => {
    let database;
    try { database = getDB(); } catch(e) { return; }

    const dbRef = ref(database, "boodschappenapp");
    const payload = {};
    SYNC_KEYS.forEach(k => { payload[k] = nextState[k] ?? null; });
    ignoreNext.current = true;
    onSyncStatus("saving");
    set(dbRef, payload)
      .then(() => onSyncStatus("synced"))
      .catch(err => {
        console.error("Firebase write error:", err);
        onSyncStatus("error");
      });
  }, []);

  return { pushToFirebase };
}
