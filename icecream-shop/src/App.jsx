import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ============================================================
// TECH STACK NOTE (shown in app):
// Frontend: React (this file)
// Database: Supabase FREE tier (https://supabase.com)
// No backend needed — Supabase handles everything!
// ============================================================

// ─── FLAVORS & PRICES (edit prices here) ─────────────────────
const FLAVORS = [
  { name: "Tender Coconut", price: 30, emoji: "🥥", category: "Fruit" },
  { name: "Blue Berry", price: 30, emoji: "🫐", category: "Fruit" },
  { name: "Jack Fruit", price: 30, emoji: "🍈", category: "Fruit" },
  { name: "Avocado", price: 25, emoji: "🥑", category: "Fruit" },
  { name: "Kacha Mango", price: 15, emoji: "🥭", category: "Fruit" },
  { name: "Chilli Guava", price: 15, emoji: "🌶️", category: "Fruit" },
  { name: "Mango", price: 25, emoji: "🥭", category: "Fruit" },
  { name: "Grape", price: 20, emoji: "🍇", category: "Fruit" },
  { name: "Orange", price: 10, emoji: "🍊", category: "Fruit" },
  { name: "Strawberry", price: 20, emoji: "🍓", category: "Fruit" },
  { name: "Green Apple", price: 15, emoji: "🍏", category: "Fruit" },
  { name: "Chikku", price: 20, emoji: "🟤", category: "Fruit" },
  { name: "Seethaphal", price: 25, emoji: "💚", category: "Fruit" },
  { name: "Fruit & Nut", price: 40, emoji: "🍑", category: "Premium" },
  { name: "Roasted Almond", price: 40, emoji: "🌰", category: "Premium" },
  { name: "Roasted Cashew", price: 40, emoji: "🥜", category: "Premium" },
  { name: "Hazelnut", price: 40, emoji: "🟫", category: "Premium" },
  { name: "Pistachio", price: 40, emoji: "💚", category: "Premium" },
  { name: "Rasamalai", price: 40, emoji: "🍮", category: "Special" },
  { name: "Lotus Biscoff", price: 40, emoji: "🍪", category: "Special" },
  { name: "Spanish Delight", price: 30, emoji: "✨", category: "Special" },
  { name: "Fig Honey", price: 25, emoji: "🍯", category: "Special" },
  { name: "Chocolate", price: 20, emoji: "🍫", category: "Classic" },
  { name: "Coffee", price: 20, emoji: "☕", category: "Classic" },
  { name: "Malai", price: 30, emoji: "🥛", category: "Classic" },
  { name: "Oreo", price: 30, emoji: "⚫", category: "Classic" },
  { name: "Butter Scotch", price: 25, emoji: "🟡", category: "Classic" },
  { name: "Paan", price: 20, emoji: "🌿", category: "Classic" },
  { name: "Bubble Gum", price: 20, emoji: "🫧", category: "Classic" },
  { name: "Gulab Jamun", price: 30, emoji: "🔴", category: "Special" },
];

const CATEGORIES = ["All", "Fruit", "Classic", "Premium", "Special"];

// ─── SUPABASE DATABASE FUNCTIONS ──────────────────────────────
const loadSales = async () => {
  const { data } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
};

const saveSale = async (entry) => {
  await supabase.from("sales").insert([
    {
      date: entry.date,
      month: entry.month,
      time: entry.time,
      items: entry.items,
      total: entry.total,
      pay_mode: entry.payMode,
    },
  ]);
};

// ─── HELPERS ────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `₹${n.toLocaleString("en-IN")}`;

