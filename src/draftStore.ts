import type { DraftSelection } from "./types.js";

const DRAFT_TTL_MS = 15 * 60 * 1000;

export class DraftStore {
  private readonly drafts = new Map<string, DraftSelection>();

  public get(userId: string): DraftSelection {
    const current = this.drafts.get(userId);
    if (!current || Date.now() - current.updatedAt > DRAFT_TTL_MS) {
      const fresh: DraftSelection = { userId, updatedAt: Date.now() };
      this.drafts.set(userId, fresh);
      return fresh;
    }

    return current;
  }

  public reset(userId: string): DraftSelection {
    const fresh: DraftSelection = { userId, updatedAt: Date.now() };
    this.drafts.set(userId, fresh);
    return fresh;
  }

  public patch(userId: string, patch: Partial<Omit<DraftSelection, "userId" | "updatedAt">>): DraftSelection {
    const next: DraftSelection = {
      ...this.get(userId),
      ...patch,
      updatedAt: Date.now(),
    };

    this.drafts.set(userId, next);
    return next;
  }

  public clear(userId: string): void {
    this.drafts.delete(userId);
  }
}
