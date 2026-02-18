import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ─── FLAVORS & PRICES ─────────────────────────────────────────
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
const DEFAULT_STOCK = 50;

// ─── SUPABASE FUNCTIONS ───────────────────────────────────────
const loadSales = async () => {
  const { data } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
};
const saveSale = async (entry) => {
  await supabase
    .from("sales")
    .insert([
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
const deleteSaleById = async (id) => {
  await supabase.from("sales").delete().eq("id", id);
};

// ─── HELPERS ─────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const isMobile = () => window.innerWidth < 768;

// ─── CSV DOWNLOAD ─────────────────────────────────────────────
const downloadCSV = (sales, label) => {
  const rows = [["Date", "Time", "Items", "Total", "Payment"]];
  sales.forEach((s) => {
    rows.push([
      s.date,
      s.time,
      s.items.map((i) => `${i.qty}x${i.name}`).join("|"),
      s.total,
      s.pay_mode,
    ]);
  });
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lickees-${label}.csv`;
  a.click();
};

// ─── EXCEL DOWNLOAD ───────────────────────────────────────────
const downloadExcel = (sales, label) => {
  let html = `<table><tr><th>Date</th><th>Time</th><th>Items</th><th>Total</th><th>Payment</th></tr>`;
  sales.forEach((s) => {
    html += `<tr><td>${s.date}</td><td>${s.time}</td><td>${s.items.map((i) => `${i.qty}x${i.name}`).join(", ")}</td><td>${s.total}</td><td>${s.pay_mode}</td></tr>`;
  });
  html += "</table>";
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lickees-${label}.xls`;
  a.click();
};

// ─── WHATSAPP ────────────────────────────────────────────────
const sendWhatsApp = (ana, phone) => {
  const msg = `🍨 *Lickees Daily Summary - ${today()}*\n\n💰 Total: ${fmt(ana.totalRevenue)}\n🧾 Transactions: ${ana.txnCount}\n🍦 Scoops: ${ana.totalScoops}\n📱 UPI: ${fmt(ana.upiRev)}\n💵 Cash: ${fmt(ana.cashRev)}\n🏆 Top: ${ana.topFlavors[0]?.[0] || "N/A"}\n\n_Sent from Lickees POS_`;
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
};

// ─── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("intro");
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [payMode, setPayMode] = useState("cash");
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast] = useState(null);
  const [dashTab, setDashTab] = useState("today");
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState(() => {
    try {
      const saved = localStorage.getItem("lickees_stock");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const s = {};
    FLAVORS.forEach((f) => {
      s[f.name] = DEFAULT_STOCK;
    });
    return s;
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reportMonth, setReportMonth] = useState(thisMonth());
  const [whatsappPhone, setWhatsappPhone] = useState(
    () => localStorage.getItem("lickees_phone") || "",
  );
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");

  useEffect(() => {
    loadSales().then((data) => {
      setSales(data);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("lickees_stock", JSON.stringify(stock));
  }, [stock]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addToCart = (flavor) => {
    if ((stock[flavor.name] || 0) <= 0)
      return showToast(`❌ ${flavor.name} is out of stock!`, "error");
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
  const updateQty = (name, delta) =>
    setCart((c) =>
      c.map((i) =>
        i.name === name ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
      ),
    );
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

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
    const newStock = { ...stock };
    cart.forEach((i) => {
      newStock[i.name] = Math.max(0, (newStock[i.name] || 0) - i.qty);
    });
    setStock(newStock);
    const lowItems = cart.filter(
      (i) => newStock[i.name] < 10 && newStock[i.name] > 0,
    );
    if (lowItems.length)
      showToast(
        `⚠️ Low stock: ${lowItems.map((i) => i.name).join(", ")}`,
        "error",
      );
    else
      showToast(`✅ Sale of ${fmt(cartTotal)} via ${payMode.toUpperCase()}!`);
    const refreshed = await loadSales();
    setSales(refreshed);
    setCart([]);
  };

  const deleteSale = async (id) => {
    await deleteSaleById(id);
    setSales((s) => s.filter((x) => x.id !== id));
    setDeleteConfirm(null);
    showToast("🗑️ Sale deleted!");
  };

  const analyticsFor = (filterFn) => {
    const filtered = sales.filter(filterFn);
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

  const ana = analyticsFor(
    dashTab === "today"
      ? (s) => s.date === today()
      : (s) => s.month === thisMonth(),
  );
  const reportAna = analyticsFor((s) => s.month === reportMonth);

  const last7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      const rev = sales
        .filter((s) => s.date === dateStr)
        .reduce((sum, x) => sum + x.total, 0);
      days.push({ label, dateStr, rev });
    }
    return days;
  };

  const displayFlavors = FLAVORS.filter(
    (f) =>
      (filterCat === "All" || f.category === filterCat) &&
      f.name.toLowerCase().includes(searchQ.toLowerCase()),
  );
  const lowStockItems = FLAVORS.filter((f) => (stock[f.name] || 0) < 10);
  const outOfStockItems = FLAVORS.filter((f) => (stock[f.name] || 0) <= 0);
  const mobile = isMobile();
  const seven = last7Days();
  const maxRev = Math.max(...seven.map((d) => d.rev), 1);

  const G = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif}
    @keyframes float{from{transform:translateY(0) rotate(0)}to{transform:translateY(-20px) rotate(8deg)}}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
    @keyframes toastIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{text-shadow:0 0 20px #f9a8d4,0 0 40px #ec4899}50%{text-shadow:0 0 40px #f9a8d4,0 0 80px #ec4899}}
    .fc{background:white;border-radius:14px;padding:14px;cursor:pointer;transition:all 0.2s;border:2px solid transparent;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
    .fc:hover{transform:translateY(-3px) scale(1.02);border-color:#ec4899;box-shadow:0 8px 20px rgba(236,72,153,0.2)}
    .fc.out{opacity:0.4;cursor:not-allowed}.fc.low{border-color:#f97316!important}
    .pill{padding:6px 14px;border-radius:30px;border:none;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;transition:all 0.2s}
    .pill.active{background:#ec4899;color:white}.pill.inactive{background:white;color:#666;border:1px solid #e5e7eb}
    .sc{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:20px;animation:fadeUp 0.5s ease;backdrop-filter:blur(10px)}
    .sc:hover{background:rgba(255,255,255,0.09);transform:translateY(-2px);transition:all 0.3s}
    .tb{padding:10px 20px;border-radius:30px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;transition:all 0.2s}
    .nt{padding:10px 16px;border-radius:10px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;transition:all 0.2s;display:flex;align-items:center;gap:6px}
    .nt.active{background:rgba(236,72,153,0.2);color:#ec4899}.nt.inactive{background:transparent;color:rgba(255,255,255,0.5)}
    .bp{background:linear-gradient(135deg,#ec4899,#f97316);border:none;color:white;padding:10px 20px;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;transition:all 0.2s}
    .bp:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(236,72,153,0.4)}
    .bo{background:transparent;border:1px solid rgba(255,255,255,0.2);color:white;padding:8px 16px;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;transition:all 0.2s}
    .bo:hover{background:rgba(255,255,255,0.1)}
    .sr{padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)}
    input,select{font-family:'DM Sans',sans-serif}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:2px}
  `;

  // ── TOAST ──
  const Toast = () =>
    toast ? (
      <div
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          color: "white",
          padding: "10px 22px",
          borderRadius: 30,
          zIndex: 9999,
          animation: "toastIn 0.3s ease",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          fontSize: 14,
          whiteSpace: "nowrap",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {toast.msg}
      </div>
    ) : null;

  // ══════════════════════════════════════════════════════
  // INTRO
  // ══════════════════════════════════════════════════════
  if (screen === "intro")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{G}</style>
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: `${25 + Math.random() * 50}px`,
              height: `${25 + Math.random() * 50}px`,
              borderRadius: "50%",
              background: `hsla(${Math.random() * 360},80%,70%,0.12)`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 4}s ease-in-out infinite alternate`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
        <div
          style={{
            textAlign: "center",
            zIndex: 1,
            animation: "slideUp 0.8s ease",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              marginBottom: 12,
              animation: "pulse 3s ease infinite",
            }}
          >
            🍨
          </div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 6,
              color: "#f9a8d4",
              marginBottom: 6,
              textTransform: "uppercase",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Welcome to
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: "clamp(40px,10vw,80px)",
              margin: "0 0 6px",
              background: "linear-gradient(135deg,#fbbf24,#ec4899,#8b5cf6)",
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
              fontSize: 15,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 40,
              letterSpacing: 1,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Sales Tracking System
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              className="bp"
              style={{ padding: "14px 36px", fontSize: 16, borderRadius: 50 }}
              onClick={() => setScreen("pos")}
            >
              🛒 Start Selling
            </button>
            <button
              className="bo"
              style={{ padding: "14px 28px", fontSize: 16, borderRadius: 50 }}
              onClick={() => setScreen("dashboard")}
            >
              📊 Dashboard
            </button>
          </div>
          {lowStockItems.length > 0 && (
            <div
              style={{
                marginTop: 24,
                padding: "10px 20px",
                background: "rgba(249,115,22,0.2)",
                border: "1px solid rgba(249,115,22,0.4)",
                borderRadius: 12,
                fontSize: 13,
                color: "#fb923c",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              ⚠️ Low stock on {lowStockItems.length} flavors
            </div>
          )}
        </div>
      </div>
    );

  // ══════════════════════════════════════════════════════
  // POS
  // ══════════════════════════════════════════════════════
  if (screen === "pos")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fdf2f8",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <style>{G}</style>
        <Toast />
        <div
          style={{
            background: "linear-gradient(135deg,#0f0c29,#302b63)",
            color: "white",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setScreen("intro")}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: 20,
                padding: 4,
              }}
            >
              ←
            </button>
            <span style={{ fontSize: 18 }}>🍨</span>
            <span style={{ fontSize: 16, fontWeight: "600" }}>Lickees POS</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {outOfStockItems.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: "rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                  padding: "4px 10px",
                  borderRadius: 20,
                }}
              >
                🚨 {outOfStockItems.length} out
              </span>
            )}
            <button
              className="bo"
              style={{ fontSize: 13, padding: "6px 14px" }}
              onClick={() => setScreen("dashboard")}
            >
              📊
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: mobile ? "column" : "row",
            height: mobile ? "auto" : "calc(100vh - 57px)",
            overflow: mobile ? "visible" : "hidden",
          }}
        >
          {/* Flavor Grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                placeholder="🔍 Search..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 30,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  width: 150,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))",
                gap: 10,
              }}
            >
              {displayFlavors.map((f) => {
                const qty = stock[f.name] || 0;
                const isOut = qty <= 0;
                const isLow = qty > 0 && qty < 10;
                return (
                  <div
                    key={f.name}
                    className={`fc${isOut ? " out" : ""}${isLow ? " low" : ""}`}
                    onClick={() => !isOut && addToCart(f)}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>
                      {f.emoji}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#1f2937",
                        lineHeight: 1.3,
                        marginBottom: 4,
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
                          fontWeight: "700",
                          fontSize: 14,
                        }}
                      >
                        {fmt(f.price)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 8,
                          background: isOut
                            ? "#fee2e2"
                            : isLow
                              ? "#fff7ed"
                              : "#fdf2f8",
                          color: isOut
                            ? "#ef4444"
                            : isLow
                              ? "#f97316"
                              : "#be185d",
                        }}
                      >
                        {isOut ? "Out" : isLow ? `⚠️${qty}` : qty}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart */}
          <div
            style={{
              width: mobile ? "100%" : "310px",
              background: "white",
              borderLeft: mobile ? "none" : "1px solid #fce7f3",
              borderTop: mobile ? "1px solid #fce7f3" : "none",
              display: "flex",
              flexDirection: "column",
              maxHeight: mobile ? "65vh" : "auto",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #fce7f3",
                background: "#fdf2f8",
              }}
            >
              <div
                style={{ fontSize: 15, fontWeight: "700", color: "#831843" }}
              >
                🛒 Cart ({cart.length})
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {cart.length === 0 && (
                <div
                  style={{ textAlign: "center", color: "#ccc", marginTop: 40 }}
                >
                  <div style={{ fontSize: 40 }}>🍦</div>
                  <div style={{ fontSize: 13, marginTop: 8 }}>Add flavors</div>
                </div>
              )}
              {cart.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid #fdf2f8",
                    animation: "slideIn 0.3s ease",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#1f2937",
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#ec4899" }}>
                      {fmt(item.price)}×{item.qty}={fmt(item.price * item.qty)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <button
                      onClick={() => updateQty(item.name, -1)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "1px solid #e5e7eb",
                        background: "white",
                        cursor: "pointer",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontSize: 12,
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.name, 1)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "none",
                        background: "#ec4899",
                        color: "white",
                        cursor: "pointer",
                        fontSize: 13,
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
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: 14, borderTop: "1px solid #fce7f3" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 10,
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
                      padding: "10px",
                      borderRadius: 10,
                      border: `2px solid ${payMode === mode ? "#ec4899" : "#e5e7eb"}`,
                      background: payMode === mode ? "#fdf2f8" : "white",
                      cursor: "pointer",
                      color: payMode === mode ? "#be185d" : "#666",
                      fontWeight: payMode === mode ? "700" : "400",
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #fce7f3",
                }}
              >
                <span style={{ fontWeight: "700", color: "#1f2937" }}>
                  Total
                </span>
                <span
                  style={{ fontSize: 18, fontWeight: "700", color: "#ec4899" }}
                >
                  {fmt(cartTotal)}
                </span>
              </div>
              <button
                className="bp"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: 15,
                  borderRadius: 12,
                }}
                onClick={checkout}
              >
                ✓ Confirm Sale
              </button>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "8px",
                    background: "transparent",
                    border: "1px solid #e5e7eb",
                    color: "#9ca3af",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  // ══════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0c29",
        fontFamily: "'DM Sans',sans-serif",
        color: "white",
      }}
    >
      <style>{G}</style>
      <Toast />

      {/* Delete Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#1e1b4b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 300,
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
              Delete this sale?
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 20,
              }}
            >
              This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSale(deleteConfirm)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#ef4444",
                  border: "none",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: "700",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showPhoneInput && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#1e1b4b",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 320,
              width: "100%",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: "700", marginBottom: 12 }}>
              📱 WhatsApp Number
            </div>
            <input
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="91XXXXXXXXXX"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 14,
                outline: "none",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowPhoneInput(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("lickees_phone", whatsappPhone);
                  setShowPhoneInput(false);
                  sendWhatsApp(ana, whatsappPhone);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#25d366",
                  border: "none",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: "700",
                }}
              >
                Send ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <span
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            🍨 Lickees
          </span>
        </div>
        <button
          className="bp"
          style={{ padding: "8px 18px", fontSize: 13 }}
          onClick={() => setScreen("pos")}
        >
          🛒 New Sale
        </button>
      </div>

      {/* Nav */}
      <div
        style={{
          padding: "10px 20px",
          display: "flex",
          gap: 6,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          overflowX: "auto",
        }}
      >
        {[
          ["sales", "📊 Sales"],
          ["stock", "📦 Stock"],
          ["reports", "📋 Reports"],
        ].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`nt ${activeTab === tab ? "active" : "inactive"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 20px", maxWidth: 1200, margin: "0 auto" }}>
        {/* ══ SALES TAB ══ */}
        {activeTab === "sales" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  ["today", "📅 Today"],
                  ["month", "📆 Month"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDashTab(val)}
                    className="tb"
                    style={{
                      background:
                        dashTab === val
                          ? "linear-gradient(135deg,#ec4899,#f97316)"
                          : "rgba(255,255,255,0.08)",
                      color: "white",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  whatsappPhone
                    ? sendWhatsApp(ana, whatsappPhone)
                    : setShowPhoneInput(true)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "#25d366",
                  border: "none",
                  color: "white",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                📱 WhatsApp
              </button>
            </div>

            {/* KPI */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                ["💰", "Revenue", fmt(ana.totalRevenue), "#fbbf24"],
                ["🧾", "Sales", ana.txnCount, "#34d399"],
                ["🍦", "Scoops", ana.totalScoops, "#818cf8"],
                ["📱", "UPI", fmt(ana.upiRev), "#22d3ee"],
                ["💵", "Cash", fmt(ana.cashRev), "#fb923c"],
              ].map(([icon, label, value, color]) => (
                <div key={label} className="sc">
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: "700", color }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* 7 Day Chart */}
            <div className="sc" style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  marginBottom: 16,
                  color: "#fbbf24",
                }}
              >
                📈 Last 7 Days
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  height: 110,
                  alignItems: "flex-end",
                }}
              >
                {seven.map((d) => (
                  <div
                    key={d.dateStr}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}
                    >
                      {d.rev > 0 ? fmt(d.rev).replace("₹", "") : ""}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        background:
                          d.dateStr === today()
                            ? "linear-gradient(180deg,#ec4899,#f97316)"
                            : "rgba(255,255,255,0.15)",
                        borderRadius: "5px 5px 0 0",
                        height: `${Math.max((d.rev / maxRev) * 85, d.rev > 0 ? 6 : 2)}px`,
                        minHeight: 2,
                        transition: "all 0.5s",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          d.dateStr === today()
                            ? "#ec4899"
                            : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {d.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div className="sc">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    marginBottom: 16,
                    color: "#fbbf24",
                  }}
                >
                  💳 UPI vs Cash
                </div>
                {ana.totalRevenue > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      height: 110,
                      alignItems: "flex-end",
                      justifyContent: "center",
                    }}
                  >
                    {[
                      {
                        label: "UPI",
                        val: ana.upiRev,
                        c: "linear-gradient(180deg,#22d3ee,#0891b2)",
                      },
                      {
                        label: "Cash",
                        val: ana.cashRev,
                        c: "linear-gradient(180deg,#fb923c,#ea580c)",
                      },
                    ].map((b) => (
                      <div
                        key={b.label}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          {fmt(b.val)}
                        </span>
                        <div
                          style={{
                            width: "70%",
                            background: b.c,
                            borderRadius: "5px 5px 0 0",
                            height: `${ana.totalRevenue ? (b.val / ana.totalRevenue) * 90 : 2}px`,
                            minHeight: 2,
                          }}
                        />
                        <span style={{ fontSize: 12, color: "white" }}>
                          {b.label}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {ana.totalRevenue
                            ? Math.round((b.val / ana.totalRevenue) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.3)",
                      padding: 30,
                    }}
                  >
                    No sales yet
                  </div>
                )}
              </div>
              <div className="sc">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    marginBottom: 14,
                    color: "#fbbf24",
                  }}
                >
                  🏆 Top Flavors
                </div>
                {ana.topFlavors.length === 0 && (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 13,
                      textAlign: "center",
                      padding: 20,
                    }}
                  >
                    No sales yet
                  </div>
                )}
                {ana.topFlavors.map(([name, qty], i) => {
                  const max = ana.topFlavors[0]?.[1] || 1;
                  const fl = FLAVORS.find((f) => f.name === name);
                  return (
                    <div key={name} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 3,
                        }}
                      >
                        <span>
                          {fl?.emoji} {name}
                        </span>
                        <span style={{ color: "#fbbf24" }}>{qty}</span>
                      </div>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          borderRadius: 4,
                          height: 5,
                        }}
                      >
                        <div
                          style={{
                            height: 5,
                            borderRadius: 4,
                            background: `hsl(${(i * 60 + 180) % 360},70%,60%)`,
                            width: `${(qty / max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transactions with Delete */}
            <div className="sc">
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  marginBottom: 14,
                  color: "#fbbf24",
                }}
              >
                🧾 Transactions ({ana.filtered.length})
              </div>
              {ana.filtered.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.3)",
                    padding: 30,
                  }}
                >
                  No transactions yet
                </div>
              )}
              {ana.filtered.slice(0, 20).map((sale) => (
                <div
                  key={sale.id}
                  className="sr"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, marginRight: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 2 }}>
                      {sale.items.map((i) => `${i.qty}×${i.name}`).join(", ")}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                    >
                      {sale.date} at {sale.time}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#fbbf24",
                        }}
                      >
                        {fmt(sale.total)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 20,
                          display: "inline-block",
                          background:
                            sale.pay_mode === "upi"
                              ? "rgba(34,211,238,0.2)"
                              : "rgba(251,146,60,0.2)",
                          color:
                            sale.pay_mode === "upi" ? "#22d3ee" : "#fb923c",
                        }}
                      >
                        {sale.pay_mode?.toUpperCase()}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(sale.id)}
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#fca5a5",
                        borderRadius: 8,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ STOCK TAB ══ */}
        {activeTab === "stock" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[
                ["📦", "Total", FLAVORS.length, "#fbbf24"],
                ["⚠️", "Low", lowStockItems.length, "#fb923c"],
                ["🚨", "Out", outOfStockItems.length, "#ef4444"],
                [
                  "✅",
                  "OK",
                  FLAVORS.filter((f) => (stock[f.name] || 0) > 10).length,
                  "#34d399",
                ],
              ].map(([icon, label, val, color]) => (
                <div key={label} className="sc" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      color,
                      marginTop: 6,
                    }}
                  >
                    {val}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      marginTop: 2,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
            {lowStockItems.length > 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(249,115,22,0.15)",
                  border: "1px solid rgba(249,115,22,0.3)",
                  borderRadius: 12,
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#fb923c",
                }}
              >
                ⚠️ Low:{" "}
                {lowStockItems
                  .map((f) => `${f.emoji}${f.name}(${stock[f.name]})`)
                  .join(", ")}
              </div>
            )}
            <div className="sc">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{ fontSize: 14, fontWeight: "700", color: "#fbbf24" }}
                >
                  📦 Manage Stock
                </div>
                <button
                  className="bp"
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => {
                    const s = {};
                    FLAVORS.forEach((f) => {
                      s[f.name] = DEFAULT_STOCK;
                    });
                    setStock(s);
                    showToast("Stock reset to 50!");
                  }}
                >
                  Reset All
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
                  gap: 10,
                }}
              >
                {FLAVORS.map((f) => {
                  const qty = stock[f.name] || 0;
                  const isOut = qty <= 0;
                  const isLow = qty > 0 && qty < 10;
                  return (
                    <div
                      key={f.name}
                      style={{
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 12,
                        border: `1px solid ${isOut ? "rgba(239,68,68,0.4)" : isLow ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>
                          {f.emoji} {f.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: isOut
                              ? "#ef4444"
                              : isLow
                                ? "#fb923c"
                                : "#34d399",
                          }}
                        >
                          {qty}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            setStock((s) => ({
                              ...s,
                              [f.name]: Math.max(0, (s[f.name] || 0) - 1),
                            }))
                          }
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "white",
                            cursor: "pointer",
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) =>
                            setStock((s) => ({
                              ...s,
                              [f.name]: Math.max(
                                0,
                                parseInt(e.target.value) || 0,
                              ),
                            }))
                          }
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.05)",
                            color: "white",
                            fontSize: 13,
                            textAlign: "center",
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={() =>
                            setStock((s) => ({
                              ...s,
                              [f.name]: (s[f.name] || 0) + 1,
                            }))
                          }
                          style={{
                            width: 26,
                            height: 26,
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
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══ REPORTS TAB ══ */}
        {activeTab === "reports" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 20,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 6,
                    letterSpacing: 1,
                  }}
                >
                  SELECT MONTH
                </div>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
              <button
                className="bp"
                style={{ fontSize: 13 }}
                onClick={() => downloadCSV(reportAna.filtered, reportMonth)}
              >
                ⬇️ Download CSV
              </button>
              <button
                className="bp"
                style={{
                  fontSize: 13,
                  background: "linear-gradient(135deg,#059669,#10b981)",
                }}
                onClick={() => downloadExcel(reportAna.filtered, reportMonth)}
              >
                ⬇️ Download Excel
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                ["💰", "Revenue", fmt(reportAna.totalRevenue), "#fbbf24"],
                ["🧾", "Sales", reportAna.txnCount, "#34d399"],
                ["🍦", "Scoops", reportAna.totalScoops, "#818cf8"],
                ["📱", "UPI", fmt(reportAna.upiRev), "#22d3ee"],
                ["💵", "Cash", fmt(reportAna.cashRev), "#fb923c"],
                [
                  "📊",
                  "Avg/Day",
                  fmt(Math.round(reportAna.totalRevenue / 30)),
                  "#f472b6",
                ],
              ].map(([icon, label, val, color]) => (
                <div key={label} className="sc">
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: "700", color }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
            <div className="sc" style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  marginBottom: 14,
                  color: "#fbbf24",
                }}
              >
                🏆 Top Flavors — {reportMonth}
              </div>
              {reportAna.topFlavors.length === 0 && (
                <div
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 13,
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  No sales for this month
                </div>
              )}
              {reportAna.topFlavors.map(([name, qty], i) => {
                const max = reportAna.topFlavors[0]?.[1] || 1;
                const fl = FLAVORS.find((f) => f.name === name);
                return (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <span>
                        {fl?.emoji} {name}
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
                          background: `hsl(${(i * 60 + 180) % 360},70%,60%)`,
                          width: `${(qty / max) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sc">
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  marginBottom: 14,
                  color: "#fbbf24",
                }}
              >
                🧾 All Transactions — {reportMonth} ({reportAna.filtered.length}
                )
              </div>
              {reportAna.filtered.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.3)",
                    padding: 30,
                  }}
                >
                  No transactions for this month
                </div>
              )}
              {reportAna.filtered.map((sale) => (
                <div
                  key={sale.id}
                  className="sr"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, marginRight: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 2 }}>
                      {sale.items.map((i) => `${i.qty}×${i.name}`).join(", ")}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}
                    >
                      {sale.date} at {sale.time}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#fbbf24",
                        }}
                      >
                        {fmt(sale.total)}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 20,
                          display: "inline-block",
                          background:
                            sale.pay_mode === "upi"
                              ? "rgba(34,211,238,0.2)"
                              : "rgba(251,146,60,0.2)",
                          color:
                            sale.pay_mode === "upi" ? "#22d3ee" : "#fb923c",
                        }}
                      >
                        {sale.pay_mode?.toUpperCase()}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(sale.id)}
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#fca5a5",
                        borderRadius: 8,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
