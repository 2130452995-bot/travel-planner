"use client";
import { useState, useMemo, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT = {
  transport:  { label: "大交通",    icon: "✈️",  color: "#4A9BAB", light: "#E8F4F7", text: "#2A7A8A" },
  attraction: { label: "景点门票",  icon: "🎫",  color: "#7BAE8C", light: "#EAF4ED", text: "#4E8A62" },
  food:       { label: "餐饮",      icon: "🍜",  color: "#E8856A", light: "#FDF0EC", text: "#C5593A" },
  hotel:      { label: "住宿",      icon: "🏨",  color: "#9B7BAE", light: "#F3EDF7", text: "#7A5A8A" },
  shopping:   { label: "购物",      icon: "🛍️",  color: "#AE9B7B", light: "#F7F3E8", text: "#8A7A4E" },
  pre:        { label: "出发前费用", icon: "🧳",  color: "#5A8AAE", light: "#E8F0F7", text: "#2A5A7A" },
  other:      { label: "其他",      icon: "📌",  color: "#8E9BAD", light: "#EEF0F3", text: "#5A6A7A" },
};

const STORAGE_KEY = "travel_planner_v2";

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

// ─── Persist helpers ──────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = window.storage ? null : localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 14,
  border: "1.5px solid #DDE3EA", outline: "none", boxSizing: "border-box",
  color: "#2C3E50", background: "#FAFCFD", fontFamily: "inherit",
};
const iconBtnStyle = (color) => ({
  background: "none", border: `1px solid ${color}33`, borderRadius: 8,
  padding: "4px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1, color,
});

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 12, color: "#8E9BAD", fontWeight: 600, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Tag({ cat }) {
  const c = CAT[cat]; if (!c) return null;
  return (
    <span style={{
      background: c.light, color: c.text, border: `1px solid ${c.color}33`,
      borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    }}>{c.icon} {c.label}</span>
  );
}

// ─── NumInput: clears on focus, no leading zeros ──────────────────────────────
function NumInput({ value, onChange, style = {} }) {
  const [raw, setRaw] = useState(value ? String(value) : "");
  useEffect(() => { setRaw(value ? String(value) : ""); }, [value]);
  return (
    <input
      type="text" inputMode="decimal" value={raw}
      placeholder="0"
      onFocus={() => { if (raw === "0") setRaw(""); }}
      onBlur={() => {
        const n = parseFloat(raw);
        if (isNaN(n) || raw.trim() === "") { setRaw(""); onChange(0); }
        else { setRaw(String(n)); onChange(n); }
      }}
      onChange={e => {
        const v = e.target.value;
        if (/^(\d*\.?\d*)$/.test(v)) {
          setRaw(v);
          const n = parseFloat(v);
          if (!isNaN(n)) onChange(n);
          else onChange(0);
        }
      }}
      style={{ ...inputStyle, ...style }}
    />
  );
}

// ─── Activity Modal ───────────────────────────────────────────────────────────
const blankForm = (dayIdx) => ({
  id: uid(), title: "", category: "transport", timeType: "exact",
  time: "", note: "", cost: 0,
  multiDay: false, dayFrom: dayIdx, dayTo: dayIdx,
  costMode: "total", hotelNightCost: 0,
});

