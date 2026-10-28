import type { CoinTransaction, MemberId, Task } from "./types";

export const INITIAL_COINS = 100;

export function balanceOf(transactions: CoinTransaction[], memberId: MemberId): number {
  return transactions
    .filter((t) => t.memberId === memberId)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function transactionsOf(transactions: CoinTransaction[], memberId: MemberId): CoinTransaction[] {
  return transactions
    .filter((t) => t.memberId === memberId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function initialGrant(memberId: MemberId, id: string, at: Date): CoinTransaction {
  return {
    id,
    memberId,
    amount: INITIAL_COINS,
    reason: "initial",
    note: "加入小组的启动金币",
    createdAt: at.toISOString(),
  };
}

/** 验收通过：执行人获得奖励 */
export function rewardFor(task: Task, id: string, at: Date): CoinTransaction | null {
  if (task.reward <= 0) return null;
  return {
    id,
    memberId: task.assigneeId,
    amount: task.reward,
    reason: "task_reward",
    taskId: task.id,
    note: `完成「${task.title}」`,
    createdAt: at.toISOString(),
  };
}

/** 判定未完成：执行人被扣除约定金币 */
export function penaltyFor(task: Task, id: string, at: Date): CoinTransaction | null {
  if (task.penalty <= 0) return null;
  return {
    id,
    memberId: task.assigneeId,
    amount: -task.penalty,
    reason: "task_penalty",
    taskId: task.id,
    note: `未完成「${task.title}」`,
    createdAt: at.toISOString(),
  };
}

/** 同一任务只能结算一次，防止重复发放或重复扣除 */
export function alreadySettled(transactions: CoinTransaction[], taskId: string): boolean {
  return transactions.some(
    (t) => t.taskId === taskId && (t.reason === "task_reward" || t.reason === "task_penalty"),
  );
}
