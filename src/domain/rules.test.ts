import { describe, expect, it, vi } from "vitest";

import { createMockState } from "@/data/mock";
import { balanceOf } from "./coins";
import { addDays, atTime, dayKey } from "./dates";
import { currentStreak } from "./progress";
import * as services from "./services";
import { countTasksForDay, isOverdue, type NewTaskInput } from "./tasks";
import type { AppState, DomainContext, Task } from "./types";
import { createLocalRepository, localRepository, migrateAppState } from "@/data/repository";

const NOW = new Date(2026, 9, 28, 10, 0, 0);
let n = 0;
const ctx = (): DomainContext => ({ now: NOW, newId: () => `test-${++n}` });
const ctxAt = (now: Date): DomainContext => ({ now, newId: () => `test-${++n}` });

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
  executionDate: dayKey(NOW),
  dueAt: atTime(NOW, 22).toISOString(),
  reward: 10,
  penalty: 5,
  ...over,
});

function must<T>(r: services.ServiceResult<T>) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

function createMemoryStorage(key: string, initialValue: string): Storage {
  const values = new Map([[key, initialValue]]);
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(name: string) { return values.get(name) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(name: string) { values.delete(name); },
    setItem(name: string, value: string) { values.set(name, String(value)); },
  };
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
    const r = services.createTask(
      s,
      input({ executionDate: dayKey(addDays(NOW, 1)), dueAt: atTime(addDays(NOW, 1), 22).toISOString() }),
      ctx(),
    );
    expect(r.ok).toBe(true);
  });

  it("按 executionDate 而不是 dueAt 统计名额", () => {
    let s = emptyState();
    for (let i = 0; i < 3; i++) {
      s = must(services.createTask(s, input({ dueAt: atTime(addDays(NOW, i), 22).toISOString() }), ctx())).state;
    }
    expect(countTasksForDay(s.tasks, "m-zhe", dayKey(NOW))).toBe(3);
    expect(
      services.createTask(
        s,
        input({ dueAt: atTime(addDays(NOW, 4), 22).toISOString() }),
        ctx(),
      ).ok,
    ).toBe(false);
    const nextExecutionDay = services.createTask(
      s,
      input({ executionDate: dayKey(addDays(NOW, 1)), dueAt: atTime(addDays(NOW, 4), 22).toISOString() }),
      ctx(),
    );
    expect(nextExecutionDay.ok).toBe(true);
  });

  it("executionDate 作为日历日期原样保存，不经 UTC 转换跨日", () => {
    const chosenDate = "2026-10-29";
    const created = must(services.createTask(emptyState(), input({ executionDate: chosenDate }), ctx()));
    expect(created.data.executionDate).toBe(chosenDate);
    expect(created.data.executionDate).not.toBe(created.data.createdAt);
    expect(created.data.executionDate).not.toBe(created.data.dueAt);
  });

  it("取消任务释放 executionDate 对应的名额", () => {
    let s = emptyState();
    const first = must(services.createTask(s, input(), ctx()));
    s = first.state;
    s = must(services.cancelTask({ ...s, currentUserId: first.data.creatorId }, first.data.id, ctx())).state;
    for (let i = 0; i < 3; i++) s = must(services.createTask(s, input(), ctx())).state;
    expect(countTasksForDay(s.tasks, "m-zhe", dayKey(NOW))).toBe(3);
    expect(services.createTask(s, input(), ctx()).ok).toBe(false);
  });
});

