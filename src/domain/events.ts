/**
 * 领域事件：为后续功能（个人小屋、商城、排行榜、消息通知等）预留的扩展接口。
 * 新模块只需 subscribe 这些事件，无需修改任务和金币的核心逻辑。
 */
import type { CoinTransaction, Submission, Task } from "./types";

export type DomainEvent =
  | { type: "task.created"; task: Task }
  | { type: "task.submitted"; task: Task; submission: Submission }
  | { type: "task.voted"; task: Task; submission: Submission }
  | { type: "task.approved"; task: Task }
  | { type: "task.rejected"; task: Task }
  | { type: "task.failed"; task: Task }
  | { type: "task.cancelled"; task: Task }
  | { type: "coins.changed"; transaction: CoinTransaction };

type Listener = (event: DomainEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(events: DomainEvent[]) {
  for (const event of events) for (const l of listeners) l(event);
}
