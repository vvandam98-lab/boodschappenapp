// src/parseRecipe.js

const FRACS = {
  "½":0.5,"¼":0.25,"¾":0.75,"⅓":0.333,"⅔":0.667,
  "⅛":0.125,"⅜":0.375,"⅝":0.625,"⅞":0.875
};

// Strips preparation notes from ingredient names so they can be matched.
// "ui (in ringen gesneden)" → "ui"
// "knoflook, fijngehakt" → "knoflook"
// "tomaten, in blokjes" → "tomaten"
export function normalizeIngredientName(name) {
  if (!name) return "";
  let n = name.toLowerCase().trim();
  // Remove anything in parentheses: "ui (gesneden)" → "ui"
  n = n.replace(/\s*\(.*?\)/g, "");
  // Remove anything after comma: "knoflook, fijngehakt" → "knoflook"
  n = n.replace(/\s*,.*$/, "");
  // Remove anything after common prep words
  const prepWords = [
    "gesneden", "gehakt", "geraspt", "geklopt", "gepeld", "gewassen",
    "gehalveerd", "in ringen", "in blokjes", "in reepjes", "fijngesneden",
    "fijngehakt", "grof", "fijn", "vers", "gedroogd", "gekookt", "rauw",
    "op kamertemperatuur", "zacht", "gesmolten", "losgeklopt"
  ];
  for (const w of prepWords) {
    const idx = n.indexOf(" " + w);
    if (idx > 0) n = n.slice(0, idx);
  }
  return n.trim();
}

export function parseIngStr(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim().replace(/\u00a0/g, " ");
  for (const [f, v] of Object.entries(FRACS)) s = s.replace(f, v + " ");
  const m = s.match(/^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*([a-zA-Zµ]{1,8}\.?)?\s+(.+)$/);
  if (m) {
    const amt = parseFloat(m[1].split(/[-–]/)[0].replace(",", ".")) || 1;
    const rawName = m[3].trim();
    return { name: rawName, normalizedName: normalizeIngredientName(rawName), amount: amt, unit: m[2] || "stuks" };
  }
  return { name: s, normalizedName: normalizeIngredientName(s), amount: 1, unit: "stuks" };
}

function parseYield(y) {
  if (!y) return null;
  if (typeof y === "number") return y;
  if (Array.isArray(y)) y = y[0];
  if (typeof y === "object" && y !== null) return parseInt(y.value) || null;
  const m = String(y).match(/\d+/);
  return m ? parseInt(m[0]) : null;
}

function findRecipe(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const x of data) { const r = findRecipe(x); if (r) return r; }
    return null;
  }
  if (typeof data !== "object") return null;
  const t = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
  if (t.includes("Recipe")) return data;
  if (data["@graph"]) return findRecipe(data["@graph"]);
  return null;
}

export function fromJsonLd(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const recipe = findRecipe(JSON.parse(s.textContent));
      if (!recipe) continue;
      const ingredients = (recipe.recipeIngredient || [])
        .map(x => typeof x === "string" ? parseIngStr(x) : parseIngStr(x?.name))
        .filter(Boolean).slice(0, 20);
      if (ingredients.length > 0) {
        return {
          name: recipe.name || "Recept",
          recipePersons: parseYield(recipe.recipeYield) || 4,
          ingredients,
        };
      }
    } catch (e) { continue; }
  }
  return null;
}

export function fromHtmlSelectors(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sels = [
    "[itemprop='recipeIngredient']",
    ".wprm-recipe-ingredient",
    ".wprm-recipe-ingredient-container",
    "[class*='ingredient'] li",
    ".recipe-ingredient",
    ".tasty-recipes-ingredients-body li",
    ".mv-create-ingredients li",
  ];
  for (const sel of sels) {
    const items = [...doc.querySelectorAll(sel)];
    if (items.length < 2) continue;
    const ingredients = items.map(el => parseIngStr(el.textContent.trim())).filter(Boolean).slice(0, 20);
    if (ingredients.length < 2) continue;
    const nameEl = doc.querySelector("h1, .wprm-recipe-name, .recipe-title, [itemprop='name']");
    const yEl = doc.querySelector("[class*='servings'],[class*='yield'],[itemprop='recipeYield'],.wprm-recipe-servings-container");
    return {
      name: nameEl?.textContent.trim() || "Recept",
      recipePersons: parseYield(yEl?.textContent) || 4,
      ingredients,
    };
  }
  return null;
}


export function fromPicnic(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Picnic puts ingredient name in alt attribute of img, amount+unit in next text node
  // Pattern: <img alt="rundergehakt"> ... "500 g"
  const imgs = [...doc.querySelectorAll('img[alt]')];
  const ingredients = [];

  imgs.forEach(img => {
    const name = img.getAttribute("alt")?.trim();
    if (!name || name.length < 2) return;

    // Walk siblings to find the amount text
    let el = img.parentElement;
    if (!el) return;
    const text = el.textContent.trim();

    // Match "500 g" or "2 stuks" or "1 el" at end of text block
    const m = text.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s*$/);
    if (m) {
      const amount = parseFloat(m[1].replace(",", ".")) || 1;
      const unit = m[2].trim();
      // Skip obviously non-ingredient images (logos, arrows etc)
      if (name.toLowerCase().includes("arrow") || name.toLowerCase().includes("back")) return;
      ingredients.push({ name, normalizedName: normalizeIngredientName(name), amount, unit });
    }
  });

  if (ingredients.length < 2) return null;

  // Get recipe name from h1
  const nameEl = doc.querySelector("h1");
  const name = nameEl?.textContent.replace(/\*/g, "").trim() || "Recept";

  // Picnic doesn't show persons count — default to 4
  return { name, recipePersons: 4, ingredients: ingredients.slice(0, 15) };
}

export async function fetchAndParseRecipe(url) {
  const apiUrl = `/api/fetch-recipe?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fout ${res.status}`);
  }
  const html = await res.text();
  if (!html || html.length < 100) throw new Error("Lege pagina ontvangen");
  const recipe = fromJsonLd(html) || fromHtmlSelectors(html) || fromPicnic(html);
  if (recipe) return recipe;
  throw new Error("Geen receptgegevens gevonden op deze pagina. Niet alle sites worden ondersteund.");
}
