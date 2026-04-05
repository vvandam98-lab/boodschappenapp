# Boodschappenapp

Een persoonlijke webapp om wekelijkse recepten te plannen, ingrediënten te schalen naar jouw huishouden, en een boodschappenlijst te genereren.

---

## Live zetten in 5 stappen

### Wat je nodig hebt
- Een gratis account op [github.com](https://github.com)
- Een gratis account op [vercel.com](https://vercel.com) (inloggen met GitHub)
- [Node.js](https://nodejs.org) geïnstalleerd (LTS versie)

---

### Stap 1 — Maak een GitHub repository aan

1. Ga naar [github.com/new](https://github.com/new)
2. Geef de repository de naam `boodschappenapp`
3. Laat alles op standaard staan en klik **Create repository**

---

### Stap 2 — Upload de projectbestanden

Open een terminal in de map waar je dit project hebt uitgepakt en run:

```bash
npm install
git init
git add .
git commit -m "eerste versie"
git branch -M main
git remote add origin https://github.com/JOUW_GEBRUIKERSNAAM/boodschappenapp.git
git push -u origin main
```

> Vervang `JOUW_GEBRUIKERSNAAM` door je eigen GitHub gebruikersnaam.

---

### Stap 3 — Verbind met Vercel

1. Ga naar [vercel.com](https://vercel.com) en log in met GitHub
2. Klik op **Add New → Project**
3. Kies de `boodschappenapp` repository
4. Vercel detecteert automatisch dat het een Vite/React project is
5. Klik op **Deploy**

Na ~1 minuut is de app live op een adres zoals:
`https://boodschappenapp-jouwnaam.vercel.app`

---

### Stap 4 — Klaar!

De app werkt nu volledig:
- **URL invoeren** → de Vercel backend haalt de receptpagina op (geen CORS-problemen)
- **Schalen** → ingrediënten worden automatisch aangepast naar jouw persoonenaantal
- **Boodschappenlijst** → genereer, streep af, update je voorraad
- **Opgeslagen** → alles blijft bewaard in je browser

---

### Lokaal testen (optioneel)

```bash
npm install
npm run dev
```

Open dan [http://localhost:5173](http://localhost:5173)

---

## Projectstructuur

```
boodschappenapp/
├── api/
│   └── fetch-recipe.js    ← Vercel serverless functie (haalt receptpagina's op)
├── src/
│   ├── main.jsx           ← React entry point
│   ├── App.jsx            ← Volledige app
│   └── parseRecipe.js     ← Recept parser (schema.org JSON-LD)
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Ondersteunde receptsites

De app werkt met elke site die de schema.org Recipe standaard gebruikt, waaronder:
- ohmyfoodness.nl
- leukerecepten.nl
- allerhande.nl
- 24kitchen.nl
- smulweb.nl
- en honderden andere Nederlandse en internationale receptsites
