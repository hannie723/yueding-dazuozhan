import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  Clock,
  ImageIcon,
  ImagePlus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/AppShell";
import { AvatarStack, Card, CoinAmount, MemberAvatar, StatusBadge } from "@/components/app/primitives";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatDue } from "@/domain/dates";
import { approvalsNeeded, canVote, hasVoted, submissionsOf } from "@/domain/submissions";
import { canCancel, canMarkFailed, canSubmit, isOverdue, isReviewer } from "@/domain/tasks";
import type { Screenshot, Submission, Task } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useAppStore, useCurrentUser, useMembers } from "@/store/app-store";

export const Route = createFileRoute("/tasks/$taskId")({
  head: () => ({
    meta: [
      { title: "任务详情 · 约定计划" },
      { name: "description", content: "查看任务状态、提交证据，并由验收人通过或退回。" },
      { property: "og:title", content: "任务详情 · 约定计划" },
      { property: "og:description", content: "查看任务状态、提交证据与验收结果。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaskDetailPage,
});

const heroTone: Record<Task["status"], string> = {
  in_progress: "bg-status-progress-soft",
  submitted: "bg-status-review-soft",
  approved: "bg-status-done-soft",
  rejected: "bg-status-rejected-soft",
  failed: "bg-status-failed-soft",
  cancelled: "bg-status-cancelled-soft",
};

const statusTip: Record<Task["status"], string> = {
  in_progress: "等待执行人完成并提交证据",
  submitted: "证据已提交，等待验收",
  approved: "验收通过，奖励金币已发放",
  rejected: "被退回了，补充后可以重新提交",
  failed: "到期未完成，已扣除约定金币",
  cancelled: "任务已取消，不计入统计",
};

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const { state, now } = useAppStore();
  const me = useCurrentUser();
  const members = useMembers();
  const task = state.tasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <div>
        <PageHeader title="任务详情" />
        <div className="px-5 py-16 text-center">
          <p className="font-display text-xl font-bold">找不到这个任务</p>
          <p className="mt-2 text-sm text-muted-foreground">它可能已被删除，或演示数据已重置。</p>
          <Button asChild className="mt-6">
            <Link to="/">回到小组首页</Link>
          </Button>
        </div>
      </div>
    );
  }

  const subs = submissionsOf(state.submissions, task.id);
  const latest = subs[0];
  const overdue = isOverdue(task, now);
  const assignee = members.get(task.assigneeId);
  const creator = members.get(task.creatorId);

  return (
    <div className="animate-pop-in">
      <PageHeader title="任务详情" />
      <div className="space-y-4 px-5 pb-6">
        {/* 状态卡 */}
        <div className={cn("rounded-3xl p-5", overdue ? "bg-status-failed-soft" : heroTone[task.status])}>
          <div className="flex items-center justify-between">
            <StatusBadge status={task.status} overdue={overdue} />
            <span className="text-xs text-muted-foreground">
              {task.reviewMode === "vote" ? "投票验收" : "单人验收"}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{task.title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {overdue ? "已过截止时间，可由发起人或验收人判定未完成" : statusTip[task.status]}
          </p>
          <div className="mt-4 rounded-2xl bg-card/80 p-3">
            <p className="text-xs text-muted-foreground">达标标准</p>
            <p className="mt-1 text-sm">{task.criteria}</p>
          </div>
        </div>

        {/* 基本信息 */}
        <Card className="space-y-3 text-sm">
          <InfoRow label="执行人">
            <MemberAvatar member={assignee} size="xs" />
            {assignee?.name}
            {assignee?.id === me.id && <span className="text-xs text-primary">(我)</span>}
          </InfoRow>
          <InfoRow label="验收人">
            <AvatarStack members={task.reviewerIds.map((id) => members.get(id))} />
            {task.reviewerIds.map((id) => members.get(id)?.name).join("、")}
          </InfoRow>
          <InfoRow label="发起人">{creator?.name}</InfoRow>
          <InfoRow label="截止时间">
            <Clock className={cn("size-4", overdue ? "text-status-failed" : "text-muted-foreground")} />
            <span className={cn(overdue && "text-status-failed")}>{formatDue(task.dueAt, now)}</span>
          </InfoRow>
          <InfoRow label="金币约定">
            <CoinAmount value={task.reward} signed className="text-status-done" />
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold tabular-nums text-status-failed">-{task.penalty}</span>
          </InfoRow>
        </Card>

        {/* 执行人：提交证据 */}
        {canSubmit(task, me.id) && <SubmitForm task={task} resubmit={task.status === "rejected"} />}

        {/* 验收人：投票 */}
        {latest && task.status === "submitted" && <ReviewPanel task={task} submission={latest} />}

        {/* 提示：没有权限时告诉用户如何体验 */}
        <RoleHint task={task} submission={latest} />

        {/* 提交记录 */}
        {subs.length > 0 && (
          <section>
            <h3 className="mb-3 font-display text-lg font-bold">提交记录</h3>
            <div className="space-y-3">
              {subs.map((s, i) => (
                <SubmissionCard key={s.id} task={task} submission={s} latest={i === 0} />
              ))}
            </div>
          </section>
        )}

        <MoreActions task={task} />
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-right">{children}</span>
    </div>
  );
}

function ScreenshotTile({ shot, onRemove }: { shot: Screenshot; onRemove?: () => void }) {
  return (
    <div className="placeholder-stripes relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border text-muted-foreground">
      <ImageIcon className="size-5" />
      <span className="max-w-full truncate px-1.5 text-[10px]">{shot.label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label="移除截图"
          onClick={onRemove}
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-background"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function SubmitForm({ task, resubmit }: { task: Task; resubmit: boolean }) {
  const { actions } = useAppStore();
  const [note, setNote] = useState("");
  const [shots, setShots] = useState<Screenshot[]>([]);

  const addShot = (label?: string) => {
    if (shots.length >= 6) { toast("最多添加 6 张截图"); return; }
    setShots((s) => [...s, { id: `${Date.now()}-${s.length}`, label: label ?? `截图 ${s.length + 1}` }]);
  };

  const submit = () => {
    const r = actions.submitEvidence({ taskId: task.id, note, screenshots: shots });
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(resubmit ? "已重新提交" : "已提交，等待验收", { description: "验收人会收到提醒（模拟）" });
    setNote("");
    setShots([]);
  };

  return (
    <Card className="space-y-3 ring-2 ring-primary/30">
      <h3 className="font-display text-lg font-bold">{resubmit ? "补充后重新提交" : "提交完成证据"}</h3>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="说说你是怎么完成的，例如：背完 50 个，错了 3 个已复习"
        className="rounded-xl"
      />
      <div className="grid grid-cols-4 gap-2">
        {shots.map((s) => (
          <ScreenshotTile key={s.id} shot={s} onRemove={() => setShots((x) => x.filter((y) => y.id !== s.id))} />
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:bg-accent">
          <ImagePlus className="size-5" />
          <span className="text-[10px]">添加截图</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addShot(f.name);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <button type="button" onClick={() => addShot()} className="text-xs text-primary underline-offset-4 hover:underline">
        没有图片？添加一张模拟截图
      </button>
      <p className="text-[11px] text-muted-foreground">原型阶段只记录文件名，图片不会真正上传。</p>
      <Button className="w-full" onClick={submit}>
        <Send />
        {resubmit ? "重新提交" : "提交验收"}
      </Button>
    </Card>
  );
}

function ReviewPanel({ task, submission }: { task: Task; submission: Submission }) {
  const { actions } = useAppStore();
  const me = useCurrentUser();
  const [comment, setComment] = useState("");
  const approvals = submission.votes.filter((v) => v.decision === "approve").length;
  const rejects = submission.votes.length - approvals;

  if (!canVote(task, submission, me.id)) {
    if (task.reviewMode === "vote") return <VoteProgress task={task} approvals={approvals} rejects={rejects} />;
    return null;
  }

  const vote = (decision: "approve" | "reject") => {
    const r = actions.reviewTask({ taskId: task.id, decision, comment });
    if (!r.ok) { toast.error(r.error); return; }
    if (r.data === "approved") toast.success("验收通过！", { description: `执行人获得 ${task.reward} 金币` });
    else if (r.data === "rejected") toast("已退回", { description: "执行人可以补充后重新提交" });
    else toast("已投票", { description: "等待其他验收人投票" });
    setComment("");
  };

  return (
    <Card className="space-y-3 ring-2 ring-status-review/40">
      <h3 className="font-display text-lg font-bold">轮到你验收啦</h3>
      {task.reviewMode === "vote" && <VoteProgress task={task} approvals={approvals} rejects={rejects} bare />}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="写一句评语（退回时必填）"
        className="rounded-xl"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger-soft" onClick={() => vote("reject")}>
          <ThumbsDown />
          退回
        </Button>
        <Button variant="success" onClick={() => vote("approve")}>
          <ThumbsUp />
          验收通过
        </Button>
      </div>
    </Card>
  );
}

function VoteProgress({ task, approvals, rejects, bare }: { task: Task; approvals: number; rejects: number; bare?: boolean }) {
  const need = approvalsNeeded(task);
  const total = task.reviewerIds.length;
  const body = (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          通过 {approvals} · 退回 {rejects} · 未投 {total - approvals - rejects}
        </span>
        <span>需 {need} 票通过</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 rounded-full",
              i < approvals ? "bg-status-done" : i < approvals + rejects ? "bg-status-rejected" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
  if (bare) return body;
  return (
    <Card>
      <h3 className="mb-2 text-sm font-medium">投票进度</h3>
      {body}
    </Card>
  );
}

function RoleHint({ task, submission }: { task: Task; submission?: Submission | undefined }) {
  const me = useCurrentUser();
  const members = useMembers();
  let text: string | null = null;
  if ((task.status === "in_progress" || task.status === "rejected") && task.assigneeId !== me.id) {
    text = `等待 ${members.get(task.assigneeId)?.name} 提交。想体验提交流程，可在右上角切换为 TA。`;
  } else if (task.status === "submitted" && !isReviewer(task, me.id)) {
    text = `等待 ${task.reviewerIds.map((id) => members.get(id)?.name).join("、")} 验收。可在右上角切换身份体验验收。`;
  } else if (task.status === "submitted" && hasVoted(submission, me.id)) {
    text = "你已经投过票了，等待其他验收人。";
  }
  if (!text) return null;
  return <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">{text}</p>;
}

function SubmissionCard({ task, submission, latest }: { task: Task; submission: Submission; latest: boolean }) {
  const { now } = useAppStore();
  const members = useMembers();
  const author = members.get(submission.authorId);
  return (
    <Card className={cn(!latest && "opacity-75")}>
      <div className="flex items-center gap-2">
        <MemberAvatar member={author} size="sm" />
        <div className="flex-1">
          <p className="text-sm font-medium">{author?.name} 提交了证据</p>
          <p className="text-[11px] text-muted-foreground">{formatDateTime(submission.createdAt, now)}</p>
        </div>
        {submission.outcome === "approved" && (
          <span className="flex items-center gap-1 text-xs font-medium text-status-done">
            <CheckCircle2 className="size-4" />
            已通过
          </span>
        )}
        {submission.outcome === "rejected" && (
          <span className="flex items-center gap-1 text-xs font-medium text-status-rejected">
            <Undo2 className="size-4" />
            被退回
          </span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{submission.note || <span className="text-muted-foreground">（没有文字说明）</span>}</p>
      {submission.screenshots.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {submission.screenshots.map((s) => (
            <ScreenshotTile key={s.id} shot={s} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">未附截图</p>
      )}
      {submission.votes.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {submission.votes.map((v) => {
            const r = members.get(v.reviewerId);
            const ok = v.decision === "approve";
            return (
              <div key={v.reviewerId + v.createdAt} className="flex items-start gap-2 text-sm">
                <MemberAvatar member={r} size="xs" />
                <div className="flex-1">
                  <span className="font-medium">{r?.name}</span>
                  <span className={cn("ml-1.5 text-xs", ok ? "text-status-done" : "text-status-rejected")}>
                    {ok ? "通过" : "退回"}
                  </span>
                  {v.comment && <p className="text-muted-foreground">“{v.comment}”</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {task.reviewMode === "vote" && latest && !submission.outcome && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          已投 {submission.votes.length}/{task.reviewerIds.length}
        </p>
      )}
    </Card>
  );
}

function MoreActions({ task }: { task: Task }) {
  const { actions } = useAppStore();
  const me = useCurrentUser();
  const showFail = canMarkFailed(task, me.id);
  const showCancel = canCancel(task, me.id);
  if (!showFail && !showCancel) return null;

  return (
    <div className="space-y-2 pt-2">
      {showFail && (
        <ConfirmButton
          trigger={
            <Button variant="danger-soft" className="w-full">
              <XCircle />
              判定为未完成
            </Button>
          }
          title="判定这个任务未完成？"
          description={`执行人将被扣除 ${task.penalty} 金币，当天连续达标会中断。此操作不可撤销。`}
          confirmText="确认判定"
          onConfirm={() => {
            const r = actions.markFailed(task.id);
            if (!r.ok) { toast.error(r.error); return; }
            toast.warning("已判定为未完成", { description: `扣除 ${task.penalty} 金币` });
          }}
        />
      )}
      {showCancel && (
        <ConfirmButton
          trigger={
            <Button variant="ghost" className="w-full text-muted-foreground">
              <Ban />
              取消任务
            </Button>
          }
          title="取消这个任务？"
          description="取消后不发放奖励也不扣金币，并释放执行人当天的任务名额。"
          confirmText="确认取消"
          onConfirm={() => {
            const r = actions.cancelTask(task.id);
            if (!r.ok) { toast.error(r.error); return; }
            toast("任务已取消");
          }}
        />
      )}
    </div>
  );
}

function ConfirmButton({
  trigger,
  title,
  description,
  confirmText,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100%-2.5rem)] rounded-2xl sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl">再想想</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl" onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
