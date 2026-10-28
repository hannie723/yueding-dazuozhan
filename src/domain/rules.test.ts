import { describe, expect, it } from "vitest";

import { createMockState } from "@/data/mock";
import { balanceOf } from "./coins";
import { addDays, atTime } from "./dates";
import { currentStreak } from "./progress";
import * as services from "./services";
import type { NewTaskInput } from "./tasks";
import type { AppState, DomainContext, Task } from "./types";

const NOW = new Date(2026, 9, 28, 10, 0, 0);
let n = 0;
const ctx = (): DomainContext => ({ now: NOW, newId: () => `test-${++n}` });

function emptyState(): AppState {
  const s = createMockState(NOW);
  return { ...s, tasks: [], submissions: [], transactions: s.transactions.filter((t) => t.reason === "initial") };
}

const input = (over: Partial<NewTaskInput> = {}): NewTaskInput => ({
  title: "背单词",
  criteria: "打卡截图",
  assigneeId: "m-zhe",
  reviewerIds: ["m-tang"],
  reviewMode: "single",
  dueAt: atTime(NOW, 22).toISOString(),
  reward: 10,
  penalty: 5,
  ...over,
});

function must<T>(r: services.ServiceResult<T>) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("每人每天最多 3 个任务", () => {
  it("第 4 个同一天的任务会被拒绝", () => {
    let s = emptyState();
    for (let i = 0; i < 3; i++) s = must(services.createTask(s, input(), ctx())).state;
    const r = services.createTask(s, input(), ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.assigneeId).toContain("最多 3 个");
  });

  it("换一天就可以继续布置", () => {
    let s = emptyState();
    for (let i = 0; i < 3; i++) s = must(services.createTask(s, input(), ctx())).state;
    const r = services.createTask(s, input({ dueAt: atTime(addDays(NOW, 1), 22).toISOString() }), ctx());
    expect(r.ok).toBe(true);
  });
});

describe("验收人规则", () => {
  it("执行人不能验收自己的任务", () => {
    const r = services.createTask(emptyState(), input({ reviewerIds: ["m-zhe"] }), ctx());
    expect(r.ok).toBe(false);
  });
});

function createAndSubmit(over: Partial<NewTaskInput> = {}) {
  let s = emptyState();
  const created = must(services.createTask(s, input(over), ctx()));
  s = { ...created.state, currentUserId: created.data.assigneeId };
  s = must(services.submitEvidence(s, { taskId: created.data.id, note: "完成", screenshots: [] }, ctx())).state;
  return { s, task: created.data as Task };
}

describe("金币结算", () => {
  it("验收通过后执行人获得约定奖励 10 金币", () => {
    const { s, task } = createAndSubmit();
    const before = balanceOf(s.transactions, "m-zhe");
    const r = must(services.reviewTask({ ...s, currentUserId: "m-tang" }, { taskId: task.id, decision: "approve" }, ctx()));
    expect(balanceOf(r.state.transactions, "m-zhe")).toBe(before + 10);
    expect(r.state.tasks[0].status).toBe("approved");
  });

  it("判定未完成扣除约定惩罚 5 金币，且不会重复扣除", () => {
    const { s, task } = createAndSubmit();
    const before = balanceOf(s.transactions, "m-zhe");
    const r = must(services.markFailed({ ...s, currentUserId: "m-tang" }, task.id, ctx()));
    expect(balanceOf(r.state.transactions, "m-zhe")).toBe(before - 5);
    expect(services.markFailed(r.state, task.id, ctx()).ok).toBe(false);
  });

  it("退回不影响金币，任务回到可重新提交状态", () => {
    const { s, task } = createAndSubmit();
    const before = balanceOf(s.transactions, "m-zhe");
    const r = must(
      services.reviewTask({ ...s, currentUserId: "m-tang" }, { taskId: task.id, decision: "reject", comment: "缺截图" }, ctx()),
    );
    expect(r.state.tasks[0].status).toBe("rejected");
    expect(balanceOf(r.state.transactions, "m-zhe")).toBe(before);
  });
});

describe("多人投票验收：过半通过", () => {
  it("3 位验收人中 2 票通过才算完成", () => {
    const { s, task } = createAndSubmit({ reviewMode: "vote", reviewerIds: ["m-lin", "m-tang", "m-zhou"] });
    const r1 = must(services.reviewTask({ ...s, currentUserId: "m-lin" }, { taskId: task.id, decision: "approve" }, ctx()));
    expect(r1.data).toBe("pending");
    const r2 = must(services.reviewTask({ ...r1.state, currentUserId: "m-tang" }, { taskId: task.id, decision: "approve" }, ctx()));
    expect(r2.data).toBe("approved");
  });

  it("3 位验收人中 2 票退回即退回", () => {
    const { s, task } = createAndSubmit({ reviewMode: "vote", reviewerIds: ["m-lin", "m-tang", "m-zhou"] });
    const r1 = must(services.reviewTask({ ...s, currentUserId: "m-lin" }, { taskId: task.id, decision: "reject", comment: "不够" }, ctx()));
    const r2 = must(services.reviewTask({ ...r1.state, currentUserId: "m-tang" }, { taskId: task.id, decision: "reject", comment: "不够" }, ctx()));
    expect(r2.data).toBe("rejected");
  });
});

describe("连续达标天数", () => {
  it("休息日不中断，未完成会中断", () => {
    const mk = (daysAgo: number, status: Task["status"]): Task => ({
      ...must(services.createTask(emptyState(), input(), ctx())).data,
      id: `d${daysAgo}`,
      dueAt: atTime(addDays(NOW, -daysAgo), 20).toISOString(),
      status,
    });
    // 昨天达标、前天休息、大前天达标、第 4 天未完成
    const tasks = [mk(1, "approved"), mk(3, "approved"), mk(4, "failed")];
    expect(currentStreak(tasks, "m-zhe", NOW)).toBe(2);
  });
});