// ─── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("intro"); // intro | pos | dashboard
  const [sales, setSales] = useState([]); // ✅ FIX: start empty, load from Supabase
  const [cart, setCart] = useState([]);
  const [payMode, setPayMode] = useState("cash");
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast] = useState(null);
  const [dashTab, setDashTab] = useState("today");
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);
  const introRef = useRef(null);

  // ✅ FIX: Load sales from Supabase on app start
  useEffect(() => {
    loadSales().then((data) => {
      setSales(data);
      setLoading(false);
    });
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Cart operations
  const addToCart = (flavor) => {
    setCart((c) => {
      const ex = c.find((i) => i.name === flavor.name);
      if (ex)
        return c.map((i) =>
          i.name === flavor.name ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...c, { ...flavor, qty: 1 }];
    });
    showToast(`${flavor.emoji} ${flavor.name} added!`);
  };

  const removeFromCart = (name) =>
    setCart((c) => c.filter((i) => i.name !== name));

  const updateQty = (name, delta) => {
    setCart((c) =>
      c.map((i) =>
        i.name === name ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
      ),
    );
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // ✅ FIX: async checkout using saveSale (Supabase)
  const checkout = async () => {
    if (!cart.length) return showToast("Cart is empty!", "error");
    const now = new Date();
    const entry = {
      date: now.toISOString().slice(0, 10),
      month: now.toISOString().slice(0, 7),
      time: now.toTimeString().slice(0, 5),
      items: cart,
      total: cartTotal,
      payMode,
    };
    await saveSale(entry);
    const refreshed = await loadSales();
    setSales(refreshed);
    setCart([]);
    showToast(
      `✅ Sale of ${fmt(cartTotal)} recorded via ${payMode.toUpperCase()}!`,
    );
  };

  // ── ANALYTICS ──
  const analyticsFor = (period) => {
    const filtered = sales.filter((s) =>
      period === "today" ? s.date === today() : s.month === thisMonth(),
    );
    const totalRevenue = filtered.reduce((s, x) => s + x.total, 0);
    const upiRev = filtered
      .filter((s) => s.pay_mode === "upi")
      .reduce((s, x) => s + x.total, 0);
    const cashRev = filtered
      .filter((s) => s.pay_mode === "cash")
      .reduce((s, x) => s + x.total, 0);
    const totalScoops = filtered.reduce(
      (s, x) => s + x.items.reduce((a, i) => a + i.qty, 0),
      0,
    );
    const txnCount = filtered.length;

    const flavorMap = {};
    filtered.forEach((s) =>
      s.items.forEach((i) => {
        flavorMap[i.name] = (flavorMap[i.name] || 0) + i.qty;
      }),
    );
    const topFlavors = Object.entries(flavorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalRevenue,
      upiRev,
      cashRev,
      totalScoops,
      txnCount,
      topFlavors,
      filtered,
    };
  };

  const ana = analyticsFor(dashTab);

  const displayFlavors = FLAVORS.filter(
    (f) =>
      (filterCat === "All" || f.category === filterCat) &&
      f.name.toLowerCase().includes(searchQ.toLowerCase()),
  );

  // ════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ════════════════════════════════════════════════════════
  if (screen === "intro")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Georgia', serif",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: `${20 + Math.random() * 60}px`,
              height: `${20 + Math.random() * 60}px`,
              borderRadius: "50%",
              background: `hsla(${Math.random() * 360}, 80%, 70%, 0.15)`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite alternate`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}

        <style>{`
          @keyframes float { from { transform: translateY(0px) rotate(0deg); } to { transform: translateY(-30px) rotate(10deg); } }
          @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
          @keyframes slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
          @keyframes glow { 0%,100% { text-shadow: 0 0 20px #f9a8d4, 0 0 40px #ec4899; } 50% { text-shadow: 0 0 40px #f9a8d4, 0 0 80px #ec4899; } }
          .btn-main { 
            background: linear-gradient(135deg, #ec4899, #f97316);
            border: none; color: white; padding: 16px 40px; font-size: 18px;
            border-radius: 50px; cursor: pointer; font-family: Georgia, serif;
            transition: all 0.3s; box-shadow: 0 8px 32px rgba(236,72,153,0.4);
            letter-spacing: 1px;
          }
          .btn-main:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 16px 40px rgba(236,72,153,0.6); }
          .btn-ghost { 
            background: transparent; border: 2px solid rgba(255,255,255,0.3);
            color: white; padding: 12px 30px; font-size: 15px;
            border-radius: 50px; cursor: pointer; font-family: Georgia, serif;
            transition: all 0.3s;
          }
          .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: white; }
        `}</style>

        <div
          style={{
            textAlign: "center",
            zIndex: 1,
            animation: "slideUp 0.8s ease",
          }}
        >
          <div
            style={{
              fontSize: 80,
              marginBottom: 16,
              animation: "pulse 3s ease infinite",
            }}
          >
            🍨
          </div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: 6,
              color: "#f9a8d4",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Welcome to
          </div>
          <h1
            style={{
              fontSize: "clamp(36px, 8vw, 72px)",
              margin: "0 0 8px",
              background: "linear-gradient(135deg, #fbbf24, #ec4899, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "glow 3s ease infinite",
              lineHeight: 1.1,
            }}
          >
            Lickees
          </h1>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 48,
              letterSpacing: 2,
            }}
          >
            Sales Tracking System
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button className="btn-main" onClick={() => setScreen("pos")}>
              🛒 Start Selling
            </button>
            <button
              className="btn-ghost"
              onClick={() => setScreen("dashboard")}
            >
              📊 View Dashboard
            </button>
          </div>

          <div
            style={{
              marginTop: 60,
              display: "flex",
              gap: 40,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {[
              ["🍦", "30+", "Flavors"],
              ["💳", "UPI & Cash", "Payment"],
              ["📈", "Real-time", "Analytics"],
            ].map(([icon, val, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>{icon}</div>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#fbbf24" }}
                >
                  {val}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: 2,
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  // ════════════════════════════════════════════════════════
  // POS SCREEN
  // ════════════════════════════════════════════════════════
  if (screen === "pos")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fef3f7",
          fontFamily: "'Georgia', serif",
        }}
      >
        <style>{`
          @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
          @keyframes toastIn { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
          .flavor-card { 
            background: white; border-radius: 16px; padding: 16px; cursor: pointer;
            transition: all 0.2s; border: 2px solid transparent;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          }
          .flavor-card:hover { transform: translateY(-4px) scale(1.02); border-color: #ec4899; box-shadow: 0 8px 24px rgba(236,72,153,0.2); }
          .pill { padding: 6px 16px; border-radius: 30px; border: none; cursor: pointer; font-size: 13px; font-family: Georgia, serif; transition: all 0.2s; }
          .pill.active { background: #ec4899; color: white; }
          .pill.inactive { background: white; color: #666; border: 1px solid #e5e7eb; }
          .pill:hover { transform: scale(1.05); }
        `}</style>

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: toast.type === "error" ? "#ef4444" : "#10b981",
              color: "white",
              padding: "12px 24px",
              borderRadius: 30,
              zIndex: 9999,
              animation: "toastIn 0.3s ease",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              fontSize: 14,
              fontFamily: "Georgia, serif",
            }}
          >
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f0c29, #302b63)",
            color: "white",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setScreen("intro")}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 20,
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 22 }}>🍨</span>
            <span style={{ fontSize: 18, fontWeight: "bold" }}>
              Lickees — POS
            </span>
          </div>
          <button
            onClick={() => setScreen("dashboard")}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
              padding: "8px 18px",
              borderRadius: 30,
              cursor: "pointer",
              fontFamily: "Georgia, serif",
              fontSize: 14,
            }}
          >
            📊 Dashboard
          </button>
        </div>

        <div
          style={{
            display: "flex",
            height: "calc(100vh - 65px)",
            overflow: "hidden",
          }}
        >
          {/* LEFT — Flavor Grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                placeholder="🔍 Search flavors..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 30,
                  border: "1px solid #e5e7eb",
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                  width: 200,
                  outline: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCat(c)}
                    className={`pill ${filterCat === c ? "active" : "inactive"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 12,
              }}
            >
              {displayFlavors.map((f) => (
                <div
                  key={f.name}
                  className="flavor-card"
                  onClick={() => addToCart(f)}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{f.emoji}</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      color: "#1f2937",
                      lineHeight: 1.3,
                      marginBottom: 6,
                    }}
                  >
                    {f.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "#ec4899",
                        fontWeight: "bold",
                        fontSize: 15,
                      }}
                    >
                      {fmt(f.price)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        background: "#fef3f7",
                        color: "#be185d",
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      {f.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Cart */}
          <div
            style={{
              width: 320,
              background: "white",
              borderLeft: "1px solid #fce7f3",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #fce7f3",
                background: "#fef3f7",
              }}
            >
              <div
                style={{ fontSize: 16, fontWeight: "bold", color: "#831843" }}
              >
                🛒 Cart ({cart.length})
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {cart.length === 0 && (
                <div
                  style={{ textAlign: "center", color: "#ccc", marginTop: 60 }}
                >
                  <div style={{ fontSize: 48 }}>🍦</div>
                  <div style={{ marginTop: 12, fontSize: 14 }}>
                    Add flavors to cart
                  </div>
                </div>
              )}
              {cart.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid #fef3f7",
                    animation: "slideIn 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{item.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: "#1f2937",
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#ec4899" }}>
                      {fmt(item.price)} × {item.qty} ={" "}
                      {fmt(item.price * item.qty)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <button
                      onClick={() => updateQty(item.name, -1)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "1px solid #e5e7eb",
                        background: "white",
                        cursor: "pointer",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontSize: 13,
                        minWidth: 20,
                        textAlign: "center",
                      }}
                    >
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.name, 1)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "none",
                        background: "#ec4899",
                        color: "white",
                        cursor: "pointer",
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.name)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ccc",
                      cursor: "pointer",
                      fontSize: 16,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout */}
            <div style={{ padding: 16, borderTop: "1px solid #fce7f3" }}>
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    marginBottom: 8,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Payment Method
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {[
                    ["cash", "💵 Cash"],
                    ["upi", "📱 UPI"],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setPayMode(mode)}
                      style={{
                        padding: "12px",
                        borderRadius: 10,
                        border: `2px solid ${payMode === mode ? "#ec4899" : "#e5e7eb"}`,
                        background: payMode === mode ? "#fef3f7" : "white",
                        cursor: "pointer",
                        color: payMode === mode ? "#be185d" : "#666",
                        fontWeight: payMode === mode ? "bold" : "normal",
                        fontFamily: "Georgia, serif",
                        fontSize: 14,
                        transition: "all 0.2s",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  padding: "12px 0",
                  borderTop: "1px solid #fce7f3",
                }}
              >
                <span style={{ fontWeight: "bold", color: "#1f2937" }}>
                  Total
                </span>
                <span
                  style={{ fontSize: 20, fontWeight: "bold", color: "#ec4899" }}
                >
                  {fmt(cartTotal)}
                </span>
              </div>

              <button
                onClick={checkout}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #ec4899, #f97316)",
                  border: "none",
                  color: "white",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 16,
                  fontFamily: "Georgia, serif",
                  fontWeight: "bold",
                  boxShadow: "0 4px 16px rgba(236,72,153,0.4)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.transform = "translateY(-2px)")
                }
                onMouseLeave={(e) =>
                  (e.target.style.transform = "translateY(0)")
                }
              >
                ✓ Confirm Sale
              </button>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "10px",
                    background: "transparent",
                    border: "1px solid #e5e7eb",
                    color: "#9ca3af",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "Georgia, serif",
                    fontSize: 13,
                  }}
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  // ════════════════════════════════════════════════════════
  // DASHBOARD SCREEN
  // ════════════════════════════════════════════════════════
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0c29",
        fontFamily: "'Georgia', serif",
        color: "white",
      }}
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .stat-card { 
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 24px; animation: fadeUp 0.5s ease;
          backdrop-filter: blur(10px);
        }
        .stat-card:hover { background: rgba(255,255,255,0.1); transform: translateY(-4px); transition: all 0.3s; }
        .tab-btn { padding: 10px 24px; border-radius: 30px; border: none; cursor: pointer; font-family: Georgia, serif; font-size: 14px; transition: all 0.2s; }
        .bar { border-radius: 8px 8px 0 0; transition: all 0.3s; position: relative; }
        .bar:hover { filter: brightness(1.2); }
        .sale-row { padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sale-row:hover { background: rgba(255,255,255,0.03); }
      `}</style>

      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setScreen("intro")}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 24 }}>📊</span>
          <span style={{ fontSize: 18, fontWeight: "bold" }}>
            Sales Dashboard
          </span>
        </div>
        <button
          onClick={() => setScreen("pos")}
          style={{
            background: "linear-gradient(135deg, #ec4899, #f97316)",
            border: "none",
            color: "white",
            padding: "10px 20px",
            borderRadius: 30,
            cursor: "pointer",
            fontFamily: "Georgia, serif",
            fontSize: 14,
          }}
        >
          🛒 New Sale
        </button>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* Loading state */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              padding: 40,
            }}
          >
            Loading sales data...
          </div>
        )}

        {/* Period Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[
            ["today", "📅 Today"],
            ["month", "📆 This Month"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDashTab(val)}
              className="tab-btn"
              style={{
                background:
                  dashTab === val
                    ? "linear-gradient(135deg, #ec4899, #f97316)"
                    : "rgba(255,255,255,0.08)",
                color: "white",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {[
            ["💰", "Total Revenue", fmt(ana.totalRevenue), "#fbbf24"],
            ["🧾", "Transactions", ana.txnCount, "#34d399"],
            ["🍦", "Scoops Sold", ana.totalScoops, "#818cf8"],
            ["📱", "UPI Revenue", fmt(ana.upiRev), "#22d3ee"],
            ["💵", "Cash Revenue", fmt(ana.cashRev), "#fb923c"],
          ].map(([icon, label, value, color]) => (
            <div key={label} className="stat-card">
              <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 26, fontWeight: "bold", color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* UPI vs Cash Visual */}
          <div className="stat-card">
            <div
              style={{
                fontSize: 15,
                fontWeight: "bold",
                marginBottom: 20,
                color: "#fbbf24",
              }}
            >
              💳 UPI vs Cash Split
            </div>
            {ana.totalRevenue > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  height: 140,
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {[
                  {
                    label: "UPI",
                    val: ana.upiRev,
                    color: "linear-gradient(180deg, #22d3ee, #0891b2)",
                    total: ana.totalRevenue,
                  },
                  {
                    label: "Cash",
                    val: ana.cashRev,
                    color: "linear-gradient(180deg, #fb923c, #ea580c)",
                    total: ana.totalRevenue,
                  },
                ].map((b) => (
                  <div
                    key={b.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                    >
                      {fmt(b.val)}
                    </span>
                    <div
                      className="bar"
                      style={{
                        width: "80%",
                        height: `${b.total ? (b.val / b.total) * 120 : 4}px`,
                        background: b.color,
                        minHeight: 4,
                      }}
                    />
                    <span style={{ fontSize: 13, color: "white" }}>
                      {b.label}
                    </span>
                    <span
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                    >
                      {b.total ? Math.round((b.val / b.total) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 40,
                  fontSize: 14,
                }}
              >
                No sales yet
              </div>
            )}
          </div>

          {/* Top Flavors */}
          <div className="stat-card">
            <div
              style={{
                fontSize: 15,
                fontWeight: "bold",
                marginBottom: 16,
                color: "#fbbf24",
              }}
            >
              🏆 Top Flavors
            </div>
            {ana.topFlavors.length === 0 && (
              <div
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 40,
                }}
              >
                No sales yet
              </div>
            )}
            {ana.topFlavors.map(([name, qty], i) => {
              const max = ana.topFlavors[0]?.[1] || 1;
              const flavor = FLAVORS.find((f) => f.name === name);
              return (
                <div key={name} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {flavor?.emoji} {name}
                    </span>
                    <span style={{ color: "#fbbf24" }}>{qty} scoops</span>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 4,
                      height: 6,
                    }}
                  >
                    <div
                      style={{
                        height: 6,
                        borderRadius: 4,
                        background: `hsl(${(i * 60 + 180) % 360}, 70%, 60%)`,
                        width: `${(qty / max) * 100}%`,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="stat-card">
          <div
            style={{
              fontSize: 15,
              fontWeight: "bold",
              marginBottom: 16,
              color: "#fbbf24",
            }}
          >
            🧾 Recent Transactions ({ana.filtered.length})
          </div>
          {ana.filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                padding: 40,
                fontSize: 14,
              }}
            >
              No transactions yet for this period
            </div>
          )}
          {ana.filtered.slice(0, 10).map((sale) => (
            <div
              key={sale.id}
              className="sale-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  {sale.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {sale.date} at {sale.time}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 16, fontWeight: "bold", color: "#fbbf24" }}
                >
                  {fmt(sale.total)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    padding: "2px 10px",
                    borderRadius: 20,
                    marginTop: 4,
                    display: "inline-block",
                    background:
                      sale.pay_mode === "upi"
                        ? "rgba(34,211,238,0.2)"
                        : "rgba(251,146,60,0.2)",
                    color: sale.pay_mode === "upi" ? "#22d3ee" : "#fb923c",
                  }}
                >
                  {sale.pay_mode?.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
