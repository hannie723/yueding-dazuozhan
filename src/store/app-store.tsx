/**
 * 前端状态容器：把领域服务（src/domain/services.ts）和数据仓库连接到 React。
 * 页面只调用这里暴露的 actions，不直接修改数据。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { localRepository, type AppRepository } from "@/data/repository";
import { emit } from "@/domain/events";
import * as services from "@/domain/services";
import type { ServiceResult } from "@/domain/services";
import type { NewTaskErrors, NewTaskInput } from "@/domain/tasks";
import type { AppState, DomainContext, MemberId, ReviewDecision, Screenshot, Task } from "@/domain/types";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: NewTaskErrors | undefined };

interface AppStore {
  state: AppState;
  now: Date;
  actions: {
    switchUser(id: MemberId): void;
    createTask(input: NewTaskInput): ActionResult<Task>;
    submitEvidence(input: { taskId: string; note: string; screenshots: Screenshot[] }): ActionResult;
    reviewTask(input: { taskId: string; decision: ReviewDecision; comment?: string | undefined }): ActionResult<"approved" | "rejected" | "pending">;
    markFailed(taskId: string): ActionResult;
    cancelTask(taskId: string): ActionResult;
    settleOverdue(): ActionResult<number>;
    resetDemo(): Promise<void>;
  };
}

const AppStoreContext = createContext<AppStore | null>(null);

function makeContext(): DomainContext {
  return {
    now: new Date(),
    newId: () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function AppStoreProvider({
  children,
  repository = localRepository,
  fallback,
}: {
  children: ReactNode;
  repository?: AppRepository;
  fallback?: ReactNode;
}) {
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    let alive = true;
    repository.load().then((s) => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
    });
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [repository]);

  const commit = useCallback(
    (next: AppState) => {
      stateRef.current = next;
      setState(next);
      setNow(new Date());
      void repository.save(next);
    },
    [repository],
  );

  const run = useCallback(
    <T,>(fn: (s: AppState, ctx: DomainContext) => ServiceResult<T>): ActionResult<T> => {
      const current = stateRef.current;
      if (!current) return { ok: false, error: "数据还在加载中" };
      const result = fn(current, makeContext());
      if (!result.ok) return result;
      commit(result.state);
      emit(result.events);
      return { ok: true, data: result.data };
    },
    [commit],
  );

  const actions = useMemo<AppStore["actions"]>(
    () => ({
      switchUser(id) {
        const current = stateRef.current;
        if (current) commit({ ...current, currentUserId: id });
      },
      createTask: (input) => run((s, ctx) => services.createTask(s, input, ctx)),
      submitEvidence: (input) => run((s, ctx) => services.submitEvidence(s, input, ctx)),
      reviewTask: (input) => run((s, ctx) => services.reviewTask(s, input, ctx)),
      markFailed: (taskId) => run((s, ctx) => services.markFailed(s, taskId, ctx)),
      cancelTask: (taskId) => run((s, ctx) => services.cancelTask(s, taskId, ctx)),
      settleOverdue: () => run((s, ctx) => services.settleOverdue(s, ctx)),
      async resetDemo() {
        commit(await repository.reset());
      },
    }),
    [run, commit, repository],
  );

  if (!state) return <>{fallback ?? null}</>;

  return (
    <AppStoreContext.Provider value={{ state, now, actions }}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}

/* ---------- 便捷选择器 ---------- */

export function useMembers() {
  const { state } = useAppStore();
  return useMemo(() => {
    const map = new Map(state.members.map((m) => [m.id, m]));
    return { list: state.members, get: (id: MemberId) => map.get(id) };
  }, [state.members]);
}

export function useCurrentUser() {
  const { state } = useAppStore();
  return (state.members.find((m) => m.id === state.currentUserId) ?? state.members[0])!;
}
