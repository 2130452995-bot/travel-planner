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

const STORAGE_KEY = "travel_planner_v3";

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

// blank trip template
function blankTrip(name = "新旅行计划") {
  return { id: uid(), name, destination: "", startDate: "", days: [], preActivities: [], mealBudget: 150 };
}

// ─── Storage ──────────────────────────────────────────────────────────────────
function loadRoot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveRoot(root) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(root)); } catch {}
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

// ─── NumInput ─────────────────────────────────────────────────────────────────
function NumInput({ value, onChange, style = {} }) {
  const [raw, setRaw] = useState(value ? String(value) : "");
  useEffect(() => { setRaw(value ? String(value) : ""); }, [value]);
  return (
    <input
      type="text" inputMode="decimal" value={raw} placeholder="0"
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
          onChange(!isNaN(n) ? n : 0);
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
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "22px 24px", width: "min(440px, 94vw)",
        boxShadow: "0 10px 48px rgba(44,62,80,0.2)", maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#2C3E50" }}>{initial ? "编辑行程" : "添加行程"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa", lineHeight: 1 }}>×</button>
        </div>

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

        {isPre && (
          <Field label="费用 (¥)"><NumInput value={form.cost} onChange={v => set("cost", v)} /></Field>
        )}

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
                  <span style={{ color: "#bbb", flexShrink: 0 }}>→</span>
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

// ─── Timeline View ────────────────────────────────────────────────────────────
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

      {timed.length > 0 && (
        <div style={{ position: "relative", paddingLeft: 68 }}>
          <div style={{
            position: "absolute", left: 52, top: 6, bottom: 6, width: 2, borderRadius: 2,
            background: "linear-gradient(to bottom, #4A9BAB55, #7BAE8C33)",
          }} />
          {timed.map((act) => {
            const c = CAT[act.category] ?? CAT.other;
            return (
              <div key={act.id} style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: -68, width: 46, textAlign: "right", top: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.text, display: "block" }}>{act.time || "--:--"}</span>
                  {act.timeType === "approximate" && <span style={{ fontSize: 10, color: "#bbb" }}>约</span>}
                </div>
                <div style={{
                  position: "absolute", left: -20, top: 14,
                  width: 10, height: 10, borderRadius: "50%",
                  background: c.color, boxShadow: `0 0 0 3px ${c.color}25`,
                }} />
                <div style={{
                  marginBottom: 10, background: "#fff", borderRadius: 12,
                  border: `1px solid ${c.color}35`, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", overflow: "hidden",
                }}>
                  <div style={{ height: 3, background: c.color }} />
                  <div style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50" }}>{act.title}</span>
                        <Tag cat={act.category} />
                      </div>
                      {act.note && <div style={{ fontSize: 12, color: "#9AA8B5", marginBottom: 2 }}>{act.note}</div>}
                      {act._displayCost > 0 && (
                        <div style={{ fontSize: 12, color: c.text, fontWeight: 500 }}>
                          ¥{act._displayCost.toLocaleString()}
                          {act._costNote && <span style={{ color: "#bbb", fontWeight: 400 }}> {act._costNote}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
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

      {(allday.length > 0 || mealBudget > 0) && (
        <div style={{ marginTop: timed.length > 0 ? 14 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
                        ¥{act._displayCost.toLocaleString()}
                        {act._costNote && <span style={{ color: "#bbb", fontWeight: 400 }}> {act._costNote}</span>}
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
  expandedDays.forEach(d => d.activities.forEach(a => {
    byCat[a.category] = (byCat[a.category] || 0) + (a._displayCost || 0);
  }));
  byCat.food = (byCat.food || 0) + totalMeal;
  byCat.pre  = preActivities.reduce((s, a) => s + (a.cost || 0), 0);
  const grand = Object.values(byCat).reduce((s, v) => s + v, 0);

  return (
    <div style={{ background: "linear-gradient(140deg,#F7FAFB,#EAF4ED)", borderRadius: 16, padding: 18, border: "1px solid #D0E8DC" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#4A9BAB", marginBottom: 10 }}>💰 支出总览</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#2C3E50", lineHeight: 1 }}>¥{grand.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: "#8E9BAD", margin: "4px 0 14px" }}>{expandedDays.length} 天预计总花销</div>
      {Object.entries(CAT).map(([k, v]) => {
        const amt = byCat[k] || 0;
        if (!amt) return null;
        return (
          <div key={k} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: v.text }}>
                {v.icon} {v.label}
                {k === "food" && totalMeal > 0 && <span style={{ color: "#ccc", fontSize: 10, marginLeft: 4 }}>(含餐饮)</span>}
              </span>
              <span style={{ fontWeight: 700, color: "#2C3E50" }}>¥{amt.toLocaleString()}</span>
            </div>
            <div style={{ height: 4, background: "#E4EAE8", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: grand > 0 ? `${amt / grand * 100}%` : "0%", height: "100%", background: v.color, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trip List Screen ─────────────────────────────────────────────────────────
function TripListScreen({ trips, onSelect, onCreate, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(null); // trip id
  const [renameVal, setRenameVal] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const startRename = (trip) => { setRenaming(trip.id); setRenameVal(trip.name); };
  const commitRename = () => {
    if (renameVal.trim()) onRename(renaming, renameVal.trim());
    setRenaming(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7F8", fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)", padding: "18px 20px", boxShadow: "0 2px 14px rgba(74,155,171,0.25)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🗺️</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>旅行规划师</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>管理你的所有旅行计划</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3E50" }}>我的旅行</div>
          <button onClick={onCreate} style={{
            padding: "8px 18px", borderRadius: 20, border: "none",
            background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 10px #4A9BAB33",
          }}>+ 新建旅行</button>
        </div>

        {trips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#8E9BAD" }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>✈️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>还没有旅行计划</div>
            <div style={{ fontSize: 13, marginBottom: 24 }}>点击「新建旅行」开始规划你的第一次旅程</div>
            <button onClick={onCreate} style={{
              padding: "11px 28px", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>+ 新建旅行</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trips.map(trip => {
              const totalDays = trip.days.length;
              const totalActs = trip.days.reduce((s, d) => s + d.activities.length, 0) + trip.preActivities.length;
              return (
                <div key={trip.id} style={{
                  background: "#fff", borderRadius: 16, overflow: "hidden",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  border: "1px solid #E8EDF2",
                }}>
                  {/* Accent bar */}
                  <div style={{ height: 4, background: "linear-gradient(90deg,#4A9BAB,#7BAE8C)" }} />
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => onSelect(trip.id)} style={{ flex: 1, cursor: "pointer" }}>
                      {renaming === trip.id ? (
                        <input
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                          autoFocus
                          style={{ ...inputStyle, fontSize: 15, fontWeight: 700, padding: "5px 9px" }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div onClick={() => onSelect(trip.id)} style={{ cursor: "pointer" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3E50", marginBottom: 4 }}>
                            {trip.destination ? `📍 ${trip.destination}` : trip.name}
                          </div>
                          {trip.destination && trip.name !== trip.destination && (
                            <div style={{ fontSize: 11, color: "#8E9BAD", marginBottom: 4 }}>{trip.name}</div>
                          )}
                          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#8E9BAD", flexWrap: "wrap" }}>
                            {trip.startDate && <span>🗓 {new Date(trip.startDate + "T00:00:00").toLocaleDateString("zh-CN", { month: "short", day: "numeric" })} 出发</span>}
                            <span>📅 {totalDays} 天</span>
                            <span>📌 {totalActs} 项行程</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startRename(trip)} style={iconBtnStyle("#4A9BAB")} title="重命名">✏️</button>
                      <button onClick={() => setConfirmDel(trip.id)} style={iconBtnStyle("#E8856A")} title="删除">🗑️</button>
                    </div>
                    <button onClick={() => onSelect(trip.id)} style={{
                      padding: "7px 14px", borderRadius: 10, border: "none",
                      background: "#E8F4F7", color: "#2A7A8A", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}>打开 →</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDel && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(44,62,80,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
        }}>
          <div style={{
            background: "#fff", borderRadius: 18, padding: "24px 28px", width: "min(340px, 90vw)",
            boxShadow: "0 8px 40px rgba(44,62,80,0.18)", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3E50", marginBottom: 6 }}>确认删除？</div>
            <div style={{ fontSize: 13, color: "#8E9BAD", marginBottom: 20 }}>删除后无法恢复，所有行程数据将丢失。</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "1.5px solid #E0E0E0",
                background: "#fff", color: "#7A8A9A", fontSize: 14, cursor: "pointer",
              }}>取消</button>
              <button onClick={() => { onDelete(confirmDel); setConfirmDel(null); }} style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
                background: "#E8856A", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trip Editor Screen ───────────────────────────────────────────────────────
function TripEditor({ trip, onUpdate, onBack }) {
  const [activeDay, setActiveDay]   = useState(0);
  const [modal, setModal]           = useState(null);
  const [activeMain, setActiveMain] = useState("days");
  const [rightPanel, setRightPanel] = useState("itinerary");

  const { destination, startDate, days, preActivities, mealBudget } = trip;

  const setField = (k, v) => onUpdate({ ...trip, [k]: v });

  const dayDate = (idx) => {
    if (!startDate) return `第 ${idx + 1} 天`;
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + idx);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", weekday: "short" });
  };

  const addDay = () => {
    onUpdate({ ...trip, days: [...days, { id: uid(), activities: [] }] });
    setActiveDay(days.length);
    setActiveMain("days");
  };
  const removeDay = (idx) => {
    onUpdate({ ...trip, days: days.filter((_, i) => i !== idx) });
    setActiveDay(a => Math.max(0, a >= idx ? a - 1 : a));
  };

  const expandedDays = useMemo(() => days.map((d, di) => {
    const allHotels = days.flatMap(dd => dd.activities.filter(a => a.category === "hotel"));
    const direct = d.activities
      .filter(a => a.category !== "hotel")
      .filter(a => !a.multiDay || (a.dayFrom <= di && a.dayTo >= di))
      .map(a => {
        if (!a.multiDay) return { ...a, _displayCost: a.cost || 0 };
        const span = Math.max(1, a.dayTo - a.dayFrom + 1);
        const perDay = a.costMode === "perday" ? (a.cost || 0) : (a.cost || 0) / span;
        return { ...a, _displayCost: Math.round(perDay * 100) / 100, _costNote: a.costMode === "perday" ? "/天" : `(总¥${a.cost}平摊)` };
      });
    const hotelSlices = allHotels
      .filter(h => h.dayFrom <= di && h.dayTo >= di)
      .map(h => ({ ...h, timeType: "allday", _displayCost: h.hotelNightCost || 0, _costNote: "/晚", _injected: true }));
    return { ...d, activities: [...direct, ...hotelSlices] };
  }), [days]);

  const saveActivity = (act) => {
    if (act.category === "pre") {
      const prev = preActivities;
      const idx = prev.findIndex(a => a.id === act.id);
      onUpdate({ ...trip, preActivities: idx >= 0 ? prev.map(a => a.id === act.id ? act : a) : [...prev, act] });
    } else {
      const home = (act.category === "hotel" || act.multiDay) ? act.dayFrom : (modal?.dayIdx ?? activeDay);
      onUpdate({
        ...trip,
        days: days.map((d, i) => {
          const without = d.activities.filter(a => a.id !== act.id);
          return i === home ? { ...d, activities: [...without, act] } : { ...d, activities: without };
        }),
      });
    }
    setModal(null);
  };

  const deleteActivity = (actId, isPre = false) => {
    if (isPre) {
      onUpdate({ ...trip, preActivities: preActivities.filter(a => a.id !== actId) });
    } else {
      onUpdate({ ...trip, days: days.map(d => ({ ...d, activities: d.activities.filter(a => a.id !== actId) })) });
    }
  };

  const openEdit = (act) => {
    const isPre = act.category === "pre";
    const home = isPre ? 0 : (act.category === "hotel" || act.multiDay) ? act.dayFrom : activeDay;
    const orig = isPre
      ? preActivities.find(a => a.id === act.id) ?? act
      : days.flatMap(d => d.activities).find(a => a.id === act.id) ?? act;
    setModal({ act: orig, dayIdx: home, isPre });
  };

  const dayCost = (di) => {
    const exp = expandedDays[di];
    if (!exp) return mealBudget;
    return exp.activities.reduce((s, a) => s + (a._displayCost || 0), 0) + mealBudget;
  };

  const currentExpDay = expandedDays[activeDay] ?? { activities: [] };

  const SummaryContent = () => (
    <>
      <SummaryPanel expandedDays={expandedDays} preActivities={preActivities} mealBudget={mealBudget} />
      {days.length > 1 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginTop: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8E9BAD", marginBottom: 8 }}>各天花销</div>
          {days.map((_, i) => (
            <div key={i} onClick={() => { setActiveDay(i); setActiveMain("days"); setRightPanel("itinerary"); }} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 8px", borderRadius: 8, cursor: "pointer",
              background: i === activeDay && activeMain === "days" ? "#E8F4F7" : "transparent", marginBottom: 2,
            }}>
              <span style={{ fontSize: 12, color: i === activeDay && activeMain === "days" ? "#2A7A8A" : "#5A6A7A" }}>{dayDate(i)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: i === activeDay && activeMain === "days" ? "#4A9BAB" : "#8E9BAD" }}>¥{dayCost(i).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7F8", fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif", color: "#2C3E50" }}>
      <style>{`@media (min-width: 680px) { .planner-grid { grid-template-columns: 1fr 260px !important; } }`}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4A9BAB,#7BAE8C)", padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 14px rgba(74,155,171,0.25)" }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.5)",
          borderRadius: 10, padding: "6px 12px", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600,
        }}>← 返回</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{destination || trip.name}</div>
          {destination && trip.name !== destination && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{trip.name}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 14px" }}>
        {/* Setup */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12,
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <input value={destination} onChange={e => setField("destination", e.target.value)}
            placeholder="目的地（如：京都、巴黎…）"
            style={{ ...inputStyle, flex: "2 1 130px", width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 120px" }}>
            <span style={{ fontSize: 12, color: "#8E9BAD", whiteSpace: "nowrap" }}>出发</span>
            <input type="date" value={startDate} onChange={e => setField("startDate", e.target.value)}
              style={{ ...inputStyle, flex: 1, width: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: "0 1 160px" }}>
            <span style={{ fontSize: 12, color: "#E8856A", whiteSpace: "nowrap" }}>🍜 每日餐饮</span>
            <NumInput value={mealBudget} onChange={v => setField("mealBudget", v)} style={{ width: 58, flex: "none" }} />
            <span style={{ fontSize: 12, color: "#8E9BAD" }}>¥</span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => { setActiveMain("days"); setRightPanel("itinerary"); }} style={{
            padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: activeMain === "days" && rightPanel !== "summary" ? "none" : "1.5px solid #DDE3EA",
            background: activeMain === "days" && rightPanel !== "summary" ? "#4A9BAB" : "#fff",
            color: activeMain === "days" && rightPanel !== "summary" ? "#fff" : "#5A6A7A",
            fontWeight: activeMain === "days" && rightPanel !== "summary" ? 700 : 400,
          }}>📅 行程</button>

          <button onClick={() => { setActiveMain("pre"); setRightPanel("itinerary"); }} style={{
            padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
            border: activeMain === "pre" && rightPanel !== "summary" ? "none" : "1.5px solid #DDE3EA",
            background: activeMain === "pre" && rightPanel !== "summary" ? "#5A8AAE" : "#fff",
            color: activeMain === "pre" && rightPanel !== "summary" ? "#fff" : "#5A6A7A",
            fontWeight: activeMain === "pre" && rightPanel !== "summary" ? 700 : 400,
          }}>
            🧳 出发前
            {preActivities.length > 0 && (
              <span style={{ marginLeft: 5, background: activeMain === "pre" && rightPanel !== "summary" ? "rgba(255,255,255,0.35)" : "#5A8AAE", color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: 10 }}>{preActivities.length}</span>
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

        {/* Day tabs */}
        {activeMain === "days" && rightPanel !== "summary" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
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

        {/* Content */}
        {rightPanel === "summary" ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <SummaryContent />
          </div>
        ) : (
          <div className="planner-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" }}>
            {/* Left */}
            <div>
              {activeMain === "pre" ? (
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
                <div>
                  <div style={{
                    background: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 10,
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

            {/* Right (desktop) */}
            <div><SummaryContent /></div>
          </div>
        )}
      </div>

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

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [root, setRoot] = useState(() => {
    const saved = loadRoot();
    if (saved && saved.trips) return saved;
    return { trips: [], activeId: null };
  });

  // Persist every change
  useEffect(() => { saveRoot(root); }, [root]);

  const { trips, activeId } = root;
  const activeTrip = trips.find(t => t.id === activeId) ?? null;

  const createTrip = () => {
    const t = blankTrip("新旅行计划");
    setRoot(r => ({ trips: [...r.trips, t], activeId: t.id }));
  };

  const selectTrip = (id) => setRoot(r => ({ ...r, activeId: id }));
  const goBack = () => setRoot(r => ({ ...r, activeId: null }));

  const updateTrip = (updated) => {
    setRoot(r => ({ ...r, trips: r.trips.map(t => t.id === updated.id ? updated : t) }));
  };

  const deleteTrip = (id) => {
    setRoot(r => ({
      trips: r.trips.filter(t => t.id !== id),
      activeId: r.activeId === id ? null : r.activeId,
    }));
  };

  const renameTrip = (id, name) => {
    setRoot(r => ({ ...r, trips: r.trips.map(t => t.id === id ? { ...t, name } : t) }));
  };

  if (activeTrip) {
    return <TripEditor trip={activeTrip} onUpdate={updateTrip} onBack={goBack} />;
  }

  return (
    <TripListScreen
      trips={trips}
      onSelect={selectTrip}
      onCreate={createTrip}
      onDelete={deleteTrip}
      onRename={renameTrip}
    />
  );
}
