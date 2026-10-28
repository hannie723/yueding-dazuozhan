/**
 * 约定计划 · 领域类型
 *
 * 这些类型与未来的数据库表一一对应（members / groups / tasks / submissions /
 * review_votes / coin_transactions），接入 Lovable Cloud 时可直接映射。
 */

export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
  /** 头像配色序号，对应设计系统中的 --member-1 ~ --member-5 */
  color: 1 | 2 | 3 | 4 | 5;
  /** 一句话签名 */
  bio?: string | undefined;
}

export interface Group {
  id: string;
  name: string;
  motto: string;
  memberIds: MemberId[];
  /** 每人每天最多收到的任务数 */
  dailyTaskLimit: number;
}

export type TaskStatus =
  | "in_progress" // 进行中：等待执行人提交
  | "submitted" // 待验收：已提交证据，等待验收
  | "approved" // 已完成：验收通过，已发放奖励
  | "rejected" // 已退回：需要补充后重新提交
  | "failed" // 未完成：到期未通过，已扣除惩罚
  | "cancelled"; // 已取消：不计入统计

/** single：指定一位验收人；vote：多位验收人投票，过半通过 */
export type ReviewMode = "single" | "vote";

export interface Task {
  id: string;
  groupId: string;
  title: string;
  criteria: string;
  creatorId: MemberId;
  assigneeId: MemberId;
  reviewerIds: MemberId[];
  reviewMode: ReviewMode;
  /** ISO 时间 */
  dueAt: string;
  reward: number;
  penalty: number;
  status: TaskStatus;
  createdAt: string;
  resolvedAt?: string | undefined;
}

export interface Screenshot {
  id: string;
  /** 原型阶段只保存文件名/占位名，接入存储后替换为文件地址 */
  label: string;
}

export type ReviewDecision = "approve" | "reject";

export interface ReviewVote {
  reviewerId: MemberId;
  decision: ReviewDecision;
  comment?: string | undefined;
  createdAt: string;
}

export interface Submission {
  id: string;
  taskId: string;
  authorId: MemberId;
  note: string;
  screenshots: Screenshot[];
  createdAt: string;
  votes: ReviewVote[];
  outcome?: "approved" | "rejected" | undefined;
}

export type CoinReason = "initial" | "task_reward" | "task_penalty";

export interface CoinTransaction {
  id: string;
  memberId: MemberId;
  /** 正数为收入，负数为支出 */
  amount: number;
  reason: CoinReason;
  taskId?: string | undefined;
  note: string;
  createdAt: string;
}

export interface AppState {
  /** 数据结构版本，便于以后迁移本地数据 */
  version: number;
  group: Group;
  members: Member[];
  tasks: Task[];
  submissions: Submission[];
  transactions: CoinTransaction[];
  /** 原型阶段的“模拟身份”，接入登录后由真实用户替代 */
  currentUserId: MemberId;
}

/** 业务操作需要的外部依赖（时间与 ID），便于测试和替换 */
export interface DomainContext {
  now: Date;
  newId: () => string;
}
