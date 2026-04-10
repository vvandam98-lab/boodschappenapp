// src/App.jsx
import { useState, useCallback, useRef } from "react";
import { fetchAndParseRecipe, normalizeIngredientName } from "./parseRecipe.js";
import { useFirebaseSync } from "./useSync.js";
import { AuthGate, HouseholdModal } from "./Auth.jsx";

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const G = "#639922", GL = "#EAF3DE", GM = "#3B6D11", GD = "#27500A";

// ─── Supermarkt categorieën ───────────────────────────────────────────────────
const CATEGORIEEN = [
  { id: 1, label: "🛒 Groente & fruit" },
  { id: 2, label: "🍞 Brood & bakkerij" },
  { id: 3, label: "🥩 Vlees, vis & kaas" },
  { id: 4, label: "🧊 Koeling & zuivel" },
  { id: 5, label: "❄️ Diepvries" },
  { id: 6, label: "🥫 Houdbaar & droog" },
  { id: 7, label: "🧼 Non-food & huishoudelijk" },
  { id: 8, label: "🍫 Overig" },
];

async function categoriseerItems(items) {
  // items = array van { name, normalizedName }
  // Geeft terug: { [normalizedName]: categorieId }
  if (!items.length) return {};

  const lijst = items.map((x, i) => `${i + 1}. ${x.name}`).join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Categoriseer elk boodschappenitem in exact één van deze supermarktcategorieën:
1 = Groente & fruit (vers)
2 = Brood & bakkerij
3 = Vlees, vis, kaas & vleeswaren
4 = Koeling & zuivel (melk, yoghurt, sappen, kant-en-klaar)
5 = Diepvries
6 = Houdbaar & droog (pasta, rijst, conserven, sauzen, snacks, frisdrank)
7 = Non-food & huishoudelijk (schoonmaak, toiletpapier, verzorging)
8 = Overig / kassa

Items:
${lijst}

Reageer ALLEEN met JSON in dit formaat, geen uitleg:
{"1": 4, "2": 6, "3": 1}
(sleutel = regelnummer, waarde = categorienummer)`
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";

  let mapping = {};
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    mapping = JSON.parse(clean);
  } catch (e) {
    console.error("Categoriseer parse error:", e);
    return {};
  }

  // Koppel terug aan normalizedName
  const result = {};
  items.forEach((item, i) => {
    const cat = mapping[String(i + 1)];
    if (cat) result[item.normalizedName] = Number(cat);
  });
  return result;
}

// ─── State ────────────────────────────────────────────────────────────────────
const defaultState = () => ({
  persons: 2, week: Array(7).fill(null),
  recipes: [], inventory: [], shopping: [], tab: "week",
});

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  const s = { ...state, inventory: [...state.inventory], shopping: [...state.shopping], week: [...state.week], recipes: [...state.recipes] };
  switch (action.type) {
    case "REMOTE_UPDATE": {
      const d = action.data;
      return { ...s, persons: d.persons ?? s.persons, week: d.week ?? s.week, recipes: d.recipes ?? s.recipes, inventory: d.inventory ?? s.inventory, shopping: d.shopping ?? s.shopping, tab: s.tab };
    }
    case "SET_TAB": s.tab = action.tab; break;
    case "SET_PERSONS": s.persons = Math.max(1, action.persons); break;
    case "ADD_RECIPE": s.recipes = [...s.recipes, action.recipe]; break;
    case "ASSIGN_DAY": s.week = s.week.map((r, i) => i === action.idx ? action.recipe : r); break;
    case "REMOVE_DAY": s.week = s.week.map((r, i) => i === action.idx ? null : r); break;
    case "BUILD_SHOPPING": {
      const map = {};
      s.week.filter(Boolean).forEach(r => {
        r.ingredients.forEach(ing => {
          const k = ing.normalizedName || normalizeIngredientName(ing.name);
          const scaled = Math.round(ing.amount * (s.persons / r.recipePersons) * 100) / 100;
          if (!map[k]) map[k] = { name: ing.name, normalizedName: k, amount: 0, unit: ing.unit, checked: false, category: null };
          map[k].amount += scaled;
        });
      });
      s.shopping = Object.values(map).map(x => ({ ...x, amount: Math.round(x.amount * 10) / 10 }));
      break;
    }
    case "SET_CATEGORIES": {
      // Koppel categorieën terug aan shopping items
      s.shopping = s.shopping.map(item => {
        const cat = action.mapping[item.normalizedName || normalizeIngredientName(item.name)];
        return cat ? { ...item, category: cat } : item;
      });
      break;
    }
    case "TOGGLE_ITEM": s.shopping = s.shopping.map((x, i) => i === action.idx ? { ...x, checked: !x.checked } : x); break;
    case "RESET_CHECKED": s.shopping = s.shopping.map(x => ({ ...x, checked: false })); break;
    case "ADD_SHOPPING_ITEM": {
      const k = normalizeIngredientName(action.item.name);
      const i = s.shopping.findIndex(x => (x.normalizedName || normalizeIngredientName(x.name)) === k);
      if (i >= 0) s.shopping = s.shopping.map((x, idx) => idx === i ? { ...x, amount: Math.round((x.amount + action.item.amount) * 10) / 10 } : x);
      else s.shopping = [...s.shopping, { ...action.item, normalizedName: k, checked: false, category: action.item.category || null }];
      break;
    }
    case "REMOVE_SHOPPING_ITEM": s.shopping = s.shopping.filter((_, i) => i !== action.idx); break;
    case "MARK_DONE": {
      const inv = [...s.inventory];
      s.shopping.filter(x => x.checked).forEach(item => {
        const k = item.normalizedName || normalizeIngredientName(item.name);
        const i = inv.findIndex(v => normalizeIngredientName(v.name) === k);
        if (i >= 0) inv[i] = { ...inv[i], qty: Math.round((inv[i].qty + item.amount) * 10) / 10 };
        else inv.push({ name: item.name, qty: item.amount, unit: item.unit });
      });
      s.inventory = inv; s.shopping = s.shopping.filter(x => !x.checked);
      break;
    }
    case "ADD_INVENTORY": {
      const k = normalizeIngredientName(action.item.name);
      const i = s.inventory.findIndex(v => normalizeIngredientName(v.name) === k);
      if (i >= 0) s.inventory[i] = { ...s.inventory[i], qty: Math.round((s.inventory[i].qty + action.item.qty) * 10) / 10 };
      else s.inventory = [...s.inventory, action.item];
      break;
    }
    case "UPDATE_INVENTORY": s.inventory = s.inventory.map((v, i) => i === action.idx ? { ...v, qty: action.qty } : v); break;
    case "DELETE_INVENTORY": s.inventory = s.inventory.filter((_, i) => i !== action.idx); break;
    default: break;
  }
  return s;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, full, ghost }) {
  return ghost
    ? <button onClick={onClick} disabled={disabled} style={{ background: "none", border: "0.5px solid #ccc", borderRadius: 8, color: "#666", padding: "9px 15px", fontSize: 13, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontWeight: 600, width: full ? "100%" : undefined }}>{children}</button>
    : <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "#eee" : G, color: disabled ? "#aaa" : "#fff", border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontWeight: 600, width: full ? "100%" : undefined }}>{children}</button>;
}

function Inp({ value, onChange, placeholder, onKeyDown, type = "text", style = {} }) {
  return <input value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} type={type}
    style={{ fontSize: 13, padding: "9px 11px", border: "0.5px solid #ddd", borderRadius: 8, background: "#f8f8f6", color: "#1a1a18", fontFamily: "inherit", outline: "none", ...style }} />;
}

function Card({ children, mb = 12 }) {
  return <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: mb }}>{children}</div>;
}

function CTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{children}</div>;
}

function SLabel({ children, mt = 14 }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em", margin: `${mt}px 0 7px` }}>{children}</div>;
}

function Pill({ type, children }) {
  const m = { ok: { bg: GL, c: GM }, part: { bg: "#FAEEDA", c: "#854F0B" }, no: { bg: "#FCEBEB", c: "#A32D2D" } };
  const st = m[type] || m.no;
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500, flexShrink: 0, background: st.bg, color: st.c }}>{children}</span>;
}

function Modal({ show, title, onClose, children }) {
  if (!show) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.25rem" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.09)", padding: "1.4rem", width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 13 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function ProgBar({ v }) {
  return <div style={{ height: 3, background: "#C0DD97", borderRadius: 2, margin: "9px 0", overflow: "hidden" }}>
    <div style={{ height: "100%", background: G, borderRadius: 2, width: `${v}%`, transition: "width 0.35s ease" }} />
  </div>;
}

function SyncDot({ status }) {
  const ok = status === "synced";
  const err = status === "error";
  const color = err ? "#dc2626" : ok ? G : "#f59e0b";
  const label = err ? "verbindingsfout" : ok ? "gesynchroniseerd" : "synchroniseert...";
  const textColor = err ? "#991b1b" : ok ? GM : "#92400e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, transition: "background 0.5s" }} />
      <span style={{ fontSize: 11, color: textColor }}>{label}</span>
    </div>
  );
}

// ─── Week Screen ──────────────────────────────────────────────────────────────
function WeekScreen({ state, dispatch }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState(null);
  const [dayModal, setDayModal] = useState(null);
  const [err, setErr] = useState(false);

  async function go() {
    if (!url.trim() || busy) return;
    setBusy(true); setProg(15); setMsg("Pagina ophalen..."); setInfo(null); setErr(false);
    try {
      setProg(45);
      const recipe = await fetchAndParseRecipe(url.trim());
      recipe.url = url.trim();
      dispatch({ type: "ADD_RECIPE", recipe });
      setProg(100);
      const sc = state.persons / recipe.recipePersons;
      setMsg(`✓ "${recipe.name}" — voor ${recipe.recipePersons} personen gevonden.`);
      setInfo(sc === 1 ? `Jij kookt ook voor ${state.persons} personen — geen aanpassing nodig.` : `Recept voor ${recipe.recipePersons} pers. → ×${sc.toFixed(2)} voor jouw ${state.persons} personen.`);
      setUrl(""); setTimeout(() => setProg(0), 700);
    } catch (e) { setProg(0); setMsg(`Fout: ${e.message}`); setErr(true); }
    setBusy(false);
  }

  return (
    <div style={{ padding: "1rem" }}>
      <Card>
        <CTitle>Recept toevoegen via URL</CTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <Inp value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === "Enter" && go()} style={{ flex: 1 }} />
          <Btn onClick={go} disabled={busy || !url.trim()}>{busy ? "Bezig..." : "Analyseer"}</Btn>
        </div>
        {busy && <ProgBar v={prog} />}
        {msg && <div style={{ fontSize: 13, color: err ? "#dc2626" : "#777", padding: "6px 0", textAlign: "center" }}>{msg}</div>}
        {info && !err && <div style={{ background: GL, borderRadius: 8, padding: "9px 13px", fontSize: 13, color: GM, marginTop: 9, lineHeight: 1.55 }}>{info}</div>}
      </Card>
      <Card>
        <CTitle>Weekplanning</CTitle>
        {DAYS.map((d, i) => {
          const r = state.week[i];
          const sc = r ? state.persons / r.recipePersons : null;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "#f8f8f6", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.08)", marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#999", minWidth: 28 }}>{d}</span>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {r ? <>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{r.recipePersons} pers. → {sc === 1 ? "geen aanpassing" : `×${sc.toFixed(2)}`} voor {state.persons} pers.</div>
                </> : <span style={{ fontSize: 13, color: "#ccc" }}>Geen recept</span>}
              </div>
              {r
                ? <button onClick={() => dispatch({ type: "REMOVE_DAY", idx: i })} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 3px", fontFamily: "inherit" }}>×</button>
                : <button onClick={() => setDayModal(i)} style={{ fontSize: 11, color: G, background: "none", border: `0.5px solid #C0DD97`, borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Voeg toe</button>}
            </div>
          );
        })}
      </Card>
      <Btn full onClick={() => {
        if (!state.week.filter(Boolean).length) { alert("Voeg eerst recepten toe."); return; }
        dispatch({ type: "BUILD_SHOPPING" }); dispatch({ type: "SET_TAB", tab: "lijst" });
      }}>Maak boodschappenlijst voor deze week</Btn>
      <Modal show={dayModal !== null} title={dayModal !== null ? `Recept voor ${DAYS[dayModal]}dag` : ""} onClose={() => setDayModal(null)}>
        {!state.recipes.length ? <p style={{ fontSize: 13, color: "#bbb" }}>Analyseer eerst een recept-URL hierboven.</p>
          : state.recipes.map((r, ri) => (
            <div key={ri} onClick={() => { dispatch({ type: "ASSIGN_DAY", idx: dayModal, recipe: r }); setDayModal(null); }}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "#f8f8f6", borderRadius: 8, marginBottom: 8, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.08)" }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: G, background: GL, padding: "2px 9px", borderRadius: 20, fontWeight: 500 }}>{r.recipePersons} pers.</span>
            </div>
          ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 13 }}><Btn ghost onClick={() => setDayModal(null)}>Sluiten</Btn></div>
      </Modal>
    </div>
  );
}

