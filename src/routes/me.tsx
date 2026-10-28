import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Gift, History, Lock, RotateCcw, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/app/AppShell";
import { Card, CoinAmount, EmptyState, MemberAvatar, SectionTitle, StatusBadge } from "@/components/app/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { balanceOf, transactionsOf } from "@/domain/coins";
import { formatDateTime, formatDue, weekdayLabel } from "@/domain/dates";
import { currentStreak, weekSummary, type DayStatus } from "@/domain/progress";
import { isOverdue } from "@/domain/tasks";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useAppStore, useCurrentUser } from "@/store/app-store";

export const Route = createFileRoute("/me")({
  validateSearch: z.object({ member: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "个人记录 · 约定计划" },
      { name: "description", content: "查看金币流水、历史任务和本周达标情况。" },
      { property: "og:title", content: "个人记录 · 约定计划" },
      { property: "og:description", content: "金币流水、历史任务和本周达标一目了然。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecordsPage,
});

const dayTone: Record<DayStatus, string> = {
  met: "bg-status-done text-primary-foreground",
  missed: "bg-status-failed-soft text-status-failed",
  pending: "bg-status-review-soft text-status-review",
  none: "bg-muted text-muted-foreground",
  future: "border border-dashed text-muted-foreground",
};
const dayText: Record<DayStatus, string> = {
  met: "达标",
  missed: "未达标",
  pending: "进行中",
  none: "休息",
  future: "",
};

type Tab = "coins" | "tasks";
type TaskFilter = "all" | "approved" | "failed" | "open";

function RecordsPage() {
  const { state, now, actions } = useAppStore();
  const me = useCurrentUser();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/me" });
  const memberId = state.members.some((m) => m.id === search.member) ? search.member! : me.id;
  const member = state.members.find((m) => m.id === memberId)!;
  const [tab, setTab] = useState<Tab>("coins");
  const [filter, setFilter] = useState<TaskFilter>("all");

  const balance = balanceOf(state.transactions, memberId);
  const streak = currentStreak(state.tasks, memberId, now);
  const week = weekSummary(state.tasks, memberId, now);
  const flows = transactionsOf(state.transactions, memberId);
  const income = flows.filter((f) => f.amount > 0 && f.reason !== "initial").reduce((s, f) => s + f.amount, 0);
  const spent = flows.filter((f) => f.amount < 0).reduce((s, f) => s - f.amount, 0);

  const tasks = useMemo(() => {
    const mine = state.tasks
      .filter((t) => t.assigneeId === memberId)
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
    const match: Record<TaskFilter, (t: Task) => boolean> = {
      all: () => true,
      approved: (t) => t.status === "approved",
      failed: (t) => t.status === "failed",
      open: (t) => t.status === "in_progress" || t.status === "submitted" || t.status === "rejected",
    };
    return mine.filter(match[filter]);
  }, [state.tasks, memberId, filter]);

  return (
    <div className="animate-pop-in">
      <PageHeader title="个人记录" back={false} />

      {/* 成员切换 */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-5 pb-1">
        {state.members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate({ search: { member: m.id }, replace: true })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition-all",
              m.id === memberId ? "border-primary bg-primary-soft font-medium text-primary" : "bg-card",
            )}
          >
            <MemberAvatar member={m} size="xs" />
            {m.name}
            {m.id === me.id && <span className="text-xs">(我)</span>}
          </button>
        ))}
      </div>

      <div className="space-y-5 px-5 pb-6 pt-4">
        {/* 概览 */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-primary-soft p-4">
            <MemberAvatar member={member} size="lg" />
            <div className="flex-1">
              <p className="font-display text-xl font-bold">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.bio}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">金币余额</p>
              <CoinAmount value={balance} className={cn("font-display text-2xl", balance < 0 && "text-status-failed")} />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x text-center">
            <Mini label="连续达标" value={`🔥 ${streak} 天`} />
            <Mini label="本周达标" value={`${week.met}/7 天`} />
            <Mini label="累计收入 / 扣除" value={`+${income} / -${spent}`} />
          </div>
        </Card>

        {/* 本周达标 */}
        <section>
          <SectionTitle>本周达标</SectionTitle>
          <Card>
            <div className="grid grid-cols-7 gap-1.5">
              {week.days.map(({ date, status }) => (
                <div key={date.toISOString()} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{weekdayLabel(date)}</span>
                  <span
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-xl text-sm font-medium tabular-nums",
                      dayTone[status],
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <span className="h-3 text-[10px] text-muted-foreground">{dayText[status]}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              当天截止的任务全部验收通过即为达标；没有任务的日子算休息，不会中断连续天数。
            </p>
          </Card>
        </section>

        {/* 流水 / 历史 */}
        <section>
          <div className="mb-3 flex rounded-xl bg-muted p-1 text-sm">
            {(
              [
                ["coins", "金币流水", <Wallet key="w" className="size-4" />],
                ["tasks", "历史任务", <History key="h" className="size-4" />],
              ] as const
            ).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-all",
                  tab === key ? "bg-card font-medium shadow-soft" : "text-muted-foreground",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {tab === "coins" &&
            (flows.length === 0 ? (
              <EmptyState icon={<Wallet />} title="还没有金币记录" />
            ) : (
              <Card className="divide-y p-0">
                {flows.map((f) => {
                  const inc = f.amount > 0;
                  const row = (
                    <>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          f.reason === "initial"
                            ? "bg-coin-soft text-coin"
                            : inc
                              ? "bg-status-done-soft text-status-done"
                              : "bg-status-failed-soft text-status-failed",
                        )}
                      >
                        {f.reason === "initial" ? <Gift className="size-4" /> : inc ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{f.note}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(f.createdAt, now)}</p>
                      </div>
                      <span className={cn("font-semibold tabular-nums", inc ? "text-status-done" : "text-status-failed")}>
                        {inc ? "+" : ""}
                        {f.amount}
                      </span>
                    </>
                  );
                  const cls = "flex items-center gap-3 px-4 py-3";
                  return f.taskId ? (
                    <Link key={f.id} to="/tasks/$taskId" params={{ taskId: f.taskId }} className={cn(cls, "transition-colors hover:bg-accent/40")}>
                      {row}
                    </Link>
                  ) : (
                    <div key={f.id} className={cls}>
                      {row}
                    </div>
                  );
                })}
              </Card>
            ))}

          {tab === "tasks" && (
            <>
              <div className="mb-3 flex gap-1.5">
                {(
                  [
                    ["all", "全部"],
                    ["approved", "已完成"],
                    ["failed", "未完成"],
                    ["open", "进行中"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition-colors",
                      filter === key ? "bg-foreground text-background" : "bg-card text-muted-foreground shadow-soft",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tasks.length === 0 ? (
                <EmptyState icon={<History />} title="这里还没有任务" />
              ) : (
                <Card className="divide-y p-0">
                  {tasks.map((t) => (
                    <Link
                      key={t.id}
                      to="/tasks/$taskId"
                      params={{ taskId: t.id }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", t.status === "cancelled" && "text-muted-foreground line-through")}>{t.title}</p>
                        <p className="text-[11px] text-muted-foreground">截止 {formatDue(t.dueAt, now)}</p>
                      </div>
                      <StatusBadge status={t.status} overdue={isOverdue(t, now)} />
                    </Link>
                  ))}
                </Card>
              )}
            </>
          )}
        </section>

        {/* 预留：金币用途（后续功能入口，不可点击） */}
        <div className="flex items-start gap-3 rounded-2xl border border-dashed p-4 text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">金币的更多用途即将开放</p>
            个人小屋、金币商城和小组排行榜正在筹备中，现在攒下的金币之后都能用上。
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-muted-foreground">
              <RotateCcw />
              重置演示数据
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[calc(100%-2.5rem)] rounded-2xl sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">恢复到初始演示数据？</AlertDialogTitle>
              <AlertDialogDescription>你创建的任务、提交和金币变化都会被清除。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                onClick={async () => {
                  await actions.resetDemo();
                  navigate({ search: {}, replace: true });
                  toast.success("演示数据已重置");
                }}
              >
                确认重置
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
