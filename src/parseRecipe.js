// src/parseRecipe.js

const FRACS = {
  "½":0.5,"¼":0.25,"¾":0.75,"⅓":0.333,"⅔":0.667,
  "⅛":0.125,"⅜":0.375,"⅝":0.625,"⅞":0.875
};

export function parseIngStr(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim().replace(/\u00a0/g, " ");
  for (const [f, v] of Object.entries(FRACS)) s = s.replace(f, v + " ");
  const m = s.match(/^(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*([a-zA-Zµ]{1,8}\.?)?\s+(.+)$/);
  if (m) {
    const amt = parseFloat(m[1].split(/[-–]/)[0].replace(",", ".")) || 1;
    return { name: m[3].trim(), amount: amt, unit: m[2] || "stuks" };
  }
  return { name: s, amount: 1, unit: "stuks" };
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

export async function fetchAndParseRecipe(url) {
  // Call our own Vercel serverless function — no CORS issues
  const apiUrl = `/api/fetch-recipe?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fout ${res.status}`);
  }

  const html = await res.text();
  if (!html || html.length < 100) throw new Error("Lege pagina ontvangen");

  const recipe = fromJsonLd(html) || fromHtmlSelectors(html);
  if (recipe) return recipe;
  throw new Error("Geen receptgegevens gevonden op deze pagina. Niet alle sites worden ondersteund.");
}
