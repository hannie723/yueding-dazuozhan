<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Business rules live in pure functions under `src/domain/` (tasks, submissions, coins, progress, services); UI never mutates state directly — why: the same logic can later run server-side when a real backend is added.
- `src/domain/services.ts` returns `{ state, events }`; the React store (`src/store/app-store.tsx`) only applies results and emits events — why: keeps orchestration testable and backend-agnostic.
- Persistence goes through the `AppRepository` interface in `src/data/repository.ts` (currently localStorage + mock seed) — why: swapping in a database means implementing one interface.
- Future features (shop, leaderboard, personal room, notifications) subscribe to `src/domain/events.ts` instead of editing core task/coin logic — why: keeps core modules stable.
- App state is loaded client-side only (store renders a fallback until loaded) — why: mock data depends on the current time and local storage, which would cause SSR hydration mismatches.
- Rule tests live in `src/domain/rules.test.ts`; update them when task limits, coin settlement or voting rules change.
