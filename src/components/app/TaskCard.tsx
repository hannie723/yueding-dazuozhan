import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Users } from "lucide-react";

import { formatDue } from "@/domain/dates";
import { isOverdue } from "@/domain/tasks";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useAppStore, useMembers } from "@/store/app-store";
import { AvatarStack, CoinAmount, MemberAvatar, StatusBadge } from "./primitives";

const accentBar: Record<Task["status"], string> = {
  in_progress: "bg-status-progress",
  submitted: "bg-status-review",
  approved: "bg-status-done",
  rejected: "bg-status-rejected",
  failed: "bg-status-failed",
  cancelled: "bg-status-cancelled",
};

export function TaskCard({ task, hint }: { task: Task; hint?: string | undefined }) {
  const { now } = useAppStore();
  const members = useMembers();
  const overdue = isOverdue(task, now);
  const assignee = members.get(task.assigneeId);

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="group relative flex overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <span className={cn("w-1.5 shrink-0", overdue ? "bg-status-failed" : accentBar[task.status])} />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "font-medium leading-snug",
              (task.status === "cancelled" || task.status === "failed") && "text-muted-foreground",
            )}
          >
            {task.title}
          </h3>
          <StatusBadge status={task.status} overdue={overdue} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MemberAvatar member={assignee} size="xs" />
            {assignee?.name}
          </span>
          <span className="inline-flex items-center gap-1">
            {task.reviewMode === "vote" ? <Users className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            <AvatarStack members={task.reviewerIds.map((id) => members.get(id))} />
          </span>
          <span className={cn("inline-flex items-center gap-1", overdue && "text-status-failed")}>
            <Clock className="size-3.5" />
            {formatDue(task.dueAt, now)}
          </span>
          <span className="ml-auto inline-flex items-center gap-2">
            <CoinAmount value={task.reward} signed className="text-status-done" />
            {task.penalty > 0 && <span className="tabular-nums text-status-failed">-{task.penalty}</span>}
          </span>
        </div>
        {hint && <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Link>
  );
}
