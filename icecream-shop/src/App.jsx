import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const FALLBACK_FLAVORS = [
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
  { name: "Gulab Jamun", price: 30, emoji: "🔴", category: "Special" },
  { name: "Rose Milk", price: 20, emoji: "🌹", category: "Special" },
  { name: "Red Velvet", price: 30, emoji: "🎂", category: "Special" },
  { name: "Chocolate", price: 20, emoji: "🍫", category: "Classic" },
  { name: "Coffee", price: 20, emoji: "☕", category: "Classic" },
  { name: "Malai", price: 30, emoji: "🥛", category: "Classic" },
  { name: "Oreo", price: 30, emoji: "⚫", category: "Classic" },
  { name: "Butter Scotch", price: 25, emoji: "🟡", category: "Classic" },
  { name: "Paan", price: 20, emoji: "🌿", category: "Classic" },
  { name: "Bubble Gum", price: 20, emoji: "🫧", category: "Classic" },
];

const CATEGORIES = ["All", "Fruit", "Classic", "Premium", "Special"];
const DEFAULT_STOCK = 40;

const USERS = {
  admin: { password: "admin123", role: "admin", name: "Admin" },
  cashier: { password: "cash123", role: "cashier", name: "Cashier" },
};

// ─── Sales helpers ─────────────────────────────────────────────────────────────
const loadSales = async () => {
  const { data } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
};
const saveSale = async (entry) => {
  const { error } = await supabase.from("sales").insert([
    {
      date: entry.date,
      month: entry.month,
      time: entry.time,
      items: entry.items,
      total: entry.total,
      pay_mode: entry.payMode,
    },
  ]);
  return error;
};
const deleteSaleById = async (id) => {
  await supabase.from("sales").delete().eq("id", id);
};

// ─── Flavor helpers ────────────────────────────────────────────────────────────
const loadFlavors = async () => {
  const { data, error } = await supabase
    .from("flavors")
    .select("*")
    .eq("active", true)
    .order("category")
    .order("name");
  if (error || !data || data.length === 0) return FALLBACK_FLAVORS;
  return data;
};

// ─── Stock helpers (Supabase) ──────────────────────────────────────────────────
// Reads today's current_stock for all flavors
const loadStockFromDB = async () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("stock")
    .select("*")
    .eq("date", todayStr);
  if (error || !data) return {};
  const s = {};
  data.forEach((row) => {
    s[row.flavor_name] = row.current_stock;
  });
  return s;
};

// Updates current_stock for a single flavor (called on every sale / manual adjust)
const saveStockItem = async (flavorName, currentStock) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  // Try to update first; if no row exists, insert
  const { data: existing } = await supabase
    .from("stock")
    .select("id")
    .eq("flavor_name", flavorName)
    .eq("date", todayStr);
  if (existing && existing.length > 0) {
    await supabase
      .from("stock")
      .update({
        current_stock: currentStock,
        updated_at: new Date().toISOString(),
      })
      .eq("flavor_name", flavorName)
      .eq("date", todayStr);
  } else {
    await supabase.from("stock").insert([
      {
        flavor_name: flavorName,
        opening_stock: DEFAULT_STOCK,
        current_stock: currentStock,
        date: todayStr,
        updated_at: new Date().toISOString(),
      },
    ]);
  }
};

// Ensures every flavor has a stock row for today (does NOT overwrite existing rows)
const seedMissingStock = async (flavors) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("stock")
    .select("flavor_name")
    .eq("date", todayStr);
  const existingNames = new Set((existing || []).map((r) => r.flavor_name));
  const missing = flavors.filter((f) => !existingNames.has(f.name));
  if (missing.length === 0) return;
  await supabase.from("stock").insert(
    missing.map((f) => ({
      flavor_name: f.name,
      opening_stock: DEFAULT_STOCK,
      current_stock: DEFAULT_STOCK,
      date: todayStr,
      updated_at: new Date().toISOString(),
    })),
  );
};

// Reset all stock to a given value for today
const resetAllStock = async (flavors, value) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const f of flavors) {
    const { data: existing } = await supabase
      .from("stock")
      .select("id")
      .eq("flavor_name", f.name)
      .eq("date", todayStr);
    if (existing && existing.length > 0) {
      await supabase
        .from("stock")
        .update({
          opening_stock: value,
          current_stock: value,
          updated_at: new Date().toISOString(),
        })
        .eq("flavor_name", f.name)
        .eq("date", todayStr);
    } else {
      await supabase.from("stock").insert([
        {
          flavor_name: f.name,
          opening_stock: value,
          current_stock: value,
          date: todayStr,
          updated_at: new Date().toISOString(),
        },
      ]);
    }
  }
};

