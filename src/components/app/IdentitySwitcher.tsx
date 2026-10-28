import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore, useCurrentUser } from "@/store/app-store";
import { MemberAvatar } from "./primitives";

/** 原型阶段的“模拟登录”：切换当前身份以体验不同角色的操作 */
export function IdentitySwitcher() {
  const { state, actions } = useAppStore();
  const me = useCurrentUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-2.5 text-sm shadow-soft transition-colors hover:bg-accent"
          aria-label="切换身份"
        >
          <MemberAvatar member={me} size="sm" />
          <span className="font-medium">{me.name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          模拟身份（原型演示用）
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {state.members.map((m) => (
          <DropdownMenuItem
            key={m.id}
            className="gap-2 rounded-lg py-2"
            onSelect={() => {
              if (m.id === me.id) return;
              actions.switchUser(m.id);
              toast(`已切换为「${m.name}」`, { description: "现在你可以以 TA 的身份提交或验收任务" });
            }}
          >
            <MemberAvatar member={m} size="xs" />
            <span className="flex-1">{m.name}</span>
            {m.id === me.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
