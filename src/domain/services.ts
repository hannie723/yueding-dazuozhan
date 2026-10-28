/**
 * 业务操作（纯函数）：输入当前状态，输出新状态 + 领域事件。
 * 前端 store 和未来的服务端函数都可以复用这一层。
 */
import { alreadySettled, penaltyFor, rewardFor } from "./coins";
import type { DomainEvent } from "./events";
import { addVote, buildSubmission, canVote, latestSubmission, resolveVotes } from "./submissions";
import {
  buildTask,
  canCancel,
  canMarkFailed,
  canSubmit,
  isOverdue,
  validateNewTask,
  type NewTaskErrors,
  type NewTaskInput,
} from "./tasks";
import type {
  AppState,
  CoinTransaction,
  DomainContext,
  ReviewDecision,
  Screenshot,
  Task,
} from "./types";

export type ServiceResult<T = undefined> =
  | { ok: true; state: AppState; events: DomainEvent[]; data: T }
  | { ok: false; error: string; fieldErrors?: NewTaskErrors };

function fail(error: string, fieldErrors?: NewTaskErrors): { ok: false; error: string; fieldErrors?: NewTaskErrors } {
  return { ok: false, error, fieldErrors };
}

function replaceTask(state: AppState, task: Task): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
}

function findTask(state: AppState, taskId: string) {
  return state.tasks.find((t) => t.id === taskId);
}

/* ---------- 创建任务 ---------- */
export function createTask(
  state: AppState,
  input: NewTaskInput,
  ctx: DomainContext,
): ServiceResult<Task> {
  const errors = validateNewTask(state, input, ctx.now);
  if (Object.keys(errors).length > 0) return fail("请检查表单中的提示", errors);
  const task = buildTask(input, {
    id: ctx.newId(),
    groupId: state.group.id,
    creatorId: state.currentUserId,
    now: ctx.now,
  });
  return {
    ok: true,
    state: { ...state, tasks: [task, ...state.tasks] },
    events: [{ type: "task.created", task }],
    data: task,
  };
}

/* ---------- 提交证据 ---------- */
export function submitEvidence(
  state: AppState,
  input: { taskId: string; note: string; screenshots: Screenshot[] },
  ctx: DomainContext,
): ServiceResult {
  const task = findTask(state, input.taskId);
  if (!task) return fail("任务不存在");
  if (!canSubmit(task, state.currentUserId)) return fail("只有执行人可以在任务进行中提交");
  if (!input.note.trim() && input.screenshots.length === 0)
    return fail("请填写完成说明或添加截图");
  const submission = buildSubmission({
    id: ctx.newId(),
    taskId: task.id,
    authorId: state.currentUserId,
    note: input.note,
    screenshots: input.screenshots,
    now: ctx.now,
  });
  const next: Task = { ...task, status: "submitted" };
  return {
    ok: true,
    state: { ...replaceTask(state, next), submissions: [submission, ...state.submissions] },
    events: [{ type: "task.submitted", task: next, submission }],
    data: undefined,
  };
}

/* ---------- 验收（单人或投票） ---------- */
export function reviewTask(
  state: AppState,
  input: { taskId: string; decision: ReviewDecision; comment?: string },
  ctx: DomainContext,
): ServiceResult<"approved" | "rejected" | "pending"> {
  const task = findTask(state, input.taskId);
  if (!task) return fail("任务不存在");
  const submission = latestSubmission(state.submissions, task.id);
  if (!canVote(task, submission, state.currentUserId) || !submission)
    return fail("你不是这项任务的验收人，或已经投过票");
  if (input.decision === "reject" && !input.comment?.trim())
    return fail("退回时请写一句原因，方便对方补充");

  let updated = addVote(submission, {
    reviewerId: state.currentUserId,
    decision: input.decision,
    comment: input.comment,
    now: ctx.now,
  });
  const result = resolveVotes(task, updated);
  const events: DomainEvent[] = [];
  let nextTask = task;
  let transactions = state.transactions;

  if (result === "approved") {
    updated = { ...updated, outcome: "approved" };
    nextTask = { ...task, status: "approved", resolvedAt: ctx.now.toISOString() };
    events.push({ type: "task.approved", task: nextTask });
    if (!alreadySettled(transactions, task.id)) {
      const tx = rewardFor(task, ctx.newId(), ctx.now);
      if (tx) {
        transactions = [tx, ...transactions];
        events.push({ type: "coins.changed", transaction: tx });
      }
    }
  } else if (result === "rejected") {
    updated = { ...updated, outcome: "rejected" };
    nextTask = { ...task, status: "rejected" };
    events.push({ type: "task.rejected", task: nextTask });
  } else {
    events.push({ type: "task.voted", task, submission: updated });
  }

  return {
    ok: true,
    state: {
      ...replaceTask(state, nextTask),
      submissions: state.submissions.map((s) => (s.id === updated.id ? updated : s)),
      transactions,
    },
    events,
    data: result,
  };
}

function applyFailure(state: AppState, task: Task, ctx: DomainContext) {
  const nextTask: Task = { ...task, status: "failed", resolvedAt: ctx.now.toISOString() };
  const events: DomainEvent[] = [{ type: "task.failed", task: nextTask }];
  let transactions: CoinTransaction[] = state.transactions;
  if (!alreadySettled(transactions, task.id)) {
    const tx = penaltyFor(task, ctx.newId(), ctx.now);
    if (tx) {
      transactions = [tx, ...transactions];
      events.push({ type: "coins.changed", transaction: tx });
    }
  }
  return { state: { ...replaceTask(state, nextTask), transactions }, events };
}

/* ---------- 判定未完成（扣除惩罚） ---------- */
export function markFailed(state: AppState, taskId: string, ctx: DomainContext): ServiceResult {
  const task = findTask(state, taskId);
  if (!task) return fail("任务不存在");
  if (!canMarkFailed(task, state.currentUserId)) return fail("只有发起人或验收人可以判定未完成");
  const { state: next, events } = applyFailure(state, task, ctx);
  return { ok: true, state: next, events, data: undefined };
}

/* ---------- 到期结算：所有逾期未通过的任务判为未完成 ---------- */
export function settleOverdue(state: AppState, ctx: DomainContext): ServiceResult<number> {
  const overdue = state.tasks.filter((t) => isOverdue(t, ctx.now));
  let next = state;
  const events: DomainEvent[] = [];
  for (const task of overdue) {
    const r = applyFailure(next, task, ctx);
    next = r.state;
    events.push(...r.events);
  }
  return { ok: true, state: next, events, data: overdue.length };
}

/* ---------- 取消任务 ---------- */
export function cancelTask(state: AppState, taskId: string, ctx: DomainContext): ServiceResult {
  const task = findTask(state, taskId);
  if (!task) return fail("任务不存在");
  if (!canCancel(task, state.currentUserId)) return fail("只有发起人可以在提交前取消任务");
  const next: Task = { ...task, status: "cancelled", resolvedAt: ctx.now.toISOString() };
  return {
    ok: true,
    state: replaceTask(state, next),
    events: [{ type: "task.cancelled", task: next }],
    data: undefined,
  };
}
