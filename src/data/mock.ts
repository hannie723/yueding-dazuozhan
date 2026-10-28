/**
 * 模拟数据：以“现在”为基准生成最近一周的任务、提交和金币流水。
 * 金币流水由任务结果推导，保证余额与记录一致。
 */
import { initialGrant, penaltyFor, rewardFor } from "@/domain/coins";
import { addDays, atTime } from "@/domain/dates";
import type { AppState, Member, Submission, Task } from "@/domain/types";

export const STATE_VERSION = 1;

const members: Member[] = [
  { id: "m-lin", name: "小林", color: 1, bio: "考研冲刺中" },
  { id: "m-zhe", name: "阿哲", color: 2, bio: "每天一篇论文" },
  { id: "m-tang", name: "糖糖", color: 3, bio: "雅思 7 分！" },
  { id: "m-zhou", name: "小周", color: 4, bio: "算法刷题人" },
];

const HISTORY: Array<{ title: string; criteria: string }> = [
  { title: "背单词 50 个", criteria: "App 打卡截图，显示今日新学 50 词" },
  { title: "专业课一章笔记", criteria: "手写笔记拍照，至少 2 页" },
  { title: "英语听力 30 分钟", criteria: "播放记录截图，时长 ≥ 30 分钟" },
  { title: "刷 LeetCode 2 题", criteria: "提交记录截图，状态为通过" },
  { title: "阅读 20 页", criteria: "写 3 句读后感" },
];

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

