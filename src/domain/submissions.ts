import type { MemberId, ReviewDecision, Screenshot, Submission, Task } from "./types";

export type VoteResult = "approved" | "rejected" | "pending";

/**
 * 计算验收结果：
 * - 单人验收：验收人的决定即结果
 * - 投票验收：通过票超过半数即通过；一旦通过已不可能过半，则退回
 */
export function resolveVotes(task: Task, submission: Submission): VoteResult {
  const valid = submission.votes.filter((v) => task.reviewerIds.includes(v.reviewerId));
  if (task.reviewMode === "single") {
    const vote = valid[0];
    if (!vote) return "pending";
    return vote.decision === "approve" ? "approved" : "rejected";
  }
  const total = task.reviewerIds.length;
  const approvals = valid.filter((v) => v.decision === "approve").length;
  const remaining = total - valid.length;
  if (approvals > total / 2) return "approved";
  if (approvals + remaining <= total / 2) return "rejected";
  return "pending";
}

/** 通过所需票数 */
export function approvalsNeeded(task: Task): number {
  if (task.reviewMode === "single") return 1;
  return Math.floor(task.reviewerIds.length / 2) + 1;
}

export function latestSubmission(submissions: Submission[], taskId: string): Submission | undefined {
  return submissions
    .filter((s) => s.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function submissionsOf(submissions: Submission[], taskId: string): Submission[] {
  return submissions
    .filter((s) => s.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hasVoted(submission: Submission | undefined, reviewerId: MemberId): boolean {
  return !!submission?.votes.some((v) => v.reviewerId === reviewerId);
}

export function canVote(task: Task, submission: Submission | undefined, userId: MemberId): boolean {
  return (
    task.status === "submitted" &&
    !!submission &&
    !submission.outcome &&
    task.reviewerIds.includes(userId) &&
    !hasVoted(submission, userId)
  );
}

export function buildSubmission(input: {
  id: string;
  taskId: string;
  authorId: MemberId;
  note: string;
  screenshots: Screenshot[];
  now: Date;
}): Submission {
  return {
    id: input.id,
    taskId: input.taskId,
    authorId: input.authorId,
    note: input.note.trim(),
    screenshots: input.screenshots,
    createdAt: input.now.toISOString(),
    votes: [],
  };
}

export function addVote(
  submission: Submission,
  vote: { reviewerId: MemberId; decision: ReviewDecision; comment?: string; now: Date },
): Submission {
  return {
    ...submission,
    votes: [
      ...submission.votes,
      {
        reviewerId: vote.reviewerId,
        decision: vote.decision,
        comment: vote.comment?.trim() || undefined,
        createdAt: vote.now.toISOString(),
      },
    ],
  };
}