// ─── Utilities ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const isMobile = () => window.innerWidth < 768;
const payColor = (mode) => {
  if (mode === "upi") return { bg: "rgba(34,211,238,0.2)", text: "#22d3ee" };
  if (mode === "card") return { bg: "rgba(139,92,246,0.2)", text: "#a78bfa" };
  return { bg: "rgba(251,146,60,0.2)", text: "#fb923c" };
};

const downloadCSV = (sales, label) => {
  const rows = [["Date", "Time", "Items", "Total", "Payment"]];
  sales.forEach((s) =>
    rows.push([
      s.date,
      s.time,
      (s.items || []).map((i) => `${i.qty}x${i.name}`).join("|"),
      s.total,
      s.pay_mode,
    ]),
  );
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lickees-${label}.csv`;
  a.click();
};

const sendWhatsApp = (ana, phone) => {
  const msg = `🍨 *Lickees Daily Summary - ${today()}*\n\n💰 Total: ${fmt(ana.totalRevenue)}\n🧾 Transactions: ${ana.txnCount}\n🍦 Scoops: ${ana.totalScoops}\n📱 UPI: ${fmt(ana.upiRev)}\n💵 Cash: ${fmt(ana.cashRev)}\n💳 Card: ${fmt(ana.cardRev)}\n🏆 Top: ${ana.topFlavors[0]?.[0] || "N/A"}\n\n_Sent from Lickees POS_`;
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    "_blank",
  );
};

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
  .cal-day{border-radius:8px;cursor:pointer;padding:6px 4px;text-align:center;transition:all 0.2s;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px}
  .cal-day:hover{background:rgba(236,72,153,0.15)}
  .cal-day.has-sales{background:rgba(236,72,153,0.12);border:1px solid rgba(236,72,153,0.3)}
  .cal-day.selected{background:rgba(236,72,153,0.35)!important;border:1px solid #ec4899!important}
  .cal-day.today-cell{border:1px solid rgba(251,191,36,0.5)}
  .fi{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;color:white;font-size:14px;outline:none;width:100%;font-family:'DM Sans',sans-serif}
  .fi:focus{border-color:#ec4899}
  input,select{font-family:'DM Sans',sans-serif}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.2);border-radius:2px}
`;

export default function App() {
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [sales, setSales] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [flavorsLoading, setFlavorsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [payMode, setPayMode] = useState("cash");
  const [filterCat, setFilterCat] = useState("All");
  const [toast, setToast] = useState(null);
  const [dashTab, setDashTab] = useState("today");
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);
  // ✅ stock starts empty — always loaded fresh from Supabase
  const [stock, setStock] = useState({});
  const [stockLoading, setStockLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [reportMonth, setReportMonth] = useState(thisMonth());
  const [whatsappPhone, setWhatsappPhone] = useState(
    () => localStorage.getItem("lickees_phone") || "",
  );
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");
  const [calDate, setCalDate] = useState(null);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    const saved = localStorage.getItem("lickees_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
        setScreen("intro");
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (screen === "intro" || screen === "pos" || screen === "dashboard") {
      // Load sales
      loadSales().then((data) => {
        setSales(data);
        setLoading(false);
      });

      // Load flavors → seed missing stock rows → load stock
      loadFlavors().then(async (data) => {
        setFlavors(data);
        setFlavorsLoading(false);
        await seedMissingStock(data);
        const stockData = await loadStockFromDB();
        setStock(stockData);
        setStockLoading(false);
      });

      // ✅ Real-time: sales
      const salesChannel = supabase
        .channel("sales-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sales" },
          async () => {
            const r = await loadSales();
            setSales(r);
          },
        )
        .subscribe();

      // ✅ Real-time: stock — syncs across ALL devices instantly
      const stockChannel = supabase
        .channel("stock-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "stock" },
          async () => {
            const s = await loadStockFromDB();
            setStock(s);
          },
        )
        .subscribe();

      // ✅ Real-time: flavors
      const flavorsChannel = supabase
        .channel("flavors-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "flavors" },
          async () => {
            const data = await loadFlavors();
            setFlavors(data);
            await seedMissingStock(data);
            const s = await loadStockFromDB();
            setStock(s);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(salesChannel);
        supabase.removeChannel(stockChannel);
        supabase.removeChannel(flavorsChannel);
      };
    }
  }, [screen]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = () => {
    const u = USERS[loginUser];
    if (u && u.password === loginPass) {
      const user = { username: loginUser, role: u.role, name: u.name };
      setCurrentUser(user);
      localStorage.setItem("lickees_user", JSON.stringify(user));
      setLoginError("");
      setLoginPass("");
      setScreen("intro");
    } else {
      setLoginError("Invalid credentials. Try again.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("lickees_user");
    setScreen("login");
  };

  const isAdmin = currentUser?.role === "admin";

  const addToCart = (flavor) => {
    if ((stock[flavor.name] ?? DEFAULT_STOCK) <= 0)
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

  // ✅ Checkout: save sale + reduce current_stock in Supabase
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
    const error = await saveSale(entry);
    if (error) return showToast("❌ Failed to save sale!", "error");

    // Reduce stock in Supabase for each sold item
    const newStock = { ...stock };
    for (const i of cart) {
      newStock[i.name] = Math.max(
        0,
        (newStock[i.name] ?? DEFAULT_STOCK) - i.qty,
      );
      await saveStockItem(i.name, newStock[i.name]);
    }
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
    const totalRevenue = filtered.reduce((s, x) => s + (x.total || 0), 0);
    const upiRev = filtered
      .filter((s) => s.pay_mode === "upi")
      .reduce((s, x) => s + (x.total || 0), 0);
    const cashRev = filtered
      .filter((s) => s.pay_mode === "cash")
      .reduce((s, x) => s + (x.total || 0), 0);
    const cardRev = filtered
      .filter((s) => s.pay_mode === "card")
      .reduce((s, x) => s + (x.total || 0), 0);
    const totalScoops = filtered.reduce(
      (s, x) => s + (x.items || []).reduce((a, i) => a + i.qty, 0),
      0,
    );
    const txnCount = filtered.length;
    const flavorMap = {};
    filtered.forEach((s) =>
      (s.items || []).forEach((i) => {
        flavorMap[i.name] = (flavorMap[i.name] || 0) + i.qty;
      }),
    );
    const topFlavors = Object.entries(flavorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const highestTxn = filtered.reduce(
      (max, x) => (x.total > max ? x.total : max),
      0,
    );
    const upiCount = filtered.filter((s) => s.pay_mode === "upi").length;
    const cashCount = filtered.filter((s) => s.pay_mode === "cash").length;
    const cardCount = filtered.filter((s) => s.pay_mode === "card").length;
    return {
      totalRevenue,
      upiRev,
      cashRev,
      cardRev,
      totalScoops,
      txnCount,
      topFlavors,
      filtered,
      highestTxn,
      upiCount,
      cashCount,
      cardCount,
    };
  };

  const ana = analyticsFor(
    dashTab === "today"
      ? (s) => s.date === today()
      : (s) => s.month === thisMonth(),
  );
  const reportAna = analyticsFor((s) => s.month === reportMonth);
  const calAna = calDate ? analyticsFor((s) => s.date === calDate) : null;

  const last7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      const rev = sales
        .filter((s) => s.date === dateStr)
        .reduce((sum, x) => sum + (x.total || 0), 0);
      days.push({ label, dateStr, rev });
    }
    return days;
  };

  const getCalendarDays = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const salesByDate = {};
    sales.forEach((s) => {
      if (s.date && s.date.startsWith(ym))
        salesByDate[s.date] = (salesByDate[s.date] || 0) + (s.total || 0);
    });
    return { firstDay, daysInMonth, salesByDate, year: y, month: m };
  };

  const displayFlavors = flavors
    .filter(
      (f) =>
        (filterCat === "All" || f.category === filterCat) &&
        f.name.toLowerCase().includes(searchQ.toLowerCase()),
    )
    .sort((a, b) => a.price - b.price);

  const lowStockItems = flavors.filter((f) => {
    const q = stock[f.name] ?? DEFAULT_STOCK;
    return q > 0 && q < 10;
  });
  const outOfStockItems = flavors.filter(
    (f) => (stock[f.name] ?? DEFAULT_STOCK) <= 0,
  );
  const alertItems = [
    ...outOfStockItems.map((f) => ({ ...f, alertType: "out" })),
    ...lowStockItems.map((f) => ({ ...f, alertType: "low" })),
  ];

  const mobile = isMobile();
  const seven = last7Days();
  const maxRev = Math.max(...seven.map((d) => d.rev), 1);

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

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  if (screen === "login")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          padding: 20,
        }}
      >
        <style>{G}</style>
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "fixed",
              width: `${25 + Math.random() * 40}px`,
              height: `${25 + Math.random() * 40}px`,
              borderRadius: "50%",
              background: `hsla(${Math.random() * 360},80%,70%,0.08)`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 4}s ease-in-out infinite alternate`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 24,
            padding: "40px 36px",
            width: "100%",
            maxWidth: 380,
            backdropFilter: "blur(20px)",
            animation: "slideUp 0.6s ease",
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🍨</div>
            <h1
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 32,
                background: "linear-gradient(135deg,#fbbf24,#ec4899,#8b5cf6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Lickees
            </h1>
            <div
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
                marginTop: 4,
              }}
            >
              POS & Analytics
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Login as
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                ["admin", "👑 Admin"],
                ["cashier", "💁 Cashier"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLoginUser(val)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 10,
                    border: `2px solid ${loginUser === val ? "#ec4899" : "rgba(255,255,255,0.15)"}`,
                    background:
                      loginUser === val
                        ? "rgba(236,72,153,0.15)"
                        : "transparent",
                    color:
                      loginUser === val ? "#ec4899" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: "600",
                    fontFamily: "'DM Sans',sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.07)",
                color: "white",
                fontSize: 15,
                outline: "none",
              }}
            />
            {loginError && (
              <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
                {loginError}
              </div>
            )}
          </div>
          <button
            className="bp"
            style={{
              width: "100%",
              padding: 14,
              fontSize: 15,
              borderRadius: 12,
            }}
            onClick={handleLogin}
          >
            🔐 Login
          </button>
        </div>
      </div>
    );

  // ─── INTRO ─────────────────────────────────────────────────────────────────
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
            Welcome back, {currentUser?.name}
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
              marginBottom: 8,
              letterSpacing: 1,
            }}
          >
            {currentUser?.role === "admin"
              ? "👑 Admin • Full Access"
              : "💁 Cashier • Sales Only"}
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: 36,
            }}
          >
            <button
              className="bp"
              style={{ padding: "16px 40px", fontSize: 17, borderRadius: 14 }}
              onClick={() => setScreen("pos")}
            >
              🛒 New Sale
            </button>
            {isAdmin && (
              <button
                className="bo"
                style={{ padding: "16px 40px", fontSize: 17, borderRadius: 14 }}
                onClick={() => setScreen("dashboard")}
              >
                📊 Dashboard
              </button>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              marginTop: 28,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    );

  // ─── POS ───────────────────────────────────────────────────────────────────
  if (screen === "pos")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#fdf2f8",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{G}</style>
        <Toast />
        <div
          style={{
            background: "white",
            borderBottom: "1px solid #fce7f3",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setScreen("intro")}
              style={{
                background: "transparent",
                border: "none",
                color: "#9ca3af",
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
                color: "#831843",
              }}
            >
              🍨 Lickees POS
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                background: "#fdf2f8",
                borderRadius: 20,
                color: "#be185d",
                border: "1px solid #fce7f3",
              }}
            >
              {isAdmin ? "👑 Admin" : "💁 Cashier"}
            </span>
            {isAdmin && (
              <button
                className="bp"
                style={{ padding: "8px 14px", fontSize: 12 }}
                onClick={() => setScreen("dashboard")}
              >
                📊 Dashboard
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            background: "white",
            padding: "10px 16px",
            borderBottom: "1px solid #fce7f3",
            display: "flex",
            gap: 8,
            overflowX: "auto",
            flexShrink: 0,
            flexWrap: mobile ? "wrap" : "nowrap",
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`pill ${filterCat === c ? "active" : "inactive"}`}
            >
              {c}
            </button>
          ))}
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="🔍 Search flavours..."
            style={{
              marginLeft: mobile ? 0 : "auto",
              padding: mobile ? "10px 16px" : "6px 14px",
              borderRadius: 30,
              border: "1px solid #e5e7eb",
              fontSize: mobile ? 15 : 13,
              outline: "none",
              minWidth: mobile ? "100%" : 140,
              marginTop: mobile ? 4 : 0,
            }}
          />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: mobile ? "column" : "row",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {flavorsLoading || stockLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#ccc" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍦</div>
                <div>Loading flavours...</div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))",
                  gap: 10,
                }}
              >
                {displayFlavors.map((f) => {
                  const qty = stock[f.name] ?? DEFAULT_STOCK;
                  const isOut = qty <= 0;
                  const isLow = qty > 0 && qty < 10;
                  return (
                    <div
                      key={f.id || f.name}
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
            )}
          </div>
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
                        fontWeight: "700",
                        color: "#1f2937",
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#ec4899",
                        fontWeight: "700",
                      }}
                    >
                      {fmt(item.price)} × {item.qty} ={" "}
                      {fmt(item.price * item.qty)}
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
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {[
                  ["cash", "💵 Cash"],
                  ["upi", "📱 UPI"],
                  ["card", "💳 Card"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setPayMode(mode)}
                    style={{
                      padding: "9px 4px",
                      borderRadius: 10,
                      border: `2px solid ${payMode === mode ? "#ec4899" : "#e5e7eb"}`,
                      background: payMode === mode ? "#fdf2f8" : "white",
                      cursor: "pointer",
                      color: payMode === mode ? "#be185d" : "#666",
                      fontWeight: payMode === mode ? "700" : "400",
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 12,
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

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
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

      {showNotifications && (
        <div
          onClick={() => setShowNotifications(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        />
      )}

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
          <span
            style={{
              fontSize: 11,
              padding: "3px 10px",
              background: "rgba(251,191,36,0.15)",
              borderRadius: 20,
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            👑 Admin
          </span>

          {/* Notification Bell */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifications((v) => !v)}
              style={{
                background:
                  alertItems.length > 0
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(255,255,255,0.06)",
                border:
                  alertItems.length > 0
                    ? "1px solid rgba(239,68,68,0.4)"
                    : "1px solid rgba(255,255,255,0.12)",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 16,
                position: "relative",
                transition: "all 0.2s",
              }}
            >
              🔔
              {alertItems.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: "#ef4444",
                    color: "white",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 10,
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #0f0c29",
                    animation: "pulse 2s ease infinite",
                  }}
                >
                  {alertItems.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div
                style={{
                  position: "absolute",
                  top: 44,
                  left: 0,
                  width: 300,
                  background: "#1a1740",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  zIndex: 9999,
                  boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                  animation: "slideUp 0.2s ease",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: "700", fontSize: 14 }}>
                    🔔 Stock Alerts
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background:
                        alertItems.length > 0
                          ? "rgba(239,68,68,0.2)"
                          : "rgba(52,211,153,0.2)",
                      color: alertItems.length > 0 ? "#f87171" : "#34d399",
                    }}
                  >
                    {alertItems.length > 0
                      ? `${alertItems.length} alert${alertItems.length > 1 ? "s" : ""}`
                      : "All good ✓"}
                  </div>
                </div>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {alertItems.length === 0 ? (
                    <div
                      style={{
                        padding: 28,
                        textAlign: "center",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>All
                      flavours are well stocked!
                    </div>
                  ) : (
                    alertItems.map((f) => {
                      const qty = stock[f.name] ?? DEFAULT_STOCK;
                      const isOut = f.alertType === "out";
                      return (
                        <div
                          key={f.name}
                          style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 22 }}>{f.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: "600" }}>
                              {f.name}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: isOut ? "#f87171" : "#fb923c",
                                marginTop: 2,
                              }}
                            >
                              {isOut ? "Out of stock!" : `Only ${qty} left`}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 20,
                              background: isOut
                                ? "rgba(239,68,68,0.2)"
                                : "rgba(249,115,22,0.2)",
                              color: isOut ? "#f87171" : "#fb923c",
                              fontWeight: "700",
                            }}
                          >
                            {isOut ? "OUT" : "LOW"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                {alertItems.length > 0 && (
                  <div
                    style={{
                      padding: "10px 16px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        setActiveTab("stock");
                      }}
                      style={{
                        width: "100%",
                        padding: "9px",
                        background: "linear-gradient(135deg,#ec4899,#f97316)",
                        border: "none",
                        color: "white",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      📦 Go to Stock Manager
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="bp"
            style={{ padding: "8px 18px", fontSize: 13 }}
            onClick={() => setScreen("pos")}
          >
            🛒 New Sale
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              padding: "8px 14px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab Bar */}
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
          ["calendar", "📅 Calendar"],
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
        {/* ── SALES ── */}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
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
                ["💳", "Card", fmt(ana.cardRev), "#a78bfa"],
                ["🏆", "Highest", fmt(ana.highestTxn), "#f472b6"],
              ].map(([icon, label, val, color]) => (
                <div key={label} className="sc">
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 3,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: "700", color }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
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
                  💳 Payment Split
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
                        count: ana.upiCount,
                        c: "linear-gradient(180deg,#22d3ee,#0891b2)",
                      },
                      {
                        label: "Cash",
                        val: ana.cashRev,
                        count: ana.cashCount,
                        c: "linear-gradient(180deg,#fb923c,#ea580c)",
                      },
                      {
                        label: "Card",
                        val: ana.cardRev,
                        count: ana.cardCount,
                        c: "linear-gradient(180deg,#a78bfa,#7c3aed)",
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
                            fontSize: 10,
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
                            fontSize: 10,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {b.count} txn
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
                  const fl = flavors.find((f) => f.name === name);
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
            <div className="sc">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ fontSize: 14, fontWeight: "700", color: "#fbbf24" }}
                >
                  🧾 Transactions ({ana.filtered.length})
                </div>
                <button
                  onClick={() => downloadCSV(ana.filtered, dashTab)}
                  className="bo"
                  style={{ fontSize: 12 }}
                >
                  ⬇️ CSV
                </button>
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
              {ana.filtered.slice(0, 30).map((sale) => {
                const pc = payColor(sale.pay_mode);
                return (
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
                        {(sale.items || [])
                          .map((i) => `${i.qty}×${i.name}`)
                          .join(", ")}
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
                            background: pc.bg,
                            color: pc.text,
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
                );
              })}
            </div>
          </>
        )}

        {/* ── CALENDAR ── */}
        {activeTab === "calendar" && (
          <>
            <div
              style={{
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: "700" }}>
                📅 Calendar Analytics
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => {
                    const [y, m] = calMonth.split("-").map(Number);
                    const d = new Date(y, m - 2, 1);
                    setCalMonth(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                    );
                    setCalDate(null);
                  }}
                  className="bo"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  ← Prev
                </button>
                <span
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    minWidth: 100,
                    textAlign: "center",
                  }}
                >
                  {new Date(calMonth + "-01").toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => {
                    const [y, m] = calMonth.split("-").map(Number);
                    const d = new Date(y, m, 1);
                    setCalMonth(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                    );
                    setCalDate(null);
                  }}
                  className="bo"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  Next →
                </button>
              </div>
            </div>
            <div className="sc" style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      padding: "4px 0",
                      fontWeight: "600",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {(() => {
                const { firstDay, daysInMonth, salesByDate, year, month } =
                  getCalendarDays(calMonth);
                const cells = [];
                for (let i = 0; i < firstDay; i++)
                  cells.push(<div key={`e-${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const rev = salesByDate[dateStr] || 0;
                  const isToday = dateStr === today();
                  const isSelected = calDate === dateStr;
                  cells.push(
                    <div
                      key={dateStr}
                      onClick={() => setCalDate(isSelected ? null : dateStr)}
                      className={`cal-day${rev > 0 ? " has-sales" : ""}${isSelected ? " selected" : ""}${isToday ? " today-cell" : ""}`}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: isToday ? "700" : "400",
                          color: isToday ? "#fbbf24" : "white",
                        }}
                      >
                        {d}
                      </div>
                      {rev > 0 && (
                        <div
                          style={{
                            fontSize: 9,
                            color: "#ec4899",
                            fontWeight: "600",
                          }}
                        >
                          {fmt(rev)}
                        </div>
                      )}
                    </div>,
                  );
                }
                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7,1fr)",
                      gap: 4,
                    }}
                  >
                    {cells}
                  </div>
                );
              })()}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 16,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                <span>🟣 Has sales</span>
                <span>🟡 Today</span>
                <span>Click a date for details</span>
              </div>
            </div>
            {calDate && calAna && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    marginBottom: 16,
                    color: "#fbbf24",
                  }}
                >
                  📆{" "}
                  {new Date(calDate + "T12:00:00").toLocaleDateString("en-IN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                {calAna.txnCount === 0 ? (
                  <div
                    className="sc"
                    style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.3)",
                      padding: 40,
                    }}
                  >
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🍦</div>No
                    sales recorded for this date
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(130px,1fr))",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      {[
                        [
                          "💰",
                          "Total Revenue",
                          fmt(calAna.totalRevenue),
                          "#fbbf24",
                        ],
                        ["🧾", "Transactions", calAna.txnCount, "#34d399"],
                        ["🍦", "Scoops Sold", calAna.totalScoops, "#818cf8"],
                        [
                          "🏆",
                          "Highest Sale",
                          fmt(calAna.highestTxn),
                          "#f472b6",
                        ],
                        ["📱", "UPI", fmt(calAna.upiRev), "#22d3ee"],
                        ["💵", "Cash", fmt(calAna.cashRev), "#fb923c"],
                        ["💳", "Card", fmt(calAna.cardRev), "#a78bfa"],
                      ].map(([icon, label, val, color]) => (
                        <div key={label} className="sc">
                          <div style={{ fontSize: 20, marginBottom: 4 }}>
                            {icon}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "rgba(255,255,255,0.5)",
                              marginBottom: 3,
                              textTransform: "uppercase",
                              letterSpacing: 1,
                            }}
                          >
                            {label}
                          </div>
                          <div
                            style={{ fontSize: 18, fontWeight: "700", color }}
                          >
                            {val}
                          </div>
                        </div>
                      ))}
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
                            marginBottom: 14,
                            color: "#fbbf24",
                          }}
                        >
                          💳 Payment Breakdown
                        </div>
                        {[
                          {
                            label: "Cash",
                            icon: "💵",
                            val: calAna.cashRev,
                            count: calAna.cashCount,
                            color: "#fb923c",
                          },
                          {
                            label: "UPI",
                            icon: "📱",
                            val: calAna.upiRev,
                            count: calAna.upiCount,
                            color: "#22d3ee",
                          },
                          {
                            label: "Card",
                            icon: "💳",
                            val: calAna.cardRev,
                            count: calAna.cardCount,
                            color: "#a78bfa",
                          },
                        ].map((p) => (
                          <div key={p.label} style={{ marginBottom: 12 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                marginBottom: 5,
                              }}
                            >
                              <span>
                                {p.icon} {p.label}
                              </span>
                              <span
                                style={{ color: p.color, fontWeight: "700" }}
                              >
                                {fmt(p.val)}{" "}
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.4)",
                                  }}
                                >
                                  ({p.count} txn)
                                </span>
                              </span>
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
                                  background: p.color,
                                  width: `${calAna.totalRevenue ? (p.val / calAna.totalRevenue) * 100 : 0}%`,
                                  transition: "width 0.5s",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "rgba(255,255,255,0.3)",
                                marginTop: 2,
                              }}
                            >
                              {calAna.totalRevenue
                                ? Math.round(
                                    (p.val / calAna.totalRevenue) * 100,
                                  )
                                : 0}
                              % of revenue
                            </div>
                          </div>
                        ))}
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
                          🍦 Flavours Sold
                        </div>
                        {calAna.topFlavors.map(([name, qty], i) => {
                          const max = calAna.topFlavors[0]?.[1] || 1;
                          const fl = flavors.find((f) => f.name === name);
                          return (
                            <div key={name} style={{ marginBottom: 8 }}>
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
                                <span style={{ color: "#fbbf24" }}>
                                  {qty} scoops
                                </span>
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
                                    background: `hsl(${(i * 37 + 200) % 360},70%,60%)`,
                                    width: `${(qty / max) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                        🧾 All Transactions — {calDate}
                      </div>
                      {calAna.filtered.map((sale) => {
                        const pc = payColor(sale.pay_mode);
                        const isHighest = sale.total === calAna.highestTxn;
                        return (
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
                                {isHighest && (
                                  <span
                                    style={{ color: "#fbbf24", marginRight: 4 }}
                                  >
                                    🏆
                                  </span>
                                )}
                                {(sale.items || [])
                                  .map((i) => `${i.qty}×${i.name}`)
                                  .join(", ")}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "rgba(255,255,255,0.4)",
                                }}
                              >
                                {sale.time}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: "700",
                                  color: isHighest ? "#fbbf24" : "white",
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
                                  background: pc.bg,
                                  color: pc.text,
                                }}
                              >
                                {sale.pay_mode?.toUpperCase()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {!calDate && (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>Click
                any date to see detailed analytics
              </div>
            )}
          </>
        )}

        {/* ── STOCK ── */}
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
                ["📦", "Total", flavors.length, "#fbbf24"],
                ["⚠️", "Low", lowStockItems.length, "#fb923c"],
                ["🚨", "Out", outOfStockItems.length, "#ef4444"],
                [
                  "✅",
                  "OK",
                  flavors.filter((f) => (stock[f.name] ?? DEFAULT_STOCK) > 10)
                    .length,
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
                  .map(
                    (f) =>
                      `${f.emoji}${f.name}(${stock[f.name] ?? DEFAULT_STOCK})`,
                  )
                  .join(", ")}
              </div>
            )}
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 12,
                marginBottom: 16,
                fontSize: 13,
                color: "#34d399",
              }}
            >
              ☁️ Stock synced across all devices via Supabase. Sell on laptop →
              mobile updates instantly.
            </div>
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
                  📦 Stock Levels
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* ✅ Reset All — sets opening_stock + current_stock to DEFAULT_STOCK in Supabase */}
                  <button
                    onClick={async () => {
                      showToast("⏳ Resetting stock...");
                      await resetAllStock(flavors, DEFAULT_STOCK);
                      const s = await loadStockFromDB();
                      setStock(s);
                      showToast(`✅ All stock reset to ${DEFAULT_STOCK}!`);
                    }}
                    className="bo"
                    style={{ fontSize: 12 }}
                  >
                    🔄 Reset All
                  </button>
                  {/* ✅ +10 All — adds 10 to every flavor's current_stock */}
                  <button
                    onClick={async () => {
                      showToast("⏳ Updating stock...");
                      const newStock = { ...stock };
                      for (const f of flavors) {
                        newStock[f.name] = Math.min(
                          (newStock[f.name] ?? DEFAULT_STOCK) + 10,
                          200,
                        );
                        await saveStockItem(f.name, newStock[f.name]);
                      }
                      setStock(newStock);
                      showToast("✅ Added 10 to all!");
                    }}
                    className="bp"
                    style={{ fontSize: 12, padding: "8px 14px" }}
                  >
                    +10 All
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
                  gap: 10,
                }}
              >
                {flavors.map((f) => {
                  const qty = stock[f.name] ?? DEFAULT_STOCK;
                  const isOut = qty <= 0;
                  const isLow = qty > 0 && qty < 10;
                  return (
                    <div
                      key={f.name}
                      style={{
                        background: isOut
                          ? "rgba(239,68,68,0.1)"
                          : isLow
                            ? "rgba(249,115,22,0.1)"
                            : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isOut ? "rgba(239,68,68,0.3)" : isLow ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{f.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            marginBottom: 6,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {/* ✅ − button saves to Supabase */}
                          <button
                            onClick={async () => {
                              const newQty = Math.max(
                                0,
                                (stock[f.name] ?? DEFAULT_STOCK) - 1,
                              );
                              setStock((s) => ({ ...s, [f.name]: newQty }));
                              await saveStockItem(f.name, newQty);
                            }}
                            style={{
                              width: 24,
                              height: 24,
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
                          {/* ✅ Input saves to Supabase on change */}
                          <input
                            type="number"
                            min="0"
                            value={qty}
                            onChange={async (e) => {
                              const newQty = Math.max(
                                0,
                                parseInt(e.target.value) || 0,
                              );
                              setStock((s) => ({ ...s, [f.name]: newQty }));
                              await saveStockItem(f.name, newQty);
                            }}
                            style={{
                              width: 48,
                              textAlign: "center",
                              padding: "3px 4px",
                              borderRadius: 6,
                              border: "1px solid rgba(255,255,255,0.2)",
                              background: "rgba(255,255,255,0.08)",
                              color: "white",
                              fontSize: 13,
                            }}
                          />
                          {/* ✅ + button saves to Supabase */}
                          <button
                            onClick={async () => {
                              const newQty =
                                (stock[f.name] ?? DEFAULT_STOCK) + 1;
                              setStock((s) => ({ ...s, [f.name]: newQty }));
                              await saveStockItem(f.name, newQty);
                            }}
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
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 8,
                          background: isOut
                            ? "rgba(239,68,68,0.2)"
                            : isLow
                              ? "rgba(249,115,22,0.2)"
                              : "rgba(52,211,153,0.2)",
                          color: isOut
                            ? "#f87171"
                            : isLow
                              ? "#fb923c"
                              : "#34d399",
                        }}
                      >
                        {isOut ? "Out" : isLow ? "Low" : "OK"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── REPORTS ── */}
        {activeTab === "reports" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                className="bp"
                style={{ fontSize: 13 }}
                onClick={() => downloadCSV(reportAna.filtered, reportMonth)}
              >
                ⬇️ Download CSV
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
                ["💳", "Card", fmt(reportAna.cardRev), "#a78bfa"],
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
                const fl = flavors.find((f) => f.name === name);
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
              {reportAna.filtered.map((sale) => {
                const pc = payColor(sale.pay_mode);
                return (
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
                        {(sale.items || [])
                          .map((i) => `${i.qty}×${i.name}`)
                          .join(", ")}
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
                            background: pc.bg,
                            color: pc.text,
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
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
