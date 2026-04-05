# Boodschappenapp — met realtime sync

Weekplanning, boodschappenlijst en voorraad — gesynchroniseerd tussen jou en je partner in realtime via Firebase.

---

## Hoe werkt de sync?

```
Jouw telefoon  ──→  Firebase (cloud database)  ──→  Partner's telefoon
                           ↑
                    Vercel backend
                   (haalt recepten op)
```

Elke wijziging (item afstrepen, recept toevoegen, voorraad aanpassen) wordt binnen een seconde zichtbaar op alle apparaten. In de app zie je een groen/oranje stipje dat aangeeft of alles gesynchroniseerd is.

---

## Eenmalige setup: Firebase aanmaken

### Stap 1 — Maak een Firebase project aan

1. Ga naar **[console.firebase.google.com](https://console.firebase.google.com)**
2. Log in met je Google account
3. Klik op **"Project toevoegen"**
4. Geef het project de naam `boodschappenapp`
5. Schakel Google Analytics **uit** (niet nodig)
6. Klik op **"Project maken"**

---

### Stap 2 — Maak een Realtime Database aan

1. Klik in het linkermenu op **"Build" → "Realtime Database"**
2. Klik op **"Database maken"**
3. Kies locatie: **"europe-west1 (Belgium)"**
4. Kies **"Start in testmodus"** (je past dit later aan)
5. Klik op **"Inschakelen"**

Je ziet nu een lege database met een URL zoals:
`https://boodschappenapp-xxxxx-default-rtdb.europe-west1.firebasedatabase.app`

**Kopieer deze URL — je hebt hem zo nodig.**

---

### Stap 3 — Haal de Firebase config op

1. Klik linksboven op het tandwiel ⚙️ naast "Project-overzicht"
2. Klik op **"Projectinstellingen"**
3. Scroll naar beneden naar **"Jouw apps"**
4. Klik op het **</>** (web) icoontje
5. Geef de app de naam `boodschappenapp-web`
6. Klik op **"App registreren"** (Firebase Hosting: NEE)
7. Je ziet nu een blok code met `firebaseConfig`. Het ziet er zo uit:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "boodschappenapp-xxxxx.firebaseapp.com",
  databaseURL: "https://boodschappenapp-xxxxx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "boodschappenapp-xxxxx",
  storageBucket: "boodschappenapp-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

**Laat dit venster open staan.**

---

### Stap 4 — Vul de config in de app in

Open het bestand `src/firebase.js` in je tekstverwerker (Kladblok of VS Code) en vervang alle `JOUW_...` waarden met de gegevens uit stap 3:

```js
export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",           // ← jouw apiKey
  authDomain:        "boodschappenapp-xxxxx.firebaseapp.com",
  databaseURL:       "https://boodschappenapp-xxxxx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "boodschappenapp-xxxxx",
  storageBucket:     "boodschappenapp-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};
```

Sla het bestand op.

---

### Stap 5 — Database regels instellen (beveiliging)

Terug in de Firebase console:

1. Ga naar **Realtime Database → Regels**
2. Vervang de bestaande tekst door:

```json
{
  "rules": {
    "boodschappenapp": {
      ".read": true,
      ".write": true
    }
  }
}
```

3. Klik op **"Publiceren"**

> Dit is prima voor persoonlijk gebruik. De data is alleen zichtbaar voor mensen die de URL kennen.

---

### Stap 6 — Push naar GitHub en deploy

Open Git Bash in de projectmap en run:

```bash
cd /c/boodschappenapp
npm install
git add .
git commit -m "firebase realtime sync toegevoegd"
git push
```

Vercel pikt de wijziging automatisch op en deployt binnen ~1 minuut.

---

### Stap 7 — Klaar!

Open de app op je telefoon én die van je partner. Stel beide in op dezelfde URL. Streep een item af — je partner ziet het meteen!

**Tip:** Voeg de app toe aan je beginscherm voor een native app-gevoel:
- **iPhone:** Safari → Deel → "Zet op beginscherm"
- **Android:** Chrome → menu (⋮) → "Toevoegen aan beginscherm"

---

## Lokaal testen

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Let op: Firebase sync werkt ook lokaal als je `src/firebase.js` correct hebt ingevuld.

