/**
 * 数据仓库接口。
 * 原型阶段使用浏览器本地存储；接入 Lovable Cloud 时，实现同一接口即可替换，
 * 页面和业务逻辑无需改动。
 */
import type { AppState } from "@/domain/types";
import { DEFAULT_DAILY_TASK_LIMIT, MAX_DAILY_TASK_LIMIT, MIN_DAILY_TASK_LIMIT } from "@/domain/tasks";
import { dayKey } from "@/domain/dates";
import { createMockState, STATE_VERSION } from "./mock";

export interface AppRepository {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  reset(): Promise<AppState>;
}

const STORAGE_KEY = "yueding-plan:state";

export class RepositoryDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryDataError";
  }
}

/** 逐字段迁移旧状态，保留任务、提交与流水；缺少执行日期时以截止日作为兼容默认值，不能还原真实历史执行日。 */
export function migrateAppState(state: AppState): AppState {
  return {
    ...state,
    version: STATE_VERSION,
    members: state.members.map((member) => {
      const limit = member.dailyTaskLimit;
      return {
        ...member,
        dailyTaskLimit:
          Number.isInteger(limit) &&
          limit! >= MIN_DAILY_TASK_LIMIT &&
          limit! <= MAX_DAILY_TASK_LIMIT
            ? limit!
            : DEFAULT_DAILY_TASK_LIMIT,
      };
    }),
    tasks: state.tasks.map((task) => ({
      ...task,
      executionDate: task.executionDate ?? dayKey(task.dueAt),
    })),
  };
}

export function createLocalRepository(storage: Storage | (() => Storage)): AppRepository {
  let protectedDataReason: string | null = null;
  const getStorage = () => (typeof storage === "function" ? storage() : storage);
  const migrateSafely = (state: AppState) => {
    try {
      return migrateAppState(state);
    } catch {
      protectedDataReason = "本地数据结构无法读取，原始内容已保留并阻止写入。请先备份或修复数据。";
      throw new RepositoryDataError(protectedDataReason);
    }
  };

  return {
    async load() {
      let raw: string | null;
      try {
        raw = getStorage().getItem(STORAGE_KEY);
      } catch {
        protectedDataReason = "无法读取本地数据，已阻止写入以保护现有内容。";
        throw new RepositoryDataError(protectedDataReason);
      }

      if (raw !== null) {
        let parsed: AppState;
        try {
          parsed = JSON.parse(raw) as AppState;
        } catch {
          protectedDataReason = "本地数据无法解析，原始内容已保留并阻止写入。请先备份或修复数据。";
          throw new RepositoryDataError(protectedDataReason);
        }

        if (parsed.version === STATE_VERSION) return migrateSafely(parsed);
        if (parsed.version === 1) {
          const migrated = migrateSafely(parsed);
          await this.save(migrated);
          return migrated;
        }

        protectedDataReason = `检测到不支持的数据版本（${String(parsed.version)}），原始内容已保留并阻止写入。`;
        throw new RepositoryDataError(protectedDataReason);
      }

      const fresh = createMockState();
      await this.save(fresh);
      return fresh;
    },
    async save(state) {
      if (protectedDataReason) throw new RepositoryDataError(protectedDataReason);
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        throw new RepositoryDataError("无法保存本地数据，请检查浏览器存储空间和权限。");
      }
    },
    async reset() {
      if (protectedDataReason) throw new RepositoryDataError(protectedDataReason);
      const fresh = createMockState();
      await this.save(fresh);
      return fresh;
    },
  };
}

export const localRepository = createLocalRepository(() => window.localStorage);
