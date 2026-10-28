/** 本地日期 key：YYYY-MM-DD */
export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function atTime(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** 本周一至周日的日期 */
export function weekDays(today: Date): Date[] {
  const d = atTime(today, 12);
  const weekday = (d.getDay() + 6) % 7; // 周一 = 0
  const monday = addDays(d, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 友好的时间显示：今天 22:00 / 明天 12:00 / 10月28日 09:00 */
export function formatDue(iso: string, now: Date): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const key = dayKey(d);
  if (key === dayKey(now)) return `今天 ${time}`;
  if (key === dayKey(addDays(now, 1))) return `明天 ${time}`;
  if (key === dayKey(addDays(now, -1))) return `昨天 ${time}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

export function formatDateTime(iso: string, now: Date): string {
  return formatDue(iso, now);
}

/** 给 <input type="datetime-local"> 使用的本地时间字符串 */
export function toLocalInputValue(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