describe("个人每日任务上限", () => {
  it("成员上限取值为 1–10，超过个人上限时领域服务拒绝新任务", () => {
    const s = emptyState();
    const changed = must(services.setDailyTaskLimit({ ...s, currentUserId: "m-zhe" }, "m-zhe", 1));
    expect(changed.state.members.find((member) => member.id === "m-lin")?.dailyTaskLimit).toBe(3);
    const created = must(services.createTask(changed.state, input(), ctx()));
    const second = services.createTask(created.state, input(), ctx());
    expect(second.ok).toBe(false);
    expect(services.setDailyTaskLimit(changed.state, "m-zhe", 0).ok).toBe(false);
    expect(services.setDailyTaskLimit(changed.state, "m-zhe", 11).ok).toBe(false);
    expect(must(services.setDailyTaskLimit(changed.state, "m-zhe", 10)).data).toBe(10);
  });

  it("只能修改当前模拟身份对应成员的上限", () => {
    const s = emptyState();
    expect(services.setDailyTaskLimit(s, "m-zhe", 4).ok).toBe(false);
  });

  it("下调上限不删除或处罚已有任务，只阻止继续创建", () => {
    let s = emptyState();
    s = must(services.createTask(s, input(), ctx())).state;
    s = must(services.createTask(s, input(), ctx())).state;
    const beforeTasks = s.tasks.length;
    const beforeTransactions = s.transactions.length;
    const limited = must(services.setDailyTaskLimit({ ...s, currentUserId: "m-zhe" }, "m-zhe", 1));
    expect(limited.state.tasks).toHaveLength(beforeTasks);
    expect(limited.state.transactions).toHaveLength(beforeTransactions);
    expect(services.createTask(limited.state, input(), ctx()).ok).toBe(false);
  });

  it("旧 localStorage 数据缺失个人上限和执行日期时迁移为默认值且保留数据", () => {
    const legacy = createMockState(NOW) as AppState & { version: number };
    legacy.version = 1;
    legacy.members = legacy.members.map(({ dailyTaskLimit: _limit, ...member }) => member as AppState["members"][number]);
    legacy.tasks = legacy.tasks.map(({ executionDate: _date, ...task }) => task as Task);
    const migrated = migrateAppState(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.members.every((m) => m.dailyTaskLimit === 3)).toBe(true);
    expect(migrated.tasks).toHaveLength(legacy.tasks.length);
    expect(migrated.tasks[0]?.executionDate).toBe(dayKey(migrated.tasks[0]!.dueAt));
    expect(migrated.submissions).toHaveLength(legacy.submissions.length);
    expect(migrated.transactions).toHaveLength(legacy.transactions.length);
  });

  it("仓库加载版本 1 数据时保存迁移结果而非重置演示数据", async () => {
    const legacy = createMockState(NOW);
    legacy.version = 1;
    legacy.members = legacy.members.map(({ dailyTaskLimit: _limit, ...member }) => member as AppState["members"][number]);
    legacy.tasks = legacy.tasks.map(({ executionDate: _date, ...task }) => task as Task);
    const key = "yueding-plan:state";
    const previous = window.localStorage.getItem(key);
    window.localStorage.setItem(key, JSON.stringify(legacy));
    try {
      const loaded = await localRepository.load();
      expect(loaded.version).toBe(2);
      expect(loaded.tasks).toHaveLength(legacy.tasks.length);
      expect(loaded.members.every((member) => member.dailyTaskLimit === 3)).toBe(true);
      const persisted = JSON.parse(window.localStorage.getItem(key)!);
      expect(persisted.version).toBe(2);
      expect(persisted.tasks).toHaveLength(legacy.tasks.length);
    } finally {
      if (previous === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, previous);
    }
  });
});

describe("逾期显示和本地存储保护", () => {
  it("按时提交但超过截止时间仍待验收时不显示为执行人逾期", () => {
    const { s, task } = createAndSubmit();
    const afterDue = new Date(task.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);
    const submitted = s.tasks.find((item) => item.id === task.id)!;

    expect(submitted.status).toBe("submitted");
    expect(isOverdue(submitted, afterDue)).toBe(false);
  });

  it("未提交且已过截止时间仍显示为逾期", () => {
    const created = must(services.createTask(emptyState(), input(), ctx()));
    const afterDue = new Date(created.data.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);

    expect(isOverdue(created.data, afterDue)).toBe(true);
  });

  it("未知 localStorage 版本保留原文并阻止后续保存", async () => {
    const raw = JSON.stringify({ version: 999, privateData: "keep-this" });
    const storage = createMemoryStorage("yueding-plan:state", raw);
    const repository = createLocalRepository(storage);

    await expect(repository.load()).rejects.toThrow(/不支持.*版本|版本.*不支持/);
    await expect(repository.save(createMockState(NOW))).rejects.toThrow(/保护|写入/);
    expect(storage.getItem("yueding-plan:state")).toBe(raw);
  });

  it("无法解析的 localStorage 数据保留原文并阻止后续保存", async () => {
    const raw = "{ this is not valid JSON";
    const storage = createMemoryStorage("yueding-plan:state", raw);
    const repository = createLocalRepository(storage);

    await expect(repository.load()).rejects.toThrow(/无法解析|损坏|JSON/);
    await expect(repository.save(createMockState(NOW))).rejects.toThrow(/保护|写入/);
    expect(storage.getItem("yueding-plan:state")).toBe(raw);
  });

  it("数据版本正确但结构无效时也保留原文并阻止后续保存", async () => {
    const raw = JSON.stringify({ version: 2, members: null, tasks: null });
    const storage = createMemoryStorage("yueding-plan:state", raw);
    const repository = createLocalRepository(storage);

    await expect(repository.load()).rejects.toThrow(/结构无法读取/);
    await expect(repository.save(createMockState(NOW))).rejects.toThrow(/保护|写入/);
    expect(storage.getItem("yueding-plan:state")).toBe(raw);
  });
});