// ─── Lijst Screen ─────────────────────────────────────────────────────────────
function LijstScreen({ state, dispatch }) {
  const [addName, setAddName] = useState(""), [addQty, setAddQty] = useState(""), [addUnit, setAddUnit] = useState("");
  const [categorising, setCategorising] = useState(false);

  // Categoriseer items die nog geen categorie hebben
  async function categoriseerOntbrekende(shopping) {
    const zonder = shopping.filter(x => !x.category);
    if (!zonder.length) return;
    setCategorising(true);
    try {
      const mapping = await categoriseerItems(zonder);
      if (Object.keys(mapping).length) {
        dispatch({ type: "SET_CATEGORIES", mapping });
      }
    } catch (e) {
      console.error("Categoriseren mislukt:", e);
    }
    setCategorising(false);
  }

  // Categoriseer bij mount en als shopping verandert
  const prevShoppingRef = useRef(null);
  const shoppingJson = JSON.stringify(state.shopping.map(x => x.normalizedName));
  if (prevShoppingRef.current !== shoppingJson) {
    prevShoppingRef.current = shoppingJson;
    const ongecategoriseerd = state.shopping.filter(x => !x.category);
    if (ongecategoriseerd.length > 0 && !categorising) {
      categoriseerOntbrekende(state.shopping);
    }
  }

  async function handleAdd() {
    if (!addName.trim()) return;
    const name = addName.trim();
    const normalizedName = normalizeIngredientName(name);

    // Categoriseer het nieuwe item direct
    let category = null;
    try {
      const mapping = await categoriseerItems([{ name, normalizedName }]);
      category = mapping[normalizedName] || null;
    } catch (e) { /* stil falen is ok */ }

    dispatch({ type: "ADD_SHOPPING_ITEM", item: { name, amount: parseFloat(addQty) || 1, unit: addUnit.trim() || "stuks", category } });
    setAddName(""); setAddQty(""); setAddUnit("");
  }

  const invMap = {};
  state.inventory.forEach(v => { invMap[normalizeIngredientName(v.name)] = v; });
  const done = state.shopping.filter(x => x.checked).length;

  // Groepeer items op categorie, gesorteerd op categorievolgorde
  const teHalen = state.shopping.filter(x => !x.checked);
  const gehaald = state.shopping.filter(x => x.checked);

  // Groepeer te-halen items per categorie
  const groepenMap = {};
  teHalen.forEach(item => {
    const catId = item.category || 8;
    if (!groepenMap[catId]) groepenMap[catId] = [];
    groepenMap[catId].push(item);
  });

  // Sorteer groepen op categorievolgorde
  const groepen = CATEGORIEEN
    .map(cat => ({ cat, items: groepenMap[cat.id] || [] }))
    .filter(g => g.items.length > 0);

  function Row({ item }) {
    const idx = state.shopping.indexOf(item);
    const iv = invMap[item.normalizedName || normalizeIngredientName(item.name)];
    let pill = null;
    if (iv) {
      if (iv.qty >= item.amount) pill = <Pill type="ok">Op voorraad</Pill>;
      else if (iv.qty > 0) pill = <Pill type="part">Deels ({iv.qty} {iv.unit})</Pill>;
      else pill = <Pill type="no">Nodig</Pill>;
    }
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div onClick={() => dispatch({ type: "TOGGLE_ITEM", idx })}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 8, cursor: "pointer", opacity: item.checked ? 0.4 : 1, userSelect: "none", flex: 1 }}>
          <div style={{ width: 19, height: 19, borderRadius: "50%", flexShrink: 0, background: item.checked ? G : "none", border: item.checked ? "none" : "1.5px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.checked && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ flex: 1, fontSize: 14, textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</span>
          <span style={{ fontSize: 13, color: "#999", whiteSpace: "nowrap" }}>{item.amount} {item.unit}</span>
          {pill}
        </div>
        <button onClick={() => dispatch({ type: "REMOVE_SHOPPING_ITEM", idx })} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0, fontFamily: "inherit" }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem" }}>
      {state.shopping.length > 0 && (
        <div style={{ background: GL, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: GM }}>
            Afgestreept
            {categorising && <span style={{ marginLeft: 8, color: "#aaa", fontSize: 12 }}>🛒 Sorteren...</span>}
          </span>
          <strong style={{ fontSize: 15, color: GD }}>{done} / {state.shopping.length}</strong>
        </div>
      )}
      <Card mb={12}>
        <CTitle>Zelf toevoegen</CTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <Inp value={addName} onChange={e => setAddName(e.target.value)} placeholder="Product" onKeyDown={e => e.key === "Enter" && handleAdd()} style={{ flex: 2 }} />
          <Inp value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Hv." type="number" style={{ flex: 1, maxWidth: 70 }} />
          <Inp value={addUnit} onChange={e => setAddUnit(e.target.value)} placeholder="eenheid" style={{ flex: 1, maxWidth: 75 }} />
          <Btn onClick={handleAdd}>+</Btn>
        </div>
        <div style={{ fontSize: 11, color: "#bbb", marginTop: 7 }}>Staat het product al op de lijst? Dan wordt het opgeteld.</div>
      </Card>

      {!state.shopping.length && (
        <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#ccc", fontSize: 14, lineHeight: 1.7 }}>
          Nog niets op de lijst.<br />Voeg recepten toe via de Week-tab<br />of voeg zelf producten toe hierboven.
        </div>
      )}

      {/* Te halen — gegroepeerd per supermarktafdeling */}
      {groepen.map(({ cat, items }) => (
        <div key={cat.id}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: "16px 0 8px", paddingLeft: 2 }}>
            {cat.label}
          </div>
          {items.map((x, i) => <Row key={i} item={x} />)}
        </div>
      ))}

      {/* In het karretje */}
      {gehaald.length > 0 && (
        <>
          <SLabel mt={20}>In het karretje</SLabel>
          {gehaald.map((x, i) => <Row key={i} item={x} />)}
        </>
      )}

      {state.shopping.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Btn ghost full onClick={() => dispatch({ type: "RESET_CHECKED" })}>Alles terugzetten</Btn>
          <Btn full onClick={() => dispatch({ type: "MARK_DONE" })}>Boodschappen gedaan — voorraad bijwerken</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Voorraad Screen ──────────────────────────────────────────────────────────
function VoorraadScreen({ state, dispatch }) {
  const [n, setN] = useState(""), [q, setQ] = useState(""), [u, setU] = useState("");
  return (
    <div style={{ padding: "1rem" }}>
      <Card>
        <CTitle>Mijn voorraad</CTitle>
        {!state.inventory.length && <p style={{ fontSize: 13, color: "#bbb", paddingBottom: 8 }}>Nog geen voorraad ingevoerd.</p>}
        {state.inventory.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 14 }}>{v.name}</span>
            <input type="number" value={v.qty} min={0} step={0.1} onChange={e => dispatch({ type: "UPDATE_INVENTORY", idx: i, qty: parseFloat(e.target.value) || 0 })}
              style={{ width: 65, border: "0.5px solid #ddd", borderRadius: 6, padding: "4px 7px", fontSize: 13, textAlign: "center", background: "#f8f8f6", fontFamily: "inherit" }} />
            <span style={{ fontSize: 12, color: "#bbb", minWidth: 38 }}>{v.unit}</span>
            <button onClick={() => dispatch({ type: "DELETE_INVENTORY", idx: i })} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}>×</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          <Inp value={n} onChange={e => setN(e.target.value)} placeholder="Ingredient" style={{ flex: 2 }} />
          <Inp value={q} onChange={e => setQ(e.target.value)} placeholder="Hv." type="number" style={{ flex: 1, maxWidth: 72 }} />
          <Inp value={u} onChange={e => setU(e.target.value)} placeholder="eenheid" style={{ flex: 1, maxWidth: 72 }} />
          <Btn onClick={() => {
            if (!n.trim()) return;
            dispatch({ type: "ADD_INVENTORY", item: { name: n.trim(), qty: parseFloat(q) || 0, unit: u.trim() || "stuks" } });
            setN(""); setQ(""); setU("");
          }}>+</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Main App (inside auth) ───────────────────────────────────────────────────
function MainApp({ user, householdId }) {
  const [state, rawDispatch] = useState(() => defaultState());
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [loaded, setLoaded] = useState(false);
  const [hhModal, setHhModal] = useState(false);
  const [personsModal, setPersonsModal] = useState(false);
  const [tmpP, setTmpP] = useState(2);
  const pushTimer = useRef(null);

  const onRemoteUpdate = useCallback((data) => {
    rawDispatch(prev => reducer(prev, { type: "REMOTE_UPDATE", data }));
    setLoaded(true); setSyncStatus("synced");
  }, []);

  const onSyncStatus = useCallback((status) => {
    setSyncStatus(status);
    if (status === "synced" || status === "error") setLoaded(true);
  }, []);

  const { pushToFirebase } = useFirebaseSync(householdId, onRemoteUpdate, onSyncStatus);

  function dispatch(action) {
    if (action.type === "SET_TAB") { rawDispatch(prev => reducer(prev, action)); return; }
    rawDispatch(prev => {
      const next = reducer(prev, action);
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => pushToFirebase(next, householdId), 400);
      return next;
    });
  }

  const tab = state.tab || "week";

  if (!loaded) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f5f5f3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>bood<span style={{ color: G }}>schappen</span>app</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#999", fontSize: 13 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
          Verbinden met database...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f5f5f3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1a1a18" }}>
      <div style={{ background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,0.09)", padding: "1rem 1.25rem 0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>bood<span style={{ color: G }}>schappen</span>app</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { setTmpP(state.persons); setPersonsModal(true); }}
              style={{ background: GL, color: GM, fontSize: 12, padding: "5px 11px", borderRadius: 20, cursor: "pointer", border: "none", fontWeight: 500, fontFamily: "inherit" }}>
              {state.persons} persoon{state.persons !== 1 ? "en" : ""}
            </button>
            <button onClick={() => setHhModal(true)} style={{ width: 30, height: 30, borderRadius: "50%", background: GL, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: GM }}>
              {user.displayName?.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}><SyncDot status={syncStatus} /></div>
        <div style={{ display: "flex" }}>
          {[["week", "Week"], ["lijst", "Boodschappenlijst"], ["voorraad", "Voorraad"]].map(([t, l]) => (
            <button key={t} onClick={() => dispatch({ type: "SET_TAB", tab: t })}
              style={{ flex: 1, padding: "10px 0", fontSize: 13, textAlign: "center", background: "none", border: "none", cursor: "pointer", borderBottom: tab === t ? `2px solid ${G}` : "2px solid transparent", color: tab === t ? G : "#999", fontWeight: tab === t ? 600 : 400, fontFamily: "inherit", transition: "all 0.15s" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === "week" && <WeekScreen state={state} dispatch={dispatch} />}
      {tab === "lijst" && <LijstScreen state={state} dispatch={dispatch} />}
      {tab === "voorraad" && <VoorraadScreen state={state} dispatch={dispatch} />}

      {/* Persons modal */}
      <Modal show={personsModal} title="Huishouden instellen" onClose={() => setPersonsModal(false)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "1rem 0" }}>
          <label style={{ flex: 1, fontSize: 14, color: "#666" }}>Aantal personen:</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setTmpP(p => Math.max(1, p - 1))} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid #ddd", background: "#f8f8f6", fontSize: 17, cursor: "pointer", fontFamily: "inherit" }}>−</button>
            <span style={{ fontSize: 18, fontWeight: 600, minWidth: 22, textAlign: "center" }}>{tmpP}</span>
            <button onClick={() => setTmpP(p => p + 1)} style={{ width: 32, height: 32, borderRadius: "50%", border: "0.5px solid #ddd", background: "#f8f8f6", fontSize: 17, cursor: "pointer", fontFamily: "inherit" }}>+</button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#bbb", lineHeight: 1.5 }}>Ingrediënten worden automatisch geschaald naar dit aantal.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 13 }}>
          <Btn ghost onClick={() => setPersonsModal(false)}>Annuleren</Btn>
          <Btn onClick={() => { dispatch({ type: "SET_PERSONS", persons: tmpP }); setPersonsModal(false); }}>Opslaan</Btn>
        </div>
      </Modal>

      {/* Household modal */}
      <HouseholdModal show={hhModal} onClose={() => setHhModal(false)} user={user} householdId={householdId} />
    </div>
  );
}

// ─── App Root — wrapped in AuthGate ──────────────────────────────────────────
export default function App() {
  return (
    <AuthGate>
      {({ user, householdId }) => <MainApp user={user} householdId={householdId} />}
    </AuthGate>
  );
}
