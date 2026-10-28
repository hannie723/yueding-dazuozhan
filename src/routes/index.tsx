import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ClipboardCheck, Hourglass, Inbox, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { IdentitySwitcher } from "@/components/app/IdentitySwitcher";
import {
  Card,
  CoinAmount,
  EmptyState,
  MemberAvatar,
  SectionTitle,
  StreakAmount,
} from "@/components/app/primitives";
import { TaskCard } from "@/components/app/TaskCard";
import { Button } from "@/components/ui/button";
import { balanceOf } from "@/domain/coins";
import { dayKey } from "@/domain/dates";
import { currentStreak } from "@/domain/progress";
import { canVote, latestSubmission } from "@/domain/submissions";
import { countTasksForDay, isOpen, isOverdue } from "@/domain/tasks";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useAppStore, useCurrentUser } from "@/store/app-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "小组首页 · 约定计划" },
      { name: "description", content: "查看小组成员的金币、连续达标天数、今日任务和待验收任务。" },
      { property: "og:title", content: "小组首页 · 约定计划" },
      { property: "og:description", content: "和朋友一起完成今天的学习约定。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

type Tab = "today" | "review" | "mine";

const statusOrder: Record<Task["status"], number> = {
  rejected: 0,
  in_progress: 1,
  submitted: 2,
  approved: 3,
  failed: 4,
  cancelled: 5,
};

function HomePage() {
  const { state, now, actions } = useAppStore();
  const me = useCurrentUser();
  const [tab, setTab] = useState<Tab>("today");
  const [onlyMine, setOnlyMine] = useState(false);
  const today = dayKey(now);

  const todayTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => dayKey(t.dueAt) === today || isOverdue(t, now))
        .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.dueAt.localeCompare(b.dueAt)),
    [state.tasks, today, now],
  );

  const reviewQueue = useMemo(
    () =>
      state.tasks.filter((t) => canVote(t, latestSubmission(state.submissions, t.id), me.id)),
    [state.tasks, state.submissions, me.id],
  );

  const assignedByMe = useMemo(
    () =>
      state.tasks
        .filter((t) => t.creatorId === me.id && t.assigneeId !== me.id && isOpen(t))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [state.tasks, me.id],
  );

  const myToday = todayTasks.filter((t) => t.assigneeId === me.id && t.status !== "cancelled");
  const myDone = myToday.filter((t) => t.status === "approved").length;
  const overdueCount = state.tasks.filter((t) => isOverdue(t, now)).length;
  const shownToday = onlyMine ? todayTasks.filter((t) => t.assigneeId === me.id) : todayTasks;

  const settle = () => {
    const r = actions.settleOverdue();
    if (!r.ok) { toast.error(r.error); return; }
    if (r.data === 0) toast("没有需要结算的逾期任务");
    else toast.warning(`已结算 ${r.data} 个逾期任务`, { description: "未完成的任务已扣除约定金币" });
  };

  return (
    <div className="animate-pop-in">
      {/* 顶部：小组信息 */}
      <header className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            约定计划
          </span>
          <IdentitySwitcher />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold">{state.group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.group.motto} · {state.members.length} 位成员
        </p>
      </header>

      {/* 成员 */}
      <section className="mt-5">
        <div className="scrollbar-none flex gap-3 overflow-x-auto px-5 pb-2">
          {state.members.map((m) => {
            const count = countTasksForDay(state.tasks, m.id, today);
            const done = state.tasks.filter(
              (t) => t.assigneeId === m.id && dayKey(t.dueAt) === today && t.status === "approved",
            ).length;
            return (
              <Link
                key={m.id}
                to="/me"
                search={{ member: m.id }}
                className={cn(
                  "w-[8.5rem] shrink-0 rounded-2xl bg-card p-3 shadow-soft transition-transform active:scale-[0.97]",
                  m.id === me.id && "ring-2 ring-primary/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <MemberAvatar member={m} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {m.id === me.id && <span className="ml-1 text-xs text-primary">(我)</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.bio}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <CoinAmount value={balanceOf(state.transactions, m.id)} />
                  <StreakAmount value={currentStreak(state.tasks, m.id, now)} />
                </div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: state.group.dailyTaskLimit }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        i < done ? "bg-status-done" : i < count ? "bg-primary-soft" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  今日 {done}/{count} · 上限 {state.group.dailyTaskLimit}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 我的今日概览 */}
      <section className="mt-3 px-5">
        <Card className="grid grid-cols-3 divide-x p-0">
          <Stat icon={<CalendarCheck />} label="我的今日" value={`${myDone}/${myToday.length}`} />
          <Stat
            icon={<ClipboardCheck />}
            label="待我验收"
            value={String(reviewQueue.length)}
            highlight={reviewQueue.length > 0}
            onClick={() => setTab("review")}
          />
          <Stat
            icon={<span className="text-streak">🔥</span>}
            label="连续达标"
            value={`${currentStreak(state.tasks, me.id, now)} 天`}
          />
        </Card>
      </section>

      {/* 任务列表 */}
      <section className="mt-6 px-5">
        <div className="mb-4 flex rounded-xl bg-muted p-1 text-sm">
          {(
            [
              ["today", "今日任务", todayTasks.length],
              ["review", "待我验收", reviewQueue.length],
              ["mine", "我布置的", assignedByMe.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 transition-all",
                tab === key ? "bg-card font-medium shadow-soft" : "text-muted-foreground",
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    key === "review" ? "bg-status-review text-primary-foreground" : "bg-secondary",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <>
            <SectionTitle
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={onlyMine ? "soft" : "outline"}
                    onClick={() => setOnlyMine((v) => !v)}
                  >
                    {onlyMine ? "只看我的" : "全部成员"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={settle}>
                    <Hourglass />
                    到期结算{overdueCount > 0 && ` (${overdueCount})`}
                  </Button>
                </div>
              }
            >
              今天的约定
            </SectionTitle>
            <TaskList tasks={shownToday} empty="今天还没有任务，去布置一个吧" />
          </>
        )}

        {tab === "review" && (
          <>
            <SectionTitle>等你验收</SectionTitle>
            <TaskList
              tasks={reviewQueue}
              empty="暂时没有需要你验收的任务"
              hint={(t) => {
                const s = latestSubmission(state.submissions, t.id);
                return s?.note ? `提交说明：${s.note}` : undefined;
              }}
            />
          </>
        )}

        {tab === "mine" && (
          <>
            <SectionTitle>布置给朋友、还在进行的</SectionTitle>
            <TaskList tasks={assignedByMe} empty="你还没有给朋友布置进行中的任务" />
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean | undefined;
  onClick?: () => void | undefined;
}) {
  const content = (
    <>
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className={cn("font-display text-xl font-bold tabular-nums", highlight && "text-status-review")}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-0.5 py-3";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:bg-accent/50")}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

function TaskList({
  tasks,
  empty,
  hint,
}: {
  tasks: Task[];
  empty: string;
  hint?: (t: Task) => string | undefined | undefined;
}) {
  if (tasks.length === 0) return <EmptyState icon={<Inbox />} title={empty} />;
  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} hint={hint?.(t)} />
      ))}
    </div>
  );
}