export function createMockState(now: Date = new Date()): AppState {
  seq = 0;
  const tasks: Task[] = [];
  const submissions: Submission[] = [];
  const ids = members.map((m) => m.id);
  const reviewerFor = (assignee: string, offset = 1) =>
    ids[(ids.indexOf(assignee) + offset) % ids.length];

  /* 过去 6 天的历史任务 */
  for (let d = 6; d >= 1; d--) {
    const day = addDays(now, -d);
    members.forEach((m, mi) => {
      const count = (d + mi) % 3 === 0 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const tpl = HISTORY[(d + mi + k) % HISTORY.length];
        // 少数日子未完成，制造真实的连续天数差异
        const failed = (m.id === "m-tang" && d === 2) || (m.id === "m-zhou" && d === 4 && k === 0);
        const due = atTime(day, 21 + k, 30);
        const task: Task = {
          id: id("t"),
          groupId: "g-1",
          title: tpl.title,
          criteria: tpl.criteria,
          creatorId: k === 0 ? m.id : reviewerFor(m.id, 2),
          assigneeId: m.id,
          reviewerIds: [reviewerFor(m.id)],
          reviewMode: "single",
          dueAt: due.toISOString(),
          reward: 10,
          penalty: 5,
          status: failed ? "failed" : "approved",
          createdAt: atTime(day, 8).toISOString(),
          resolvedAt: atTime(day, 22 + k).toISOString(),
        };
        tasks.push(task);
        if (!failed) {
          submissions.push({
            id: id("s"),
            taskId: task.id,
            authorId: m.id,
            note: "已完成，截图见附件～",
            screenshots: [{ id: id("img"), label: "完成截图" }],
            createdAt: atTime(day, 20).toISOString(),
            votes: [
              {
                reviewerId: task.reviewerIds[0],
                decision: "approve",
                comment: "棒！",
                createdAt: atTime(day, 22).toISOString(),
              },
            ],
            outcome: "approved",
          });
        }
      }
    });
  }

  /* 今天的任务 */
  const today = (h: number, m = 0) => atTime(now, h, m).toISOString();
  const later = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();
  const earlier = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString();
  const tonight = new Date(Math.max(atTime(now, 23, 0).getTime(), now.getTime() + 2 * 3600_000)).toISOString();

  const t1: Task = {
    id: "t-today-1",
    groupId: "g-1",
    title: "背单词 50 个",
    criteria: "不背单词 App 打卡截图，显示今日新学 50 词",
    creatorId: "m-lin",
    assigneeId: "m-lin",
    reviewerIds: ["m-zhe"],
    reviewMode: "single",
    dueAt: tonight,
    reward: 10,
    penalty: 5,
    status: "in_progress",
    createdAt: today(8),
  };
  const t2: Task = {
    id: "t-today-2",
    groupId: "g-1",
    title: "数学第三章习题",
    criteria: "完成课后习题 1–20，拍照上传，正确率 ≥ 80%",
    creatorId: "m-zhe",
    assigneeId: "m-lin",
    reviewerIds: ["m-zhe", "m-tang", "m-zhou"],
    reviewMode: "vote",
    dueAt: tonight,
    reward: 20,
    penalty: 10,
    status: "submitted",
    createdAt: today(8, 30),
  };
  const t3: Task = {
    id: "t-today-3",
    groupId: "g-1",
    title: "精读英文论文 1 篇",
    criteria: "写 200 字中文摘要，并标出 3 个生词",
    creatorId: "m-zhe",
    assigneeId: "m-zhe",
    reviewerIds: ["m-lin"],
    reviewMode: "single",
    dueAt: later(5),
    reward: 15,
    penalty: 5,
    status: "submitted",
    createdAt: today(9),
  };
  const t4: Task = {
    id: "t-today-4",
    groupId: "g-1",
    title: "雅思听力 Section 3",
    criteria: "完成一套 Section 3，对答案后截图，错题 ≤ 3",
    creatorId: "m-lin",
    assigneeId: "m-tang",
    reviewerIds: ["m-lin"],
    reviewMode: "single",
    dueAt: tonight,
    reward: 10,
    penalty: 5,
    status: "rejected",
    createdAt: today(9),
  };
  const t5: Task = {
    id: "t-today-5",
    groupId: "g-1",
    title: "LeetCode 动态规划 2 题",
    criteria: "两道中等难度题目，提交状态为通过",
    creatorId: "m-zhou",
    assigneeId: "m-zhou",
    reviewerIds: ["m-lin", "m-zhe", "m-tang"],
    reviewMode: "vote",
    dueAt: later(6),
    reward: 15,
    penalty: 5,
    status: "submitted",
    createdAt: today(10),
  };
  const t6: Task = {
    id: "t-today-6",
    groupId: "g-1",
    title: "整理本周错题本",
    criteria: "错题本拍照，至少 10 道题",
    creatorId: "m-tang",
    assigneeId: "m-zhou",
    reviewerIds: ["m-tang"],
    reviewMode: "single",
    dueAt: tonight,
    reward: 10,
    penalty: 5,
    status: "approved",
    createdAt: today(7),
    resolvedAt: earlier(0.5),
  };
  const t7: Task = {
    id: "t-today-7",
    groupId: "g-1",
    title: "早起打卡",
    criteria: "早上 7:30 前在群里发起床照",
    creatorId: "m-zhou",
    assigneeId: "m-zhe",
    reviewerIds: ["m-zhou"],
    reviewMode: "single",
    dueAt: earlier(0.25),
    reward: 5,
    penalty: 5,
    status: "in_progress",
    createdAt: earlier(12),
  };
  tasks.push(t1, t2, t3, t4, t5, t6, t7);

  submissions.push(
    {
      id: "s-today-2",
      taskId: t2.id,
      authorId: "m-lin",
      note: "20 题全部做完，错了 3 题已订正，正确率 85%。",
      screenshots: [
        { id: "img-a", label: "习题第 1 页" },
        { id: "img-b", label: "习题第 2 页" },
      ],
      createdAt: earlier(1),
      votes: [
        { reviewerId: "m-tang", decision: "approve", comment: "字好工整！", createdAt: earlier(0.6) },
      ],
    },
    {
      id: "s-today-3",
      taskId: t3.id,
      authorId: "m-zhe",
      note: "读的是 Attention Is All You Need，摘要和生词都写在笔记里了。",
      screenshots: [{ id: "img-c", label: "笔记截图" }],
      createdAt: earlier(0.8),
      votes: [],
    },
    {
      id: "s-today-4",
      taskId: t4.id,
      authorId: "m-tang",
      note: "做完啦～",
      screenshots: [],
      createdAt: earlier(3),
      votes: [
        {
          reviewerId: "m-lin",
          decision: "reject",
          comment: "没有看到对答案的截图哦，补一张吧",
          createdAt: earlier(2.5),
        },
      ],
      outcome: "rejected",
    },
    {
      id: "s-today-5",
      taskId: t5.id,
      authorId: "m-zhou",
      note: "322 零钱兑换 + 300 最长递增子序列，都一次通过。",
      screenshots: [{ id: "img-d", label: "提交记录" }],
      createdAt: earlier(0.7),
      votes: [{ reviewerId: "m-zhe", decision: "approve", createdAt: earlier(0.4) }],
    },
    {
      id: "s-today-6",
      taskId: t6.id,
      authorId: "m-zhou",
      note: "整理了 12 道题。",
      screenshots: [{ id: "img-e", label: "错题本" }],
      createdAt: earlier(1.5),
      votes: [{ reviewerId: "m-tang", decision: "approve", comment: "很认真！", createdAt: earlier(0.5) }],
      outcome: "approved",
    },
  );

  /* 由任务结果推导金币流水 */
  const start = addDays(atTime(now, 8), -7);
  const transactions = members.map((m) => initialGrant(m.id, id("c"), start));
  for (const t of tasks) {
    const at = new Date(t.resolvedAt ?? t.dueAt);
    if (t.status === "approved") {
      const tx = rewardFor(t, id("c"), at);
      if (tx) transactions.push(tx);
    } else if (t.status === "failed") {
      const tx = penaltyFor(t, id("c"), at);
      if (tx) transactions.push(tx);
    }
  }

  return {
    version: STATE_VERSION,
    group: {
      id: "g-1",
      name: "四人自习室",
      motto: "说好的事，一起做到",
      memberIds: ids,
      dailyTaskLimit: 3,
    },
    members,
    tasks,
    submissions,
    transactions,
    currentUserId: "m-lin",
  };
}