describe("重复任务快捷创建", () => {
  it("复制可复用字段但生成新任务，不带入提交、投票或金币结算", () => {
    const s = emptyState();
    const original = must(services.createTask(s, input({ title: "原任务", reward: 17, penalty: 8 }), ctx()));
    const withHistory: AppState = {
      ...original.state,
      tasks: original.state.tasks.map((t) => t.id === original.data.id ? { ...t, status: "approved" as const } : t),
      submissions: [{
        id: "old-submission",
        taskId: original.data.id,
        authorId: original.data.assigneeId,
        note: "历史证据",
        screenshots: [],
        createdAt: NOW.toISOString(),
        votes: [{ reviewerId: "m-tang", decision: "approve", createdAt: NOW.toISOString() }],
        outcome: "approved",
      }],
      transactions: [...original.state.transactions, {
        id: "old-reward",
        memberId: original.data.assigneeId,
        amount: 17,
        reason: "task_reward",
        taskId: original.data.id,
        note: "历史奖励",
        createdAt: NOW.toISOString(),
      }],
    };
    const executionDate = dayKey(addDays(NOW, 1));
    const dueAt = atTime(addDays(NOW, 1), 22).toISOString();
    const duplicated = must(services.duplicateTask(withHistory, {
      sourceTaskId: original.data.id,
      executionDate,
      dueAt,
    }, ctx()));

    expect(duplicated.data.id).not.toBe(original.data.id);
    expect(duplicated.data.status).toBe("in_progress");
    expect(duplicated.data.title).toBe(original.data.title);
    expect(duplicated.data.criteria).toBe(original.data.criteria);
    expect(duplicated.data.assigneeId).toBe(original.data.assigneeId);
    expect(duplicated.data.reviewerIds).toEqual(original.data.reviewerIds);
    expect(duplicated.data.reward).toBe(17);
    expect(duplicated.data.penalty).toBe(8);
    expect(duplicated.data.executionDate).toBe(executionDate);
    expect(duplicated.data.dueAt).toBe(dueAt);
    expect(duplicated.state.submissions).toHaveLength(1);
    expect(duplicated.state.transactions).toHaveLength(withHistory.transactions.length);
  });

  it("重复创建沿用任务校验，失败不留下部分任务或流水", () => {
    const s = emptyState();
    const original = must(services.createTask(s, input(), ctx()));
    const limited = must(services.setDailyTaskLimit({ ...original.state, currentUserId: "m-zhe" }, "m-zhe", 1));
    const result = services.duplicateTask(limited.state, {
      sourceTaskId: original.data.id,
      executionDate: dayKey(NOW),
      dueAt: atTime(NOW, 23).toISOString(),
    }, ctx());
    expect(result.ok).toBe(false);
    expect(limited.state.tasks).toHaveLength(1);
    expect(limited.state.transactions).toHaveLength(s.transactions.length);
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
    expect(r.state.tasks[0]?.status).toBe("approved");
  });

  it("判定未完成扣除约定惩罚 5 金币，且不会重复扣除", () => {
    const s = emptyState();
    const created = must(services.createTask(s, input(), ctx()));
    const task = created.data;
    const overdueAt = new Date(task.dueAt);
    overdueAt.setMinutes(overdueAt.getMinutes() + 1);
    const before = balanceOf(s.transactions, "m-zhe");
    const overdueState = { ...created.state, currentUserId: "m-tang" };
    const r = must(services.markFailed(overdueState, task.id, ctxAt(overdueAt)));
    expect(balanceOf(r.state.transactions, "m-zhe")).toBe(before - 5);
    expect(services.markFailed(r.state, task.id, ctxAt(overdueAt)).ok).toBe(false);
  });

  it("退回不影响金币，任务回到可重新提交状态", () => {
    const { s, task } = createAndSubmit();
    const before = balanceOf(s.transactions, "m-zhe");
    const r = must(
      services.reviewTask({ ...s, currentUserId: "m-tang" }, { taskId: task.id, decision: "reject", comment: "缺截图" }, ctx()),
    );
    expect(r.state.tasks[0]?.status).toBe("rejected");
    expect(balanceOf(r.state.transactions, "m-zhe")).toBe(before);
  });

  it("截止时间前，不能把尚未提交的任务判为失败", () => {
    const s = emptyState();
    const task = must(services.createTask(s, input(), ctx())).data;
    const before = balanceOf(s.transactions, task.assigneeId);
    const r = services.markFailed({ ...s, currentUserId: "m-tang" }, task.id, ctx());
    expect(r.ok).toBe(false);
    expect(balanceOf(s.transactions, task.assigneeId)).toBe(before);
  });

  it("按时提交后即使超过截止时间仍等待验收，不自动判失败或扣金币", () => {
    const { s, task } = createAndSubmit();
    const before = balanceOf(s.transactions, task.assigneeId);
    const afterDue = new Date(task.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);
    const r = must(services.settleOverdue(s, ctxAt(afterDue)));
    expect(r.data).toBe(0);
    expect(r.state.tasks.find((t) => t.id === task.id)?.status).toBe("submitted");
    expect(balanceOf(r.state.transactions, task.assigneeId)).toBe(before);
  });

  it("按时提交的任务可在截止时间后验收通过", () => {
    const { s, task } = createAndSubmit();
    const afterDue = new Date(task.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);
    const r = must(services.reviewTask(
      { ...s, currentUserId: "m-tang" },
      { taskId: task.id, decision: "approve" },
      ctxAt(afterDue),
    ));
    expect(r.data).toBe("approved");
    expect(r.state.tasks.find((t) => t.id === task.id)?.status).toBe("approved");
  });

  it("截止后仍未提交的任务可以失败结算", () => {
    const s = emptyState();
    const created = must(services.createTask(s, input(), ctx()));
    const task = created.data;
    const afterDue = new Date(task.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);
    const before = balanceOf(s.transactions, task.assigneeId);
    const r = must(services.settleOverdue(created.state, ctxAt(afterDue)));
    expect(r.data).toBe(1);
    expect(r.state.tasks.find((t) => t.id === task.id)?.status).toBe("failed");
    expect(balanceOf(r.state.transactions, task.assigneeId)).toBe(before - task.penalty);
  });

  it("截止时间后不能提交证据", () => {
    const s = emptyState();
    const task = must(services.createTask(s, input(), ctx())).data;
    const afterDue = new Date(task.dueAt);
    afterDue.setMinutes(afterDue.getMinutes() + 1);
    const r = services.submitEvidence(
      { ...s, currentUserId: task.assigneeId },
      { taskId: task.id, note: "迟交", screenshots: [] },
      ctxAt(afterDue),
    );
    expect(r.ok).toBe(false);
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
      executionDate: dayKey(addDays(NOW, -daysAgo)),
      dueAt: atTime(addDays(NOW, -daysAgo), 20).toISOString(),
      status,
    });
    // 昨天达标、前天休息、大前天达标、第 4 天未完成
    const tasks = [mk(1, "approved"), mk(3, "approved"), mk(4, "failed")];
    expect(currentStreak(tasks, "m-zhe", NOW)).toBe(2);
  });
});
