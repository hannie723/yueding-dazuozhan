import { dayKey } from "./dates";
import type { AppState, MemberId, ReviewMode, Task, TaskStatus } from "./types";

export const DEFAULT_DAILY_TASK_LIMIT = 3;

export const STATUS_LABEL: Record<TaskStatus, string> = {
  in_progress: "进行中",
  submitted: "待验收",
  approved: "已完成",
  rejected: "已退回",
  failed: "未完成",
  cancelled: "已取消",
};

/** 任务是否还在流程中（未结算） */
export function isOpen(task: Task): boolean {
  return task.status === "in_progress" || task.status === "submitted" || task.status === "rejected";
}

export function isOverdue(task: Task, now: Date): boolean {
  return isOpen(task) && new Date(task.dueAt).getTime() < now.getTime();
}

/** 某人某天（按截止日期）收到的有效任务数，已取消的不计入 */
export function countTasksForDay(tasks: Task[], assigneeId: MemberId, day: string): number {
  return tasks.filter(
    (t) => t.assigneeId === assigneeId && t.status !== "cancelled" && dayKey(t.dueAt) === day,
  ).length;
}

export interface NewTaskInput {
  title: string;
  criteria: string;
  assigneeId: MemberId;
  reviewerIds: MemberId[];
  reviewMode: ReviewMode;
  dueAt: string;
  reward: number;
  penalty: number;
}

export type NewTaskErrors = Partial<Record<keyof NewTaskInput, string>>;

export function validateNewTask(
  state: Pick<AppState, "tasks" | "group" | "members">,
  input: NewTaskInput,
  now: Date,
): NewTaskErrors {
  const errors: NewTaskErrors = {};
  const memberIds = new Set(state.members.map((m) => m.id));

  if (!input.title.trim()) errors.title = "请填写任务名称";
  else if (input.title.trim().length > 30) errors.title = "任务名称最多 30 个字";

  if (!input.criteria.trim()) errors.criteria = "请写清楚怎样才算达标";

  if (!memberIds.has(input.assigneeId)) errors.assigneeId = "请选择执行人";

  const reviewers = input.reviewerIds.filter((id) => memberIds.has(id));
  if (reviewers.length === 0) {
    errors.reviewerIds = "请至少选择一位验收人";
  } else if (reviewers.includes(input.assigneeId)) {
    errors.reviewerIds = "执行人不能验收自己的任务";
  } else if (input.reviewMode === "single" && reviewers.length !== 1) {
    errors.reviewerIds = "单人验收只能选择一位验收人";
  } else if (input.reviewMode === "vote" && reviewers.length < 2) {
    errors.reviewerIds = "投票验收至少需要两位验收人";
  }

  const due = new Date(input.dueAt);
  if (!input.dueAt || Number.isNaN(due.getTime())) errors.dueAt = "请选择截止时间";
  else if (due.getTime() <= now.getTime()) errors.dueAt = "截止时间需要晚于现在";
  else if (!errors.assigneeId) {
    const limit = state.group.dailyTaskLimit;
    const count = countTasksForDay(state.tasks, input.assigneeId, dayKey(due));
    if (count >= limit) {
      errors.assigneeId = `该成员当天已有 ${count} 个任务，每人每天最多 ${limit} 个`;
    }
  }

  if (!Number.isInteger(input.reward) || input.reward < 0 || input.reward > 100)
    errors.reward = "奖励需为 0–100 之间的整数";
  if (!Number.isInteger(input.penalty) || input.penalty < 0 || input.penalty > 100)
    errors.penalty = "惩罚需为 0–100 之间的整数";

  return errors;
}

export function buildTask(
  input: NewTaskInput,
  meta: { id: string; groupId: string; creatorId: MemberId; now: Date },
): Task {
  return {
    id: meta.id,
    groupId: meta.groupId,
    title: input.title.trim(),
    criteria: input.criteria.trim(),
    creatorId: meta.creatorId,
    assigneeId: input.assigneeId,
    reviewerIds: [...new Set(input.reviewerIds)],
    reviewMode: input.reviewMode,
    dueAt: new Date(input.dueAt).toISOString(),
    reward: input.reward,
    penalty: input.penalty,
    status: "in_progress",
    createdAt: meta.now.toISOString(),
  };
}

/* ---------- 权限判断（接入登录后同样适用于服务端校验） ---------- */

export function canSubmit(task: Task, userId: MemberId): boolean {
  return task.assigneeId === userId && (task.status === "in_progress" || task.status === "rejected");
}

export function isReviewer(task: Task, userId: MemberId): boolean {
  return task.reviewerIds.includes(userId);
}

/** 发起人或验收人可以将任务判定为未完成 */
export function canMarkFailed(task: Task, userId: MemberId): boolean {
  return isOpen(task) && (task.creatorId === userId || isReviewer(task, userId));
}

/** 发起人可以在执行人提交前取消任务 */
export function canCancel(task: Task, userId: MemberId): boolean {
  return task.creatorId === userId && task.status === "in_progress";
}
