import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Home, NotebookPen, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { IdentitySwitcher } from "./IdentitySwitcher";

/** 手机优先的应用外壳：桌面端居中显示为手机宽度的卡片 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background md:mt-6 md:min-h-[calc(100dvh-1.5rem)] md:rounded-t-[2rem] md:shadow-lift">
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const item =
    "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] text-muted-foreground transition-colors";
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t bg-card/95 px-6 pt-2 backdrop-blur">
      <div className="flex items-end">
        <Link
          to="/"
          className={item}
          activeOptions={{ exact: true }}
          activeProps={{ className: "text-primary font-medium" }}
        >
          <Home className="size-5" />
          小组
        </Link>
        <Link to="/tasks/new" className={cn(item, "-mt-6")} activeProps={{ className: "text-primary font-medium" }}>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95">
            <Plus className="size-6" />
          </span>
          布置任务
        </Link>
        <Link to="/me" className={item} activeProps={{ className: "text-primary font-medium" }}>
          <NotebookPen className="size-5" />
          记录
        </Link>
      </div>
    </nav>
  );
}

/** 子页面顶部栏：返回 + 标题 + 身份切换 */
export function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 bg-background/90 px-4 py-3 backdrop-blur">
      {back && (
        <button
          type="button"
          aria-label="返回"
          onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
          className="-ml-1 flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <h1 className="flex-1 font-display text-lg font-bold">{title}</h1>
      <IdentitySwitcher />
    </header>
  );
}

export function LoadingScreen() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 bg-background">
      <div className="size-10 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
      <p className="text-sm text-muted-foreground">正在打开约定大作战…</p>
    </div>
  );
}
