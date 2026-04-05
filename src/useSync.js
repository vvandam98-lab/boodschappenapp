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

export function useFirebaseSync(householdId, onRemoteUpdate, onSyncStatus) {
  const ignoreNext = useRef(false);

  useEffect(() => {
    if (!householdId) return;
    let database;
    try { database = getDB(); } catch (e) { onSyncStatus("error"); return; }

    // Each household gets its own path in the database
    const dbRef = ref(database, `households/${householdId}`);

    const unsubscribe = onValue(dbRef, (snapshot) => {
      onSyncStatus("synced");
      if (ignoreNext.current) { ignoreNext.current = false; return; }
      const data = snapshot.val();
      if (data) onRemoteUpdate(data);
    }, (error) => {
      console.error("Firebase listen error:", error);
      onSyncStatus("error");
    });

    return () => off(dbRef, "value", unsubscribe);
  }, [householdId]);

  const pushToFirebase = useCallback((nextState, hid) => {
    if (!hid) return;
    let database;
    try { database = getDB(); } catch (e) { onSyncStatus("error"); return; }
    const dbRef = ref(database, `households/${hid}`);
    const payload = {};
    SYNC_KEYS.forEach(k => { payload[k] = nextState[k] ?? null; });
    ignoreNext.current = true;
    onSyncStatus("saving");
    set(dbRef, payload)
      .then(() => onSyncStatus("synced"))
      .catch(err => { ignoreNext.current = false; onSyncStatus("error"); });
  }, []);

  return { pushToFirebase };
}

// Write/read household metadata (invite code, members)
export async function createHousehold(userId, displayName) {
  const database = getDB();
  // Generate a short readable invite code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const householdId = `hh_${userId}`;
  const householdRef = ref(database, `households/${householdId}`);
  const metaRef = ref(database, `householdMeta/${householdId}`);
  const codeRef = ref(database, `inviteCodes/${code}`);

  await set(metaRef, {
    owner: userId,
    ownerName: displayName,
    members: { [userId]: displayName },
    inviteCode: code,
    createdAt: Date.now(),
  });
  await set(codeRef, { householdId, createdAt: Date.now() });

  return { householdId, inviteCode: code };
}

export async function joinHousehold(userId, displayName, code) {
  const database = getDB();
  const { get } = await import("firebase/database");

  const codeSnap = await get(ref(database, `inviteCodes/${code.toUpperCase()}`));
  if (!codeSnap.exists()) throw new Error("Ongeldige uitnodigingscode");

  const { householdId } = codeSnap.val();
  const metaRef = ref(database, `householdMeta/${householdId}/members/${userId}`);
  await set(metaRef, displayName);

  return householdId;
}

export async function getUserHousehold(userId) {
  const database = getDB();
  const { get, query, orderByChild, equalTo } = await import("firebase/database");

  // Check if user owns a household
  const ownedSnap = await get(ref(database, `householdMeta/hh_${userId}`));
  if (ownedSnap.exists()) return `hh_${userId}`;

  // Check all households for membership
  const allMeta = await get(ref(database, `householdMeta`));
  if (allMeta.exists()) {
    const data = allMeta.val();
    for (const [hid, meta] of Object.entries(data)) {
      if (meta.members && meta.members[userId]) return hid;
    }
  }
  return null;
}

export async function getHouseholdMeta(householdId) {
  const database = getDB();
  const { get } = await import("firebase/database");
  const snap = await get(ref(database, `householdMeta/${householdId}`));
  return snap.exists() ? snap.val() : null;
}
