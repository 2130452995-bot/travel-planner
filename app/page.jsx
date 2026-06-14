"use client";
import { useState, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT = {
  transport:  { label: "大交通",   icon: "✈️", color: "#4A9BAB", light: "#E8F4F7", text: "#2A7A8A" },
  attraction: { label: "景点门票", icon: "🎫", color: "#7BAE8C", light: "#EAF4ED", text: "#4E8A62" },
  food:       { label: "餐饮",     icon: "🍜", color: "#E8856A", light: "#FDF0EC", text: "#C5593A" },
  hotel:      { label: "住宿",     icon: "🏨", color: "#9B7BAE", light: "#F3EDF7", text: "#7A5A8A" },
  shopping:   { label: "购物",     icon: "🛍️", color: "#AE9B7B", light: "#F7F3E8", text: "#8A7A4E" },
  pre:        { label: "出发前费用", icon: "🧳", color: "#5A8AAE", light: "#E8F0F7", text: "#2A5A7A" },
  other:      { label: "其他",     icon: "📌", color: "#8E9BAD", light: "#EEF0F3", text: "#5A6A7A" },
};

// Categories that belong to specific days (not "pre-trip")
const DAY_CATS = ["transport", "attraction", "food", "hotel", "shopping", "other"];

function uid() { return Math.random().toString(36).slice(2, 9); }

function parseTime(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}

function sortActs(acts) {
  return [...acts].sort((a, b) => {
    if (a.timeType === "allday" && b.timeType !== "allday") return 1;
    if (a.timeType !== "allday" && b.timeType === "allday") return -1;
    return (parseTime(a.time) ?? 0) - (parseTime(b.time) ?? 0);
  });
}

// ─── Number Input — clears on focus, no leading zero ─────────────────────────
function NumInput({ value, onChange, placeholder = "0", style = {} }) {
  const [raw, setRaw] = useState(value === 0 || value === "" ? "" : String(value));

  // Sync if parent value changes externally
  const handleFocus = (e) => {
    if (raw === "0" || raw === "") setRaw("");
  };
  const handleBlur = () => {
    const n = parseFloat(raw);
    if (isNaN(n) || raw.trim() === "") {
      setRaw("");
      onChange(0);
    } else {
      setRaw(String(n));
      onChange(n);
    }
  };
  const handleChange = (e) => {
    const v = e.target.value;
    // Allow digits and one decimal point only
    if (/^(\d*\.?\d*)$/.test(v)) {
      setRaw(v);
      const n = parseFloat(v);
      if (!isNaN(n)) onChange(n);
      else if (v === "" || v === ".") onChange(0);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      style={{ ...inputStyle, ...style }}
    />
  );
}

// ─── AI Summary ───────────────────────────────────────────────────────────────
async function generateDaySummary(destination, dayNum, activities) {
  if (!activities.length) return "";
  const list = activities.map(a =>
    `${a.timeType === "allday" ? "全天" : a.time || "?"} ${CAT[a.category]?.label} - ${a.title}`
  ).join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 80,
        messages: [{ role: "user", content: `你是专业旅游顾问。根据以下行程，写一句（不超过30字）轻松的今日小结，像朋友推荐。\n目的地：${destination}\n第${dayNum}天：\n${list}\n只输出那一句话。` }],
      }),
    });
    const d = await res.json();
    return d.content?.[0]?.text?.trim() ?? "";
  } catch { return ""; }
}

