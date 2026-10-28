import { cva } from "class-variance-authority";
import { Coins, Flame } from "lucide-react";
import type { ReactNode } from "react";

import { STATUS_LABEL } from "@/domain/tasks";
import type { Member, TaskStatus } from "@/domain/types";
import { cn } from "@/lib/utils";

const avatarColor: Record<Member["color"], string> = {
  1: "bg-member-1",
  2: "bg-member-2",
  3: "bg-member-3",
  4: "bg-member-4",
  5: "bg-member-5",
};

const avatarSize = {
  xs: "size-6 text-[11px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member?: Member;
  size?: keyof typeof avatarSize;
  className?: string;
}) {
  return (
    <span
      title={member?.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-primary-foreground ring-2 ring-card",
        member ? avatarColor[member.color] : "bg-muted",
        avatarSize[size],
        className,
      )}
    >
      {member?.name.slice(-1) ?? "?"}
    </span>
  );
}

export function AvatarStack({ members, size = "xs" }: { members: (Member | undefined)[]; size?: keyof typeof avatarSize }) {
  return (
    <span className="flex -space-x-1.5">
      {members.map((m, i) => (
        <MemberAvatar key={m?.id ?? i} member={m} size={size} />
      ))}
    </span>
  );
}

export const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        in_progress: "bg-status-progress-soft text-status-progress",
        submitted: "bg-status-review-soft text-status-review",
        approved: "bg-status-done-soft text-status-done",
        rejected: "bg-status-rejected-soft text-status-rejected",
        failed: "bg-status-failed-soft text-status-failed",
        cancelled: "bg-status-cancelled-soft text-status-cancelled line-through",
      },
    },
  },
);

const statusDot: Record<TaskStatus, string> = {
  in_progress: "bg-status-progress",
  submitted: "bg-status-review",
  approved: "bg-status-done",
  rejected: "bg-status-rejected",
  failed: "bg-status-failed",
  cancelled: "bg-status-cancelled",
};

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className={statusBadgeVariants({ status: "failed" })}>
        <span className="size-1.5 rounded-full bg-status-failed" />
        已逾期
      </span>
    );
  }
  return (
    <span className={statusBadgeVariants({ status })}>
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CoinAmount({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const text = signed && value > 0 ? `+${value}` : String(value);
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", className)}>
      <Coins className="size-3.5 text-coin" />
      {text}
    </span>
  );
}

export function StreakAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", className)}>
      <Flame className="size-3.5 text-streak" />
      {value}天
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-display text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-8 text-center">
      <div className="mb-2 text-muted-foreground [&_svg]:size-7">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-card p-4 shadow-soft", className)}>{children}</div>;
}