function ActivityModal({ initial, dayIdx, totalDays, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    initial ? { ...blankForm(dayIdx), ...initial } : blankForm(dayIdx)
  );
  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);
  const isHotel = form.category === "hotel";
  const isPre   = form.category === "pre";
  const span = Math.max(1, form.dayTo - form.dayFrom + 1);
  const dayOpts = Array.from({ length: totalDays }, (_, i) => i);

  const handleSave = () => {
    if (!form.title.trim()) return;
    const out = { ...form };
    if (isPre) { out.multiDay = false; out.timeType = "allday"; }
    if (!out.multiDay && !isHotel) out.dayTo = out.dayFrom;
    onSave(out);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(44,62,80,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "22px 24px", width: "min(440px, 94vw)",
        boxShadow: "0 10px 48px rgba(44,62,80,0.2)", maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#2C3E50" }}>{initial ? "编辑行程" : "添加行程"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>×</button>
        </div>

        {/* Category */}
        <Field label="活动类型">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(CAT).map(([k, v]) => (
              <button key={k} onClick={() => set("category", k)} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1.5px solid ${v.color}`,
                background: form.category === k ? v.color : v.light,
                color: form.category === k ? "#fff" : v.text, fontWeight: 600,
              }}>{v.icon} {v.label}</button>
            ))}
          </div>
        </Field>

        <Field label="名称">
          <input value={form.title} onChange={e => set("title", e.target.value)}
            placeholder={isHotel ? "酒店名称" : isPre ? "如：签证费、行李箱" : "活动名称"}
            style={inputStyle} autoFocus />
        </Field>

        {/* Hotel */}
        {isHotel && (
          <>
            <Field label="入住 / 离店">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={form.dayFrom} onChange={e => { const v = +e.target.value; set("dayFrom", v); if (form.dayTo < v) set("dayTo", v); }} style={{ ...inputStyle, flex: 1 }}>
                  {dayOpts.map(i => <option key={i} value={i}>第 {i+1} 天</option>)}
                </select>
                <span style={{ color: "#bbb", flexShrink: 0, fontSize: 13 }}>→</span>
                <select value={form.dayTo} onChange={e => set("dayTo", Math.max(form.dayFrom, +e.target.value))} style={{ ...inputStyle, flex: 1 }}>
                  {dayOpts.filter(i => i >= form.dayFrom).map(i => <option key={i} value={i}>第 {i+1} 天</option>)}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>共 {span} 晚</div>
            </Field>
            <Field label="每晚费用 (¥)">
              <NumInput value={form.hotelNightCost} onChange={v => set("hotelNightCost", v)} />
              {span > 0 && form.hotelNightCost > 0 && (
                <div style={{ fontSize: 11, color: "#9B7BAE", marginTop: 4 }}>总计 ¥{(form.hotelNightCost * span).toLocaleString()}</div>
              )}
            </Field>
          </>
        )}

        {/* Pre-trip */}
        {isPre && (
          <Field label="费用 (¥)">
            <NumInput value={form.cost} onChange={v => set("cost", v)} />
          </Field>
        )}

        {/* Normal */}
        {!isHotel && !isPre && (
          <>
            <Field label="时间类型">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

            <Field label="跨越多天">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#5A6A7A" }}>
                <input type="checkbox" checked={form.multiDay} onChange={e => set("multiDay", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#4A9BAB" }} />
                此活动跨越多天
              </label>
            </Field>

            {form.multiDay && (
              <Field label="日期范围">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={form.dayFrom} onChange={e => { const v = +e.target.value; set("dayFrom", v); if (form.dayTo < v) set("dayTo", v); }} style={{ ...inputStyle, flex: 1 }}>
                    {dayOpts.map(i => <option key={i} value={i}>第 {i+1} 天</option>)}
                  </select>
                  <span style={{ color: "#bbb", flexShrink: 0, fontSize: 13 }}>→</span>
                  <select value={form.dayTo} onChange={e => set("dayTo", Math.max(form.dayFrom, +e.target.value))} style={{ ...inputStyle, flex: 1 }}>
                    {dayOpts.filter(i => i >= form.dayFrom).map(i => <option key={i} value={i}>第 {i+1} 天</option>)}
                  </select>
                </div>
              </Field>
            )}

            <Field label="费用 (¥)">
              {form.multiDay && (
                <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                  {[["total","活动总费用"],["perday","每天费用"]].map(([k, v]) => (
                    <button key={k} onClick={() => set("costMode", k)} style={{
                      padding: "4px 11px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                      border: "1.5px solid #7BAE8C",
                      background: form.costMode === k ? "#7BAE8C" : "#EAF4ED",
                      color: form.costMode === k ? "#fff" : "#4E8A62", fontWeight: 600,
                    }}>{v}</button>
                  ))}
                </div>
              )}
              <NumInput value={form.cost} onChange={v => set("cost", v)} />
              {form.multiDay && form.cost > 0 && (
                <div style={{ fontSize: 11, color: "#7BAE8C", marginTop: 4 }}>
                  {form.costMode === "perday"
                    ? `每天 ¥${form.cost}，共 ${span} 天 = ¥${(form.cost * span).toLocaleString()}`
                    : `总费用 ¥${form.cost.toLocaleString()}，平摊每天约 ¥${(form.cost / span).toFixed(0)}`}
                </div>
              )}
            </Field>
          </>
        )}

        <Field label="备注">
          <input value={form.note} onChange={e => set("note", e.target.value)} placeholder="可选" style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E0E0E0",
            background: "#fff", color: "#7A8A9A", fontSize: 14, cursor: "pointer",
          }}>取消</button>
          <button onClick={handleSave} disabled={!form.title.trim()} style={{
            flex: 2, padding: "10px 0", borderRadius: 12, border: "none",
            background: form.title.trim() ? "linear-gradient(135deg,#4A9BAB,#7BAE8C)" : "#E0E0E0",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: form.title.trim() ? "pointer" : "default",
          }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ─── True Timeline View ───────────────────────────────────────────────────────
function TimelineView({ dayActivities, mealBudget, onEdit, onDelete }) {
  const sorted = sortActs(dayActivities);
  const timed  = sorted.filter(a => a.timeType !== "allday");
  const allday = sorted.filter(a => a.timeType === "allday");
  const hasAny = timed.length > 0 || allday.length > 0 || mealBudget > 0;

  return (
    <div>
      {!hasAny && (
        <div style={{ textAlign: "center", color: "#ccc", padding: "32px 0", fontSize: 13 }}>
          还没有行程安排，点上方「+ 添加行程」✈️
        </div>
      )}

      {/* Timed entries on the axis */}
      {timed.length > 0 && (
        <div style={{ position: "relative", paddingLeft: 68 }}>
          {/* vertical rail */}
          <div style={{
            position: "absolute", left: 52, top: 6, bottom: 6,
            width: 2, borderRadius: 2,
            background: "linear-gradient(to bottom, #4A9BAB55, #7BAE8C33)",
          }} />

          {timed.map((act, idx) => {
            const c = CAT[act.category] ?? CAT.other;
            const isApprox = act.timeType === "approximate";
            return (
              <div key={act.id} style={{ position: "relative", marginBottom: idx < timed.length - 1 ? 0 : 0 }}>
                {/* Time label */}
                <div style={{
                  position: "absolute", left: -68, width: 46, textAlign: "right", top: 12,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.text, display: "block" }}>
                    {act.time || "--:--"}
                  </span>
                  {isApprox && <span style={{ fontSize: 10, color: "#bbb" }}>约</span>}
                </div>

                {/* Dot */}
                <div style={{
                  position: "absolute", left: -20, top: 14,
                  width: 10, height: 10, borderRadius: "50%",
                  background: c.color, boxShadow: `0 0 0 3px ${c.color}25`,
                }} />

                {/* Card */}
                <div style={{
                  marginBottom: 10,
                  background: "#fff", borderRadius: 12,
                  border: `1px solid ${c.color}35`,
                  boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
                  overflow: "hidden",
                }}>
                  {/* Color accent bar */}
                  <div style={{ height: 3, background: c.color }} />
                  <div style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50" }}>{act.title}</span>
                        <Tag cat={act.category} />
                      </div>
                      {act.note && <div style={{ fontSize: 12, color: "#9AA8B5", marginBottom: 2 }}>{act.note}</div>}
                      {(act._displayCost > 0) && (
                        <div style={{ fontSize: 12, color: c.text, fontWeight: 500 }}>
                          ¥{act._displayCost.toLocaleString()}
                          {act._costNote && <span style={{ color: "#bbb", fontWeight: 400 }}> {act._costNote}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingTop: 2 }}>
                      <button onClick={() => onEdit(act)} style={iconBtnStyle("#4A9BAB")}>✏️</button>
                      <button onClick={() => onDelete(act.id)} style={iconBtnStyle("#E8856A")}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All-day section */}
      {(allday.length > 0 || mealBudget > 0) && (
        <div style={{ marginTop: timed.length > 0 ? 14 : 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          }}>
            <div style={{ flex: 1, height: 1, background: "#EBEBEB" }} />
            <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600, whiteSpace: "nowrap" }}>全天安排</span>
            <div style={{ flex: 1, height: 1, background: "#EBEBEB" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {allday.map(act => {
              const c = CAT[act.category] ?? CAT.other;
              return (
                <div key={act.id} style={{
                  background: "#FAFAFA", borderRadius: 10, padding: "9px 12px",
                  border: "1px solid #E8E8E8", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ width: 3, height: 32, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#2C3E50" }}>{act.title}</span>
                      <Tag cat={act.category} />
                    </div>
                    {act.note && <div style={{ fontSize: 11, color: "#9AA8B5" }}>{act.note}</div>}
                    {act._displayCost > 0 && (
                      <div style={{ fontSize: 11, color: c.text, fontWeight: 500 }}>
                        ¥{act._displayCost.toLocaleString()}{act._costNote && <span style={{ color: "#bbb", fontWeight: 400 }}> {act._costNote}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => onEdit(act)} style={iconBtnStyle("#4A9BAB")}>✏️</button>
                    <button onClick={() => onDelete(act.id)} style={iconBtnStyle("#E8856A")}>🗑️</button>
                  </div>
                </div>
              );
            })}

            {mealBudget > 0 && (
              <div style={{
                background: "#FDF0EC", borderRadius: 10, padding: "9px 12px",
                border: "1px solid #E8856A30", display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: "#E8856A", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#C5593A", flex: 1 }}>🍜 餐饮预算</span>
                <span style={{ fontSize: 13, color: "#C5593A", fontWeight: 700 }}>¥{mealBudget.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Panel ────────────────────────────────────────────────────────────
function SummaryPanel({ expandedDays, preActivities, mealBudget }) {
  const totalMeal = mealBudget * expandedDays.length;
  const byCat = {};
  expandedDays.forEach(d =>
    d.activities.forEach(a => {
      byCat[a.category] = (byCat[a.category] || 0) + (a._displayCost || 0);
    })
  );
  byCat.food = (byCat.food || 0) + totalMeal;
  byCat.pre  = preActivities.reduce((s, a) => s + (a.cost || 0), 0);
  const grand = Object.values(byCat).reduce((s, v) => s + v, 0);

  return (
    <div style={{
      background: "linear-gradient(140deg,#F7FAFB,#EAF4ED)",
      borderRadius: 16, padding: 18, border: "1px solid #D0E8DC",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#4A9BAB", marginBottom: 10 }}>💰 支出总览</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#2C3E50", lineHeight: 1 }}>¥{grand.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: "#8E9BAD", margin: "4px 0 14px" }}>
        {expandedDays.length} 天预计总花销
      </div>
      {Object.entries(CAT).map(([k, v]) => {
        const amt = byCat[k] || 0;
        if (!amt) return null;
        return (
          <div key={k} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: v.text }}>
                {v.icon} {v.label}
                {k === "food" && totalMeal > 0 && (
                  <span style={{ color: "#ccc", fontWeight: 400, fontSize: 10, marginLeft: 4 }}>(含餐饮预算)</span>
                )}
              </span>
              <span style={{ fontWeight: 700, color: "#2C3E50" }}>¥{amt.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: "#E4EAE8", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: grand > 0 ? `${amt / grand * 100}%` : "0%",
                height: "100%", background: v.color, borderRadius: 3, transition: "width 0.4s",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  destination: "", startDate: "", days: [], preActivities: [], mealBudget: 150,
};

export default function TravelPlanner() {
  const [state, setState] = useState(() => loadState() ?? DEFAULT_STATE);
  const [activeDay, setActiveDay] = useState(0);
  const [modal, setModal]         = useState(null);
  const [activeMain, setActiveMain] = useState("days"); // "days" | "pre"
  const [rightPanel, setRightPanel] = useState("itinerary"); // "itinerary" | "summary" (mobile toggle)
  const [saveFlash, setSaveFlash]   = useState(false);

  const { destination, startDate, days, preActivities, mealBudget } = state;

  // Persist on every change
  useEffect(() => { saveState(state); }, [state]);

  const setField = (k, v) => setState(s => ({ ...s, [k]: v }));

  // Manual save button feedback
  const handleManualSave = () => {
    saveState(state);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1600);
  };

  // Day helpers
  const dayDate = (idx) => {
    if (!startDate) return `第 ${idx + 1} 天`;
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + idx);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
  };
  const addDay = () => {
    setState(s => ({ ...s, days: [...s.days, { id: uid(), activities: [] }] }));
    setActiveDay(days.length);
    setActiveMain("days");
  };
  const removeDay = (idx) => {
    setState(s => ({ ...s, days: s.days.filter((_, i) => i !== idx) }));
    setActiveDay(a => Math.max(0, a > idx ? a - 1 : a >= idx ? Math.max(0, a - 1) : a));
  };

  // Build expanded days: hotels and multi-day items appear on each covered day
  const expandedDays = useMemo(() => days.map((d, di) => {
    // Gather all hotels from all days
    const allHotels = days.flatMap(dd => dd.activities.filter(a => a.category === "hotel"));

    // Activities directly on this day (excluding hotels, which are stored on dayFrom)
    const direct = d.activities
      .filter(a => a.category !== "hotel")
      .filter(a => {
        if (!a.multiDay) return true;
        return a.dayFrom <= di && a.dayTo >= di;
      })
      .map(a => {
        if (!a.multiDay) return { ...a, _displayCost: a.cost || 0 };
        const span = Math.max(1, a.dayTo - a.dayFrom + 1);
        const perDay = a.costMode === "perday" ? (a.cost || 0) : (a.cost || 0) / span;
        return {
          ...a,
          _displayCost: Math.round(perDay * 100) / 100,
          _costNote: a.costMode === "perday" ? "/天" : `(总¥${a.cost}平摊)`,
        };
      });

    // Hotel slices for this day
    const hotelSlices = allHotels
      .filter(h => h.dayFrom <= di && h.dayTo >= di)
      .map(h => ({
        ...h, timeType: "allday",
        _displayCost: h.hotelNightCost || 0, _costNote: "/晚",
        _injected: true,
      }));

    return { ...d, activities: [...direct, ...hotelSlices] };
  }), [days]);

  // Save activity
  const saveActivity = (act) => {
    if (act.category === "pre") {
      setState(s => {
        const prev = s.preActivities;
        const idx = prev.findIndex(a => a.id === act.id);
        return { ...s, preActivities: idx >= 0 ? prev.map(a => a.id === act.id ? act : a) : [...prev, act] };
      });
    } else {
      // Canonical home: dayFrom for hotel/multiday, else modal's dayIdx
      const home = (act.category === "hotel" || act.multiDay) ? act.dayFrom : (modal?.dayIdx ?? activeDay);
      setState(s => ({
        ...s,
        days: s.days.map((d, i) => {
          const without = d.activities.filter(a => a.id !== act.id);
          return i === home ? { ...d, activities: [...without, act] } : { ...d, activities: without };
        }),
      }));
    }
    setModal(null);
  };

  const deleteActivity = (actId, isPre = false) => {
    if (isPre) {
      setState(s => ({ ...s, preActivities: s.preActivities.filter(a => a.id !== actId) }));
    } else {
      setState(s => ({ ...s, days: s.days.map(d => ({ ...d, activities: d.activities.filter(a => a.id !== actId) })) }));
    }
  };

  const openEdit = (act) => {
    const isPre = act.category === "pre";
    const home = isPre ? 0 : (act.category === "hotel" || act.multiDay) ? act.dayFrom : activeDay;
    // Find original (un-expanded) from days store
    const orig = isPre
      ? preActivities.find(a => a.id === act.id) ?? act
      : days.flatMap(d => d.activities).find(a => a.id === act.id) ?? act;
    setModal({ act: orig, dayIdx: home, isPre });
  };

  // Per-day cost
  const dayCost = (di) => {
    const exp = expandedDays[di];
    if (!exp) return mealBudget;
    return exp.activities.reduce((s, a) => s + (a._displayCost || 0), 0) + mealBudget;
  };

  const currentExpDay = expandedDays[activeDay] ?? { activities: [] };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#F4F7F8",
      fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif", color: "#2C3E50",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 2px 14px rgba(74,155,171,0.25)",
      }}>
        <span style={{ fontSize: 22 }}>🗺️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: 0.3 }}>旅行规划师</div>
          {destination && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>📍 {destination}</div>}
        </div>
        <button onClick={handleManualSave} style={{
          padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
          border: "1.5px solid rgba(255,255,255,0.6)",
          background: saveFlash ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
          color: "#fff", transition: "background 0.2s",
        }}>
          {saveFlash ? "✅ 已保存" : "💾 保存"}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 14px" }}>

        {/* ── Setup row ── */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "13px 16px", marginBottom: 14,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        }}>
          <input value={destination} onChange={e => setField("destination", e.target.value)}
            placeholder="目的地（如：京都、巴黎…）"
            style={{ ...inputStyle, flex: "2 1 140px", width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 130px" }}>
            <span style={{ fontSize: 12, color: "#8E9BAD", whiteSpace: "nowrap" }}>出发</span>
            <input type="date" value={startDate} onChange={e => setField("startDate", e.target.value)}
              style={{ ...inputStyle, flex: 1, width: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 1 170px" }}>
            <span style={{ fontSize: 12, color: "#E8856A", whiteSpace: "nowrap" }}>🍜 每日餐饮</span>
            <NumInput value={mealBudget} onChange={v => setField("mealBudget", v)} style={{ width: 64, flex: "none" }} />
            <span style={{ fontSize: 12, color: "#8E9BAD" }}>¥</span>
          </div>
        </div>

        {/* ── Mobile panel toggle (visible <640px) ── */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 12,
        }}>
          {/* Left nav: days / pre */}
          <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => { setActiveMain("days"); setRightPanel("itinerary"); }} style={{
              padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: activeMain === "days" && rightPanel === "itinerary" ? "none" : "1.5px solid #DDE3EA",
              background: activeMain === "days" && rightPanel === "itinerary" ? "#4A9BAB" : "#fff",
              color: activeMain === "days" && rightPanel === "itinerary" ? "#fff" : "#5A6A7A",
              fontWeight: activeMain === "days" && rightPanel === "itinerary" ? 700 : 400,
            }}>📅 行程</button>

            <button onClick={() => { setActiveMain("pre"); setRightPanel("itinerary"); }} style={{
              padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: activeMain === "pre" && rightPanel === "itinerary" ? "none" : "1.5px solid #DDE3EA",
              background: activeMain === "pre" && rightPanel === "itinerary" ? "#5A8AAE" : "#fff",
              color: activeMain === "pre" && rightPanel === "itinerary" ? "#fff" : "#5A6A7A",
              fontWeight: activeMain === "pre" && rightPanel === "itinerary" ? 700 : 400,
            }}>
              🧳 出发前
              {preActivities.length > 0 && (
                <span style={{
                  marginLeft: 5, background: "#5A8AAE", color: "#fff",
                  borderRadius: 10, padding: "0 5px", fontSize: 10,
                }}>{preActivities.length}</span>
              )}
            </button>

            <button onClick={() => setRightPanel(p => p === "summary" ? "itinerary" : "summary")} style={{
              padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: rightPanel === "summary" ? "none" : "1.5px solid #DDE3EA",
              background: rightPanel === "summary" ? "#7BAE8C" : "#fff",
              color: rightPanel === "summary" ? "#fff" : "#5A6A7A",
              fontWeight: rightPanel === "summary" ? 700 : 400,
            }}>💰 支出总览</button>
          </div>
        </div>

        {/* ── Day tabs (only when in days mode) ── */}
        {activeMain === "days" && rightPanel === "itinerary" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            {days.map((d, i) => (
              <button key={d.id} onClick={() => setActiveDay(i)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: activeDay === i ? "none" : "1.5px solid #DDE3EA",
                background: activeDay === i ? "linear-gradient(135deg,#4A9BAB,#7BAE8C)" : "#fff",
                color: activeDay === i ? "#fff" : "#5A6A7A",
                fontWeight: activeDay === i ? 700 : 400,
                boxShadow: activeDay === i ? "0 2px 8px #4A9BAB33" : "none",
              }}>{dayDate(i)}</button>
            ))}
            <button onClick={addDay} style={{
              padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: "1.5px dashed #4A9BAB", background: "#E8F4F7", color: "#2A7A8A", fontWeight: 600,
            }}>+ 天</button>
            {days.length > 0 && (
              <button onClick={() => removeDay(activeDay)} style={{
                padding: "5px 9px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: "1.5px solid #E8856A44", background: "#FDF0EC", color: "#C5593A",
              }}>🗑</button>
            )}
          </div>
        )}

        {/* ── Main grid: left content + right summary (desktop) ── */}
        {rightPanel === "summary" ? (
          /* Full-width summary panel when toggled */
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <SummaryPanel expandedDays={expandedDays} preActivities={preActivities} mealBudget={mealBudget} />

            {days.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#8E9BAD", marginBottom: 8 }}>各天花销</div>
                {days.map((_, i) => (
                  <div key={i} onClick={() => { setActiveDay(i); setActiveMain("days"); setRightPanel("itinerary"); }} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 10px", borderRadius: 9, cursor: "pointer",
                    background: i === activeDay ? "#E8F4F7" : "transparent", marginBottom: 3,
                  }}>
                    <span style={{ fontSize: 13, color: i === activeDay ? "#2A7A8A" : "#5A6A7A" }}>{dayDate(i)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: i === activeDay ? "#4A9BAB" : "#8E9BAD" }}>¥{dayCost(i).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 14,
          }}>
            {/* Wrap in a container that goes two-col on wider screens via inline media */}
            <style>{`
              @media (min-width: 680px) {
                .planner-grid { grid-template-columns: 1fr 260px !important; }
              }
            `}</style>
            <div className="planner-grid" style={{
              display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start",
            }}>
              {/* ── Left: itinerary content ── */}
              <div>
                {activeMain === "pre" ? (
                  /* Pre-trip panel */
                  <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>🧳 出发前费用</div>
                        <div style={{ fontSize: 11, color: "#8E9BAD", marginTop: 2 }}>签证、装备、预购票等不归属某一天的花费</div>
                      </div>
                      <button onClick={() => setModal({ act: null, dayIdx: 0, isPre: true })} style={{
                        padding: "7px 13px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#5A8AAE,#4A9BAB)",
                        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>+ 添加</button>
                    </div>
                    {preActivities.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#ccc", padding: "28px 0", fontSize: 13 }}>还没有出发前费用记录 ✈️</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {preActivities.map(act => (
                          <div key={act.id} style={{
                            background: "#F7FAFC", borderRadius: 11, padding: "10px 13px",
                            border: "1px solid #5A8AAE30", display: "flex", alignItems: "center", gap: 10,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{act.title}</span>
                                <Tag cat="pre" />
                              </div>
                              {act.note && <div style={{ fontSize: 11, color: "#9AA8B5", marginTop: 2 }}>{act.note}</div>}
                              {act.cost > 0 && <div style={{ fontSize: 12, color: "#2A5A7A", fontWeight: 500, marginTop: 3 }}>¥{act.cost.toLocaleString()}</div>}
                            </div>
                            <button onClick={() => openEdit(act)} style={iconBtnStyle("#4A9BAB")}>✏️</button>
                            <button onClick={() => deleteActivity(act.id, true)} style={iconBtnStyle("#E8856A")}>🗑️</button>
                          </div>
                        ))}
                        <div style={{ fontSize: 13, color: "#5A8AAE", fontWeight: 600, textAlign: "right", marginTop: 4 }}>
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
                  /* Day content */
                  <div>
                    <div style={{
                      background: "#fff", borderRadius: 14, padding: "13px 16px", marginBottom: 10,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                    }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{dayDate(activeDay)}</div>
                        <div style={{ fontSize: 12, color: "#8E9BAD", marginTop: 3 }}>
                          今日预计：<span style={{ color: "#4A9BAB", fontWeight: 700 }}>¥{dayCost(activeDay).toLocaleString()}</span>
                        </div>
                      </div>
                      <button onClick={() => setModal({ act: null, dayIdx: activeDay, isPre: false })} style={{
                        padding: "7px 14px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
                        color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      }}>+ 添加行程</button>
                    </div>

                    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", minHeight: 160 }}>
                      <TimelineView
                        dayActivities={currentExpDay.activities}
                        mealBudget={mealBudget}
                        onEdit={openEdit}
                        onDelete={(id) => deleteActivity(id, false)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: summary (desktop, hidden on mobile via grid collapse) ── */}
              <div>
                <SummaryPanel expandedDays={expandedDays} preActivities={preActivities} mealBudget={mealBudget} />
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
                        <span style={{ fontSize: 12, color: i === activeDay && activeMain === "days" ? "#2A7A8A" : "#5A6A7A" }}>{dayDate(i)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: i === activeDay && activeMain === "days" ? "#4A9BAB" : "#8E9BAD" }}>¥{dayCost(i).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <ActivityModal
          initial={modal.isPre ? (modal.act ? { ...modal.act, category: "pre" } : { category: "pre" }) : modal.act}
          dayIdx={modal.dayIdx ?? activeDay}
          totalDays={Math.max(1, days.length)}
          onSave={saveActivity}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
