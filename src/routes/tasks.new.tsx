import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Info, User, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/AppShell";
import { MemberAvatar } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDays, atTime, dayKey, toLocalInputValue } from "@/domain/dates";
import { countTasksForDay, type NewTaskErrors } from "@/domain/tasks";
import type { MemberId, ReviewMode } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useAppStore, useCurrentUser } from "@/store/app-store";

export const Route = createFileRoute("/tasks/new")({
  head: () => ({
    meta: [
      { title: "布置任务 · 约定计划" },
      { name: "description", content: "给自己或朋友布置一个学习任务，约定达标标准、验收人、截止时间和金币奖惩。" },
      { property: "og:title", content: "布置任务 · 约定计划" },
      { property: "og:description", content: "约定达标标准、验收人和金币奖惩。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewTaskPage,
});

const CRITERIA_SUGGESTIONS = ["App 打卡截图", "笔记拍照至少 2 页", "写 3 句总结", "提交记录截图"];
const REWARD_PRESETS = [5, 10, 15, 20];
const PENALTY_PRESETS = [0, 5, 10];

function NewTaskPage() {
  const { state, now, actions } = useAppStore();
  const me = useCurrentUser();
  const navigate = useNavigate();

  const defaultDue = useMemo(() => {
    const tonight = atTime(now, 22);
    return tonight.getTime() > now.getTime() + 30 * 60_000 ? tonight : atTime(addDays(now, 1), 22);
  }, [now]);

  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [assigneeId, setAssigneeId] = useState<MemberId>(me.id);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("single");
  const [reviewerIds, setReviewerIds] = useState<MemberId[]>(() => {
    const other = state.members.find((m) => m.id !== me.id);
    return other ? [other.id] : [];
  });
  const [dueAt, setDueAt] = useState(toLocalInputValue(defaultDue));
  const [reward, setReward] = useState(10);
  const [penalty, setPenalty] = useState(5);
  const [errors, setErrors] = useState<NewTaskErrors>({});

  const dueDay = dueAt ? dayKey(new Date(dueAt)) : dayKey(now);
  const limit = state.group.dailyTaskLimit;

  const pickAssignee = (id: MemberId) => {
    setAssigneeId(id);
    // 执行人不能同时是验收人
    setReviewerIds((prev) => {
      const next = prev.filter((r) => r !== id);
      if (next.length === 0) {
        const fallback = state.members.find((m) => m.id !== id);
        return fallback ? [fallback.id] : [];
      }
      return reviewMode === "single" ? next.slice(0, 1) : next;
    });
    setErrors((e) => ({ ...e, assigneeId: undefined, reviewerIds: undefined }));
  };

  const toggleReviewer = (id: MemberId) => {
    if (id === assigneeId) {
      toast("执行人不能验收自己的任务");
      return;
    }
    setReviewerIds((prev) => {
      if (reviewMode === "single") return [id];
      return prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id];
    });
    setErrors((e) => ({ ...e, reviewerIds: undefined }));
  };

  const switchMode = (mode: ReviewMode) => {
    setReviewMode(mode);
    if (mode === "single") setReviewerIds((prev) => prev.slice(0, 1));
    else {
      setReviewerIds((prev) => {
        const others = state.members.filter((m) => m.id !== assigneeId).map((m) => m.id);
        return prev.length >= 2 ? prev : others;
      });
    }
    setErrors((e) => ({ ...e, reviewerIds: undefined }));
  };

  const quickDue = (label: string, date: Date) => (
    <button
      key={label}
      type="button"
      onClick={() => {
        setDueAt(toLocalInputValue(date));
        setErrors((e) => ({ ...e, dueAt: undefined, assigneeId: undefined }));
      }}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        dueAt === toLocalInputValue(date) ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-accent",
      )}
    >
      {label}
    </button>
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = actions.createTask({
      title,
      criteria,
      assigneeId,
      reviewerIds,
      reviewMode,
      dueAt: dueAt ? new Date(dueAt).toISOString() : "",
      reward,
      penalty,
    });
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      toast.error(r.error);
      return;
    }
    const assignee = state.members.find((m) => m.id === assigneeId);
    toast.success("任务已布置", {
      description: assigneeId === me.id ? "加油，完成后记得提交证据" : `已通知 ${assignee?.name}（模拟）`,
    });
    navigate({ to: "/tasks/$taskId", params: { taskId: r.data.id }, replace: true });
  };

  return (
    <div className="animate-pop-in">
      <PageHeader title="布置任务" />
      <form onSubmit={submit} className="space-y-6 px-5 pb-6" noValidate>
        <Field label="任务名称" error={errors.title}>
          <Input
            value={title}
            maxLength={30}
            placeholder="例如：背单词 50 个"
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((x) => ({ ...x, title: undefined }));
            }}
            className="h-11 rounded-xl bg-card"
          />
        </Field>

        <Field label="达标标准" hint="写清楚怎样才算完成，验收人会按这个判断" error={errors.criteria}>
          <Textarea
            value={criteria}
            rows={3}
            placeholder="例如：App 打卡截图，显示今日新学 50 词"
            onChange={(e) => {
              setCriteria(e.target.value);
              setErrors((x) => ({ ...x, criteria: undefined }));
            }}
            className="rounded-xl bg-card"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CRITERIA_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setCriteria((c) => (c ? `${c}，${s}` : s));
                  setErrors((x) => ({ ...x, criteria: undefined }));
                }}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent"
              >
                + {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="执行人" hint={`每人每天最多 ${limit} 个任务`} error={errors.assigneeId}>
          <div className="grid grid-cols-4 gap-2">
            {state.members.map((m) => {
              const count = countTasksForDay(state.tasks, m.id, dueDay);
              const full = count >= limit;
              const selected = assigneeId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={full}
                  onClick={() => pickAssignee(m.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-card px-1 py-2.5 transition-all",
                    selected ? "border-primary shadow-soft" : "border-transparent",
                    full && "opacity-45",
                  )}
                >
                  {selected && <SelectedMark />}
                  <MemberAvatar member={m} size="md" />
                  <span className="text-xs font-medium">
                    {m.name}
                    {m.id === me.id && "(我)"}
                  </span>
                  <span className={cn("text-[10px]", full ? "text-status-failed" : "text-muted-foreground")}>
                    {full ? "当天已满" : `当天 ${count}/${limit}`}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="验收方式与验收人" error={errors.reviewerIds}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <ModeButton active={reviewMode === "single"} onClick={() => switchMode("single")} icon={<User />} title="单人验收" desc="一位朋友说了算" />
            <ModeButton active={reviewMode === "vote"} onClick={() => switchMode("vote")} icon={<Users />} title="投票验收" desc="多人投票，过半通过" />
          </div>
          <div className="flex flex-wrap gap-2">
            {state.members.map((m) => {
              const isAssignee = m.id === assigneeId;
              const selected = reviewerIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleReviewer(m.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition-all",
                    selected ? "border-primary bg-primary-soft text-primary" : "bg-card",
                    isAssignee && "cursor-not-allowed opacity-40",
                  )}
                >
                  <MemberAvatar member={m} size="xs" />
                  {m.name}
                  {selected && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
          {reviewMode === "vote" && reviewerIds.length >= 2 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {reviewerIds.length} 人投票，需要 {Math.floor(reviewerIds.length / 2) + 1} 票通过
            </p>
          )}
        </Field>

        <Field label="截止时间" error={errors.dueAt}>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => {
              setDueAt(e.target.value);
              setErrors((x) => ({ ...x, dueAt: undefined, assigneeId: undefined }));
            }}
            className="h-11 rounded-xl bg-card"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {atTime(now, 22).getTime() > now.getTime() && quickDue("今晚 22:00", atTime(now, 22))}
            {quickDue("明天 12:00", atTime(addDays(now, 1), 12))}
            {quickDue("明晚 22:00", atTime(addDays(now, 1), 22))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="完成奖励" error={errors.reward}>
            <CoinPicker value={reward} onChange={setReward} presets={REWARD_PRESETS} tone="reward" />
          </Field>
          <Field label="未完成惩罚" error={errors.penalty}>
            <CoinPicker value={penalty} onChange={setPenalty} presets={PENALTY_PRESETS} tone="penalty" />
          </Field>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          验收通过后执行人获得 {reward} 金币；到期未通过将扣除 {penalty} 金币。
        </div>

        <Button type="submit" size="lg" className="w-full">
          布置任务
        </Button>
      </form>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs text-status-failed">{error}</p>}
    </div>
  );
}

function SelectedMark() {
  return (
    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="size-3" />
    </span>
  );
}

function ModeButton({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-xl border-2 bg-card p-3 text-left transition-all",
        active ? "border-primary" : "border-transparent",
      )}
    >
      <span className={cn("mt-0.5 [&_svg]:size-4", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function CoinPicker({
  value,
  onChange,
  presets,
  tone,
}: {
  value: number;
  onChange: (v: number) => void;
  presets: number[];
  tone: "reward" | "penalty";
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return (
    <div className="rounded-xl bg-card p-2 shadow-soft">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="减少" onClick={() => onChange(clamp(value - 1))} className="size-8 rounded-lg bg-muted text-lg leading-none transition-colors hover:bg-accent">
          −
        </button>
        <span className={cn("font-display text-xl font-bold tabular-nums", tone === "reward" ? "text-status-done" : "text-status-failed")}>
          {tone === "reward" ? "+" : "-"}
          {value}
        </span>
        <button type="button" aria-label="增加" onClick={() => onChange(clamp(value + 1))} className="size-8 rounded-lg bg-muted text-lg leading-none transition-colors hover:bg-accent">
          +
        </button>
      </div>
      <div className="mt-2 flex gap-1">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex-1 rounded-md py-1 text-xs tabular-nums transition-colors",
              value === p ? "bg-primary-soft font-medium text-primary" : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
