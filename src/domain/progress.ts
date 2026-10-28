import { addDays, dayKey, weekDays } from "./dates";
import type { MemberId, Task } from "./types";

/**
 * 每日达标状态：
 * - met：当天截止的任务全部验收通过
 * - missed：当天有任务未完成（或已过去却未通过）
 * - pending：今天还有任务在进行中
 * - none：当天没有任务（休息日，不中断连续天数）
 * - future：还没到
 */
export type DayStatus = "met" | "missed" | "pending" | "none" | "future";

export function dayStatus(tasks: Task[], memberId: MemberId, day: Date, today: Date): DayStatus {
  const key = dayKey(day);
  const todayKey = dayKey(today);
  if (key > todayKey) return "future";
  const dayTasks = tasks.filter(
    (t) => t.assigneeId === memberId && t.status !== "cancelled" && dayKey(t.dueAt) === key,
  );
  if (dayTasks.length === 0) return "none";
  if (dayTasks.some((t) => t.status === "failed")) return "missed";
  if (dayTasks.every((t) => t.status === "approved")) return "met";
  return key === todayKey ? "pending" : "missed";
}

/** 连续达标天数：从今天往前数，休息日跳过，遇到未达标即停止 */
export function currentStreak(tasks: Task[], memberId: MemberId, today: Date, maxDays = 90): number {
  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const status = dayStatus(tasks, memberId, addDays(today, -i), today);
    if (status === "met") streak++;
    else if (status === "missed") break;
    // pending / none：不计入也不中断
  }
  return streak;
}

export function weekSummary(tasks: Task[], memberId: MemberId, today: Date) {
  const days = weekDays(today).map((date) => ({
    date,
    status: dayStatus(tasks, memberId, date, today),
  }));
  return {
    days,
    met: days.filter((d) => d.status === "met").length,
    missed: days.filter((d) => d.status === "missed").length,
  };
}