// ─── Shared style primitives ──────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 13px", borderRadius: 10, fontSize: 14,
  border: "1.5px solid #DDE3EA", outline: "none", boxSizing: "border-box",
  color: "#2C3E50", background: "#FAFCFD", fontFamily: "inherit",
};
function iconBtn(color) {
  return {
    background: "none", border: `1px solid ${color}33`, borderRadius: 8,
    padding: "3px 7px", cursor: "pointer", fontSize: 14, lineHeight: 1,
  };
}
function Field({ label, children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "#8E9BAD", fontWeight: 600, marginBottom: 5 }}>
        {label}{sub && <span style={{ fontWeight: 400, color: "#bbb", marginLeft: 6 }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}
function Tag({ cat }) {
  const c = CAT[cat];
  if (!c) return null;
  return (
    <span style={{
      background: c.light, color: c.text, border: `1px solid ${c.color}33`,
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── Activity Modal ───────────────────────────────────────────────────────────
// Supports: hotel (check-in/out + per-night), multi-day span, cost mode
const EMPTY_FORM = () => ({
  id: uid(),
  title: "",
  category: "transport",
  timeType: "exact",
  time: "",
  note: "",
  cost: 0,
  // multi-day
  multiDay: false,
  dayFrom: 0,   // day index (0-based)
  dayTo: 0,
  costMode: "total", // "total" | "perday"
  // hotel-specific
  hotelNightCost: 0,
});

function ActivityModal({ initial, dayIdx, totalDays, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (initial) return { ...EMPTY_FORM(), ...initial };
    const f = EMPTY_FORM();
    f.dayFrom = dayIdx;
    f.dayTo = dayIdx;
    if (initial?.category) f.category = initial.category;
    return f;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isHotel = form.category === "hotel";
  const isPre = form.category === "pre";
  const span = Math.max(0, form.dayTo - form.dayFrom) + 1;

  // Compute display cost
  const totalCost = isHotel
    ? form.hotelNightCost * Math.max(1, span)
    : form.costMode === "perday" ? form.cost * span : form.cost;

  const handleSave = () => {
    if (!form.title.trim()) return;
    const out = { ...form };
    if (isPre) {
      out.multiDay = false;
      out.timeType = "allday";
    }
    if (!out.multiDay && !isHotel) {
      out.dayTo = out.dayFrom;
    }
    onSave(out);
  };

  const dayRange = Array.from({ length: totalDays }, (_, i) => i);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(44,62,80,0.38)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 24, width: 440,
        boxShadow: "0 8px 40px rgba(44,62,80,0.18)", maxHeight: "92vh", overflowY: "auto",
      }}>
        <h3 style={{ margin: "0 0 16px", color: "#2C3E50", fontSize: 16 }}>
          {initial ? "编辑行程" : "添加行程"}
        </h3>

        {/* Category */}
        <Field label="活动类型">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(CAT).map(([k, v]) => (
              <button key={k} onClick={() => set("category", k)} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1.5px solid ${v.color}`,
                background: form.category === k ? v.color : v.light,
                color: form.category === k ? "#fff" : v.text, fontWeight: 600,
              }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Title */}
        <Field label="名称">
          <input value={form.title} onChange={e => set("title", e.target.value)}
            placeholder={isHotel ? "酒店名称" : isPre ? "如：签证费、行李箱" : "活动名称"}
            style={inputStyle} />
        </Field>

        {/* Hotel: check-in/out + per-night */}
        {isHotel ? (
          <>
            <Field label="入住 / 离店">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={form.dayFrom} onChange={e => set("dayFrom", +e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}>
                  {dayRange.map(i => <option key={i} value={i}>第 {i + 1} 天</option>)}
                </select>
                <span style={{ color: "#aaa", flexShrink: 0 }}>→</span>
                <select value={form.dayTo} onChange={e => set("dayTo", Math.max(form.dayFrom, +e.target.value))}
                  style={{ ...inputStyle, flex: 1 }}>
                  {dayRange.filter(i => i >= form.dayFrom).map(i => <option key={i} value={i}>第 {i + 1} 天</option>)}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                共 {span} 晚
              </div>
            </Field>
            <Field label="每晚费用 (¥)">
              <NumInput value={form.hotelNightCost} onChange={v => set("hotelNightCost", v)} />
              {span > 0 && form.hotelNightCost > 0 && (
                <div style={{ fontSize: 11, color: "#9B7BAE", marginTop: 4 }}>
                  共 ¥{(form.hotelNightCost * span).toLocaleString()}
                </div>
              )}
            </Field>
          </>
        ) : isPre ? (
          /* Pre-trip: just cost */
          <Field label="费用 (¥)">
            <NumInput value={form.cost} onChange={v => set("cost", v)} />
          </Field>
        ) : (
          /* Normal activity */
          <>
            {/* Time type */}
            <Field label="时间类型">
              <div style={{ display: "flex", gap: 6 }}>
                {[["exact","精确时间"],["approximate","大约时间"],["allday","全天活动"]].map(([k, v]) => (
                  <button key={k} onClick={() => set("timeType", k)} style={{
                    padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: "1.5px solid #4A9BAB",
                    background: form.timeType === k ? "#4A9BAB" : "#E8F4F7",
                    color: form.timeType === k ? "#fff" : "#2A7A8A", fontWeight: 600,
                  }}>{v}</button>
                ))}
              </div>
            </Field>

            {form.timeType !== "allday" && (
              <Field label="时间">
                <input type="time" value={form.time} onChange={e => set("time", e.target.value)} style={inputStyle} />
              </Field>
            )}

            {/* Multi-day toggle */}
            <Field label="跨越天数">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={form.multiDay} onChange={e => set("multiDay", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#4A9BAB" }} />
                <span style={{ color: "#5A6A7A" }}>此活动跨越多天</span>
              </label>
            </Field>

            {form.multiDay && (
              <Field label="活动日期范围">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={form.dayFrom} onChange={e => set("dayFrom", +e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}>
                    {dayRange.map(i => <option key={i} value={i}>第 {i + 1} 天</option>)}
                  </select>
                  <span style={{ color: "#aaa", flexShrink: 0 }}>→</span>
                  <select value={form.dayTo} onChange={e => set("dayTo", Math.max(form.dayFrom, +e.target.value))}
                    style={{ ...inputStyle, flex: 1 }}>
                    {dayRange.filter(i => i >= form.dayFrom).map(i => <option key={i} value={i}>第 {i + 1} 天</option>)}
                  </select>
                </div>
              </Field>
            )}

            {/* Cost */}
            <Field label="费用 (¥)">
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                {[["total", "活动总费用"], ["perday", "每天费用"]].map(([k, v]) => (
                  <button key={k} onClick={() => set("costMode", k)} style={{
                    padding: "4px 11px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                    border: "1.5px solid #7BAE8C",
                    background: form.costMode === k ? "#7BAE8C" : "#EAF4ED",
                    color: form.costMode === k ? "#fff" : "#4E8A62", fontWeight: 600,
                  }}>{v}</button>
                ))}
              </div>
              <NumInput value={form.cost} onChange={v => set("cost", v)} />
              {form.multiDay && form.cost > 0 && (
                <div style={{ fontSize: 11, color: "#7BAE8C", marginTop: 4 }}>
                  {form.costMode === "perday"
                    ? `每天 ¥${form.cost}，共 ${span} 天 = ¥${(form.cost * span).toLocaleString()}`
                    : `总费用 ¥${form.cost.toLocaleString()}，平摊每天 ¥${(form.cost / span).toFixed(0)}`}
                </div>
              )}
            </Field>
          </>
        )}

        <Field label="备注">
          <input value={form.note} onChange={e => set("note", e.target.value)}
            placeholder="可选" style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E0E0E0",
            background: "#fff", color: "#7A8A9A", fontSize: 14, cursor: "pointer",
          }}>取消</button>
          <button onClick={handleSave} style={{
            flex: 2, padding: "10px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>保存行程</button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline View for one day ────────────────────────────────────────────────
function TimelineView({ dayActivities, mealBudget }) {
  const sorted = sortActs(dayActivities);
  const timed = sorted.filter(a => a.timeType !== "allday");
  const allday = sorted.filter(a => a.timeType === "allday");

  return (
    <div>
      <div style={{ position: "relative", paddingLeft: 80 }}>
        {/* Vertical line */}
        {timed.length > 0 && (
          <div style={{
            position: "absolute", left: 70, top: 8, bottom: 8,
            width: 2, background: "linear-gradient(to bottom,#4A9BAB44,#7BAE8C33)", borderRadius: 2,
          }} />
        )}
        {timed.length === 0 && allday.length === 0 && (
          <div style={{ textAlign: "center", color: "#ccc", padding: "28px 0", fontSize: 13 }}>
            还没有行程，点击「添加行程」 ✨
          </div>
        )}
        {timed.map((act) => {
          const c = CAT[act.category];
          return (
            <div key={act.id} style={{ display: "flex", alignItems: "flex-start", marginBottom: 12, position: "relative" }}>
              <div style={{ position: "absolute", left: -80, width: 64, textAlign: "right", paddingTop: 7 }}>
                <span style={{ fontSize: 12, color: c.text, fontWeight: 700 }}>{act.time || "--:--"}</span>
                {act.timeType === "approximate" && <div style={{ fontSize: 10, color: "#bbb" }}>约</div>}
              </div>
              <div style={{
                position: "absolute", left: -10, top: 9,
                width: 10, height: 10, borderRadius: "50%",
                background: c.color, boxShadow: `0 0 0 3px ${c.color}22`, flexShrink: 0,
              }} />
              <ActCard act={act} compact />
            </div>
          );
        })}
      </div>
      {(allday.length > 0 || mealBudget > 0) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #E8E8E8" }}>
          <div style={{ fontSize: 11, color: "#bbb", fontWeight: 600, marginBottom: 8 }}>📅 全天</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {allday.map(act => <ActCard key={act.id} act={act} compact />)}
            {mealBudget > 0 && (
              <div style={{
                background: "#FDF0EC", borderRadius: 10, padding: "8px 12px",
                border: "1px solid #E8856A33", display: "flex", gap: 8, alignItems: "center",
              }}>
                <span style={{ fontSize: 12, color: "#C5593A" }}>🍜 餐饮预算</span>
                <span style={{ fontSize: 12, color: "#C5593A", fontWeight: 700, marginLeft: "auto" }}>¥{mealBudget.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// A small card used in timeline and list views
function ActCard({ act, compact, onEdit, onDelete }) {
  const c = CAT[act.category];
  if (!c) return null;
  const isAllday = act.timeType === "allday";
  return (
    <div style={{
      flex: 1,
      background: isAllday ? "#FAFAFA" : "#fff",
      borderRadius: 11, padding: compact ? "8px 12px" : "10px 14px",
      border: `1px solid ${isAllday ? "#EBEBEB" : c.color + "40"}`,
      boxShadow: isAllday ? "none" : "0 1px 6px rgba(0,0,0,0.05)",
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: compact ? 13 : 14, color: "#2C3E50" }}>{act.title}</span>
          <Tag cat={act.category} />
          {act.multiDay && !act.category === "hotel" && (
            <span style={{ fontSize: 10, color: "#aaa", border: "1px solid #eee", borderRadius: 8, padding: "1px 6px" }}>
              第{act.dayFrom + 1}–{act.dayTo + 1}天
            </span>
          )}
        </div>
        {act.note && <div style={{ fontSize: 11, color: "#9AA8B5", marginTop: 2 }}>{act.note}</div>}
        {act._displayCost > 0 && (
          <div style={{ fontSize: 11, color: c.text, marginTop: 3, fontWeight: 500 }}>
            ¥{act._displayCost.toLocaleString()}{act._costNote ? <span style={{ color: "#bbb", fontWeight: 400 }}> {act._costNote}</span> : ""}
          </div>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {onEdit && <button onClick={onEdit} style={iconBtn("#4A9BAB")}>✏️</button>}
          {onDelete && <button onClick={onDelete} style={iconBtn("#E8856A")}>🗑️</button>}
        </div>
      )}
    </div>
  );
}

// ─── Summary Panel ────────────────────────────────────────────────────────────
function SummaryPanel({ days, preActivities, mealBudget }) {
  const totalMeal = mealBudget * days.length;

  // Sum all day activities
  const allDayActs = days.flatMap(d => d.activities);
  const byCat = {};
  allDayActs.forEach(a => {
    const cost = a._totalCost ?? a._displayCost ?? 0;
    // Avoid double-counting multi-day: each day gets its display cost slice
    byCat[a.category] = (byCat[a.category] || 0) + (a._displayCost || 0);
  });
  byCat["food"] = (byCat["food"] || 0) + totalMeal;

  const preCost = preActivities.reduce((s, a) => s + (a.cost || 0), 0);
  byCat["pre"] = preCost;

  const grandTotal = Object.values(byCat).reduce((s, v) => s + v, 0);

  return (
    <div style={{
      background: "linear-gradient(135deg,#F7FAFB,#EAF4ED)",
      borderRadius: 18, padding: 18, border: "1px solid #D0E8DC",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#4A9BAB", marginBottom: 12 }}>💰 费用总览</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#2C3E50", marginBottom: 3 }}>
        ¥ {grandTotal.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: "#8E9BAD", marginBottom: 14 }}>
        {days.length} 天行程预计总花销
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(CAT).map(([k, v]) => {
          const amt = byCat[k] || 0;
          if (!amt) return null;
          return (
            <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: v.text }}>{v.icon} {v.label}
                  {k === "food" && <span style={{ color: "#ccc", fontSize: 10, marginLeft: 4 }}>(含每日餐饮)</span>}
                </span>
                <span style={{ fontWeight: 700, color: "#2C3E50" }}>¥{amt.toLocaleString()}</span>
              </div>
              <div style={{ height: 4, background: "#E8E8E8", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${grandTotal > 0 ? amt / grandTotal * 100 : 0}%`, height: "100%", background: v.color, borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TravelPlanner() {
  const [destination, setDestination] = useState("");
  const [destInput, setDestInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState([]); // [{id, activities:[...]}]
  const [preActivities, setPreActivities] = useState([]); // "pre" category items
  const [activeDay, setActiveDay] = useState(0);
  const [mealBudget, setMealBudget] = useState(150);
  const [modal, setModal] = useState(null); // {act|null, dayIdx|null, isPre}
  const [tab, setTab] = useState("timeline");
  const [daySummaries, setDaySummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [activeMain, setActiveMain] = useState("days"); // "days" | "pre"

  // Helpers
  const dayDate = (idx) => {
    if (!startDate) return `第 ${idx + 1} 天`;
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + idx);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
  };

  const addDay = () => {
    setDays(ds => [...ds, { id: uid(), activities: [] }]);
    setActiveDay(days.length);
  };
  const removeDay = (idx) => {
    setDays(ds => ds.filter((_, i) => i !== idx));
    setActiveDay(a => Math.max(0, a >= idx ? a - 1 : a));
  };

  // Build "expanded" activities for each day:
  // multi-day items appear as a slice on each covered day
  const expandedDays = useMemo(() => {
    return days.map((d, di) => {
      // Start with direct activities of this day
      const direct = d.activities.filter(a => {
        if (a.category === "hotel") return false; // handled separately
        if (!a.multiDay) return !a._injected; // normal single-day
        return a.dayFrom <= di && a.dayTo >= di;
      }).map(a => {
        if (!a.multiDay) return { ...a, _displayCost: a.cost || 0 };
        const span = Math.max(1, a.dayTo - a.dayFrom + 1);
        const perDay = a.costMode === "perday" ? (a.cost || 0) : (a.cost || 0) / span;
        return {
          ...a,
          _displayCost: Math.round(perDay * 10) / 10,
          _costNote: a.costMode === "perday" ? "/天" : `(总¥${a.cost}平摊)`,
        };
      });

      // Inject hotel nights
      // Hotels: stored globally, need to check which days they cover
      const allHotels = days.flatMap(dd => dd.activities.filter(a => a.category === "hotel"));
      const hotelSlices = allHotels
        .filter(h => h.dayFrom <= di && h.dayTo >= di)
        .map(h => ({
          ...h,
          timeType: "allday",
          _displayCost: h.hotelNightCost || 0,
          _costNote: "/晚",
          _injected: true,
        }));

      return { ...d, activities: [...direct, ...hotelSlices] };
    });
  }, [days]);

  // Save activity: if hotel or multi-day, store on the "from" day (canonical home)
  const saveActivity = (dayIdx, act) => {
    if (act.category === "pre") {
      // Pre-trip activity
      setPreActivities(prev => {
        const idx = prev.findIndex(a => a.id === act.id);
        return idx >= 0 ? prev.map(a => a.id === act.id ? act : a) : [...prev, act];
      });
      setModal(null);
      return;
    }

    // For hotel / multi-day: canonical home is dayFrom
    const homeDay = act.category === "hotel" || act.multiDay ? act.dayFrom : dayIdx;

    setDays(ds => ds.map((d, i) => {
      // Remove from ALL days first (in case it moved)
      const without = d.activities.filter(a => a.id !== act.id);
      if (i === homeDay) {
        return { ...d, activities: [...without, act] };
      }
      return { ...d, activities: without };
    }));
    setModal(null);
    setDaySummaries(s => { const n = { ...s }; delete n[dayIdx]; return n; });
  };

  const deleteActivity = (actId, isPre = false) => {
    if (isPre) {
      setPreActivities(prev => prev.filter(a => a.id !== actId));
    } else {
      setDays(ds => ds.map(d => ({ ...d, activities: d.activities.filter(a => a.id !== actId) })));
    }
  };

  const fetchDaySummary = async (di) => {
    const day = expandedDays[di];
    if (!day || !destination) return;
    setSummaryLoading(s => ({ ...s, [di]: true }));
    const summary = await generateDaySummary(destination, di + 1, day.activities);
    setDaySummaries(s => ({ ...s, [di]: summary }));
    setSummaryLoading(s => ({ ...s, [di]: false }));
  };

  const currentExpDay = expandedDays[activeDay] ?? { activities: [] };
  const sortedActs = sortActs(currentExpDay.activities);

  // Day cost
  const dayCost = (di) => {
    const exp = expandedDays[di];
    if (!exp) return mealBudget;
    return exp.activities.reduce((s, a) => s + (a._displayCost ?? a.cost ?? 0), 0) + mealBudget;
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F7FAFB",
      fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif", color: "#2C3E50",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 16px rgba(74,155,171,0.2)",
      }}>
        <span style={{ fontSize: 24 }}>🗺️</span>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>旅行规划师</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>记录每一段旅程</div>
        </div>
        {destination && (
          <div style={{
            marginLeft: "auto", background: "rgba(255,255,255,0.2)",
            borderRadius: 20, padding: "5px 14px", color: "#fff", fontSize: 13, fontWeight: 600,
          }}>
            📍 {destination}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 14px" }}>
        {/* Setup */}
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18,
          background: "#fff", borderRadius: 16, padding: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          alignItems: "center",
        }}>
          <input value={destInput} onChange={e => setDestInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && destInput.trim() && setDestination(destInput.trim())}
            placeholder="目的地（如：京都、巴黎…）"
            style={{ ...inputStyle, flex: "2 1 160px", width: "auto" }} />
          <button onClick={() => destInput.trim() && setDestination(destInput.trim())} style={{
            padding: "9px 16px", borderRadius: 10, background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
            color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
          }}>确定目的地</button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 140px" }}>
            <span style={{ fontSize: 12, color: "#8E9BAD", whiteSpace: "nowrap" }}>出发日期</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ ...inputStyle, flex: 1, width: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 1 180px" }}>
            <span style={{ fontSize: 12, color: "#E8856A", whiteSpace: "nowrap" }}>🍜 每日餐饮预算</span>
            <NumInput value={mealBudget} onChange={setMealBudget} style={{ width: 70, flex: "none" }} />
            <span style={{ fontSize: 12, color: "#8E9BAD" }}>¥</span>
          </div>
        </div>

        {/* Main nav */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setActiveMain("days")} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
            border: activeMain === "days" ? "none" : "1.5px solid #DDE3EA",
            background: activeMain === "days" ? "#4A9BAB" : "#fff",
            color: activeMain === "days" ? "#fff" : "#5A6A7A", fontWeight: activeMain === "days" ? 700 : 400,
          }}>📅 行程天数</button>
          <button onClick={() => setActiveMain("pre")} style={{
            padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
            border: activeMain === "pre" ? "none" : "1.5px solid #DDE3EA",
            background: activeMain === "pre" ? "#5A8AAE" : "#fff",
            color: activeMain === "pre" ? "#fff" : "#5A6A7A", fontWeight: activeMain === "pre" ? 700 : 400,
          }}>🧳 出发前费用
            {preActivities.length > 0 && (
              <span style={{
                marginLeft: 6, background: "rgba(255,255,255,0.3)", borderRadius: 10,
                padding: "1px 7px", fontSize: 11,
              }}>{preActivities.length}</span>
            )}
          </button>

          {activeMain === "days" && (
            <>
              <div style={{ width: 1, height: 24, background: "#E8E8E8", margin: "0 4px" }} />
              {days.map((d, i) => (
                <button key={d.id} onClick={() => setActiveDay(i)} style={{
                  padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: activeDay === i && activeMain === "days" ? "none" : "1.5px solid #DDE3EA",
                  background: activeDay === i && activeMain === "days" ? "linear-gradient(135deg,#4A9BAB,#7BAE8C)" : "#fff",
                  color: activeDay === i && activeMain === "days" ? "#fff" : "#5A6A7A",
                  fontWeight: activeDay === i && activeMain === "days" ? 700 : 400,
                  boxShadow: activeDay === i && activeMain === "days" ? "0 2px 8px #4A9BAB33" : "none",
                }}>
                  {dayDate(i)}
                </button>
              ))}
              <button onClick={addDay} style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: "1.5px dashed #4A9BAB", background: "#E8F4F7", color: "#2A7A8A", fontWeight: 600,
              }}>+ 天</button>
              {days.length > 0 && (
                <button onClick={() => removeDay(activeDay)} style={{
                  padding: "6px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: "1.5px solid #E8856A44", background: "#FDF0EC", color: "#C5593A",
                }}>🗑</button>
              )}
            </>
          )}
        </div>

        {/* Content grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 268px", gap: 14, alignItems: "start" }}>
          {/* Left */}
          <div>
            {activeMain === "pre" ? (
              /* Pre-trip panel */
              <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3E50" }}>🧳 出发前费用</div>
                    <div style={{ fontSize: 12, color: "#8E9BAD", marginTop: 2 }}>签证、行李、装备、预购票等不归属某天的花费</div>
                  </div>
                  <button onClick={() => setModal({ act: null, dayIdx: 0, isPre: true })} style={{
                    padding: "7px 14px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#5A8AAE,#4A9BAB)",
                    color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>+ 添加</button>
                </div>
                {preActivities.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#ccc", padding: "24px 0", fontSize: 13 }}>
                    还没有出发前费用 ✈️
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {preActivities.map(act => (
                      <div key={act.id} style={{
                        background: "#F7FAFC", borderRadius: 11, padding: "10px 14px",
                        border: "1px solid #5A8AAE33", display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50" }}>{act.title}</span>
                            <Tag cat="pre" />
                          </div>
                          {act.note && <div style={{ fontSize: 11, color: "#9AA8B5", marginTop: 2 }}>{act.note}</div>}
                          {act.cost > 0 && <div style={{ fontSize: 12, color: "#2A5A7A", fontWeight: 500, marginTop: 3 }}>¥{act.cost.toLocaleString()}</div>}
                        </div>
                        <button onClick={() => setModal({ act, dayIdx: 0, isPre: true })} style={iconBtn("#4A9BAB")}>✏️</button>
                        <button onClick={() => deleteActivity(act.id, true)} style={iconBtn("#E8856A")}>🗑️</button>
                      </div>
                    ))}
                    <div style={{ fontSize: 13, color: "#5A8AAE", fontWeight: 600, marginTop: 6, textAlign: "right" }}>
                      合计 ¥{preActivities.reduce((s, a) => s + (a.cost || 0), 0).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ) : days.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>✈️</div>
                <div style={{ color: "#8E9BAD", fontSize: 14, marginBottom: 20 }}>还没有行程天数，开始规划吧！</div>
                <button onClick={addDay} style={{
                  padding: "11px 28px", borderRadius: 14, background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
                  color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>+ 添加第一天</button>
              </div>
            ) : (
              /* Day view */
              <div>
                {/* Day header */}
                <div style={{
                  background: "#fff", borderRadius: 14, padding: "14px 18px", marginBottom: 10,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3E50" }}>{dayDate(activeDay)}</div>
                      {daySummaries[activeDay] && (
                        <div style={{ fontSize: 12, color: "#7BAE8C", marginTop: 3 }}>💬 {daySummaries[activeDay]}</div>
                      )}
                      {summaryLoading[activeDay] && (
                        <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>✨ 生成中…</div>
                      )}
                      <div style={{ fontSize: 12, color: "#8E9BAD", marginTop: 4 }}>
                        今日预计：<span style={{ color: "#4A9BAB", fontWeight: 700 }}>¥{dayCost(activeDay).toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => fetchDaySummary(activeDay)} style={{
                        padding: "6px 11px", borderRadius: 9, fontSize: 12, cursor: "pointer",
                        border: "1.5px solid #7BAE8C", background: "#EAF4ED", color: "#4E8A62", fontWeight: 600,
                      }}>💬 AI 小结</button>
                      <button onClick={() => setModal({ act: null, dayIdx: activeDay, isPre: false })} style={{
                        padding: "6px 13px", borderRadius: 9, border: "none",
                        background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
                        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>+ 添加行程</button>
                    </div>
                  </div>
                </div>

                {/* View toggle */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[["timeline", "⏱ 时间轴"], ["list", "📋 列表"]].map(([k, v]) => (
                    <button key={k} onClick={() => setTab(k)} style={{
                      padding: "5px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                      border: tab === k ? "none" : "1.5px solid #DDE3EA",
                      background: tab === k ? "#4A9BAB" : "#fff",
                      color: tab === k ? "#fff" : "#5A6A7A", fontWeight: tab === k ? 700 : 400,
                    }}>{v}</button>
                  ))}
                </div>

                <div style={{
                  background: "#fff", borderRadius: 14, padding: "16px 20px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)", minHeight: 180,
                }}>
                  {tab === "timeline" ? (
                    <TimelineView dayActivities={currentExpDay.activities} mealBudget={mealBudget} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {sortedActs.length === 0 && (
                        <div style={{ textAlign: "center", color: "#ccc", padding: "24px 0", fontSize: 13 }}>
                          还没有行程 ✨
                        </div>
                      )}
                      {sortedActs.map(act => {
                        // Find canonical home day for edit/delete
                        const homeDay = act.category === "hotel" || act.multiDay ? act.dayFrom : activeDay;
                        return (
                          <div key={act.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 54, textAlign: "right", paddingTop: 9 }}>
                              {act.timeType === "allday"
                                ? <span style={{ fontSize: 11, color: "#bbb" }}>全天</span>
                                : <span style={{ fontSize: 12, color: CAT[act.category]?.text, fontWeight: 700 }}>{act.time || "--:--"}</span>}
                            </div>
                            <ActCard
                              act={act}
                              onEdit={() => {
                                // Find original act from canonical home day
                                const orig = days[homeDay]?.activities.find(a => a.id === act.id) ?? act;
                                setModal({ act: orig, dayIdx: homeDay, isPre: false });
                              }}
                              onDelete={() => deleteActivity(act.id, false)}
                            />
                          </div>
                        );
                      })}
                      {mealBudget > 0 && (
                        <div style={{
                          background: "#FDF0EC", borderRadius: 10, padding: "9px 13px",
                          border: "1px solid #E8856A33", display: "flex", gap: 8, alignItems: "center",
                        }}>
                          <span style={{ fontSize: 13, color: "#C5593A" }}>🍜 今日餐饮预算</span>
                          <span style={{ marginLeft: "auto", color: "#C5593A", fontWeight: 700 }}>¥{mealBudget.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Summary + per-day costs */}
          <div style={{ position: "sticky", top: 14 }}>
            <SummaryPanel days={expandedDays} preActivities={preActivities} mealBudget={mealBudget} />

            {days.length > 1 && (
              <div style={{
                background: "#fff", borderRadius: 14, padding: 14, marginTop: 12,
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8E9BAD", marginBottom: 8 }}>各天花销</div>
                {days.map((_, i) => (
                  <div key={i} onClick={() => { setActiveDay(i); setActiveMain("days"); }} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "5px 8px", borderRadius: 8, cursor: "pointer",
                    background: i === activeDay && activeMain === "days" ? "#E8F4F7" : "transparent",
                    marginBottom: 2,
                  }}>
                    <span style={{ fontSize: 12, color: i === activeDay && activeMain === "days" ? "#2A7A8A" : "#5A6A7A" }}>
                      {dayDate(i)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: i === activeDay && activeMain === "days" ? "#4A9BAB" : "#8E9BAD" }}>
                      ¥{dayCost(i).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: 14, marginTop: 12,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8E9BAD", marginBottom: 8 }}>活动类型</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {Object.entries(CAT).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#5A6A7A" }}>{v.icon} {v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ActivityModal
          initial={modal.isPre ? { ...modal.act, category: "pre" } : modal.act}
          dayIdx={modal.dayIdx ?? activeDay}
          totalDays={Math.max(1, days.length)}
          onSave={(act) => saveActivity(modal.dayIdx ?? activeDay, act)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
