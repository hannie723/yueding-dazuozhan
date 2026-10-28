/**
 * 数据仓库接口。
 * 原型阶段使用浏览器本地存储；接入 Lovable Cloud 时，实现同一接口即可替换，
 * 页面和业务逻辑无需改动。
 */
import type { AppState } from "@/domain/types";
import { createMockState, STATE_VERSION } from "./mock";

export interface AppRepository {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  reset(): Promise<AppState>;
}

const STORAGE_KEY = "yueding-plan:state";

export const localRepository: AppRepository = {
  async load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed.version === STATE_VERSION) return parsed;
      }
    } catch {
      // 数据损坏时回退到模拟数据
    }
    const fresh = createMockState();
    await this.save(fresh);
    return fresh;
  },
  async save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储空间不足时忽略，原型仍可在内存中运行
    }
  },
  async reset() {
    const fresh = createMockState();
    await this.save(fresh);
    return fresh;
  },
};
