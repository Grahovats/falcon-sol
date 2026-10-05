import { AlertTriangle, ArrowDownWideNarrow, ArrowRight, Check, ChevronDown, Clock3, Radar, Search, Users, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Mission } from "../../types/mission";
import { MissionCard } from "./MissionCard";
import { useMissions } from "./useMissions";

type Filter = "ALL" | "LIVE" | "UPCOMING" | "COMPLETED";
type Sort = "SOONEST" | "POPULAR";

const filters: { label: string; value: Filter }[] = [
  { label: "All missions", value: "ALL" },
  { label: "Live", value: "LIVE" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Completed", value: "COMPLETED" },
];

const sortOptions = [
  { label: "Soonest", description: "Starting first", value: "SOONEST", icon: Clock3 },
  { label: "Most joined", description: "Most operators participating", value: "POPULAR", icon: Users },
] satisfies { label: string; description: string; value: Sort; icon: typeof Clock3 }[];

const LIVE_STATUSES = ["ACTIVE", "BLACKOUT"] as const;
const UPCOMING_STATUSES = ["DRAFT", "REGISTRATION", "LOCKED"] as const;
const COMPLETED_STATUSES = [
  "SETTLING",
  "FINALIZED",
  "CLOSED",
  "CANCELLED",
] as const;

export function MissionsGrid() {
  const { state, retry } = useMissions();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("SOONEST");
  const searchRef = useRef<HTMLInputElement>(null);

  if (state.status === "loading") return <MissionsSkeleton />;
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-6" role="alert">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-ink">Mission feed unavailable</h2>
        <p className="mt-2 text-sm text-muted">
          {state.message} Check that the API and database are running.
        </p>
        <button
          type="button"
          onClick={retry}
          className="focus-ring mt-5 min-h-11 rounded-md border border-line px-4 text-sm font-medium text-ink hover:border-primary"
        >
          Retry connection
        </button>
      </div>
    );
  }
  if (state.missions.length === 0) {
    return <MissionEmptyState filter="ALL" query="" />;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const missions = [...state.missions]
    .filter((mission) => matchesFilter(mission, filter))
    .filter((mission) => {
      if (!normalizedQuery) return true;
      return (
        mission.name.toLowerCase().includes(normalizedQuery) ||
        mission.description?.toLowerCase().includes(normalizedQuery) ||
        mission.markets.some((market) => market.symbol.toLowerCase().includes(normalizedQuery))
      );
    })
    .sort((left, right) =>
      sort === "POPULAR"
        ? right.operatorCount - left.operatorCount
        : new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  return (
    <div>
      <div className="grid min-w-0 gap-3 border-b border-line pb-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="mission-filter-scroll min-w-0 overflow-x-auto">
          <div className="flex w-max gap-2" role="group" aria-label="Filter missions">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
                className={`focus-ring min-h-10 shrink-0 rounded-md border px-3 text-xs font-semibold motion-safe:transition-colors motion-safe:duration-100 ${
                  filter === item.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-line bg-surface/70 text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mission-toolbar-controls">
          <div className="mission-search-field">
            <label htmlFor="mission-search" className="sr-only">Search missions</label>
            <Search className="mission-search-icon size-[18px]" aria-hidden="true" />
            <input
              ref={searchRef}
              id="mission-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Search missions…"
              autoComplete="off"
              className="mission-toolbar-input"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                className="mission-search-clear focus-ring"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <SortMenu value={sort} onChange={setSort} />
        </div>
      </div>

      {missions.length === 0 ? (
        <MissionEmptyState
          filter={filter}
          query={query}
          onReset={() => {
            setQuery("");
            setFilter("ALL");
          }}
        />
      ) : (
        <div key={filter} className="state-content mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {missions.map((mission, index) => (
            <MissionCard key={mission.id} mission={mission} entranceIndex={index} />
          ))}
        </div>
      )}
    </div>
  );
}

const emptyFilterMessages: Record<Filter, { title: string; description: string }> = {
  ALL: {
    title: "No missions on radar",
    description: "The next competition is still ahead. Check back for new missions and your next chance to compete.",
  },
  LIVE: {
    title: "A quiet moment in the arena",
    description: "No missions are live right now. Explore upcoming missions and find your next competition.",
  },
  UPCOMING: {
    title: "Your next mission is on the horizon",
    description: "No upcoming missions are scheduled yet. Explore the arena while you wait for the next launch.",
  },
  COMPLETED: {
    title: "The record is still being written",
    description: "No completed missions yet. Once a competition finishes, you’ll find its results here.",
  },
};

function MissionEmptyState({ filter, query, onReset }: {
  filter: Filter;
  query: string;
  onReset?: () => void;
}) {
  const searching = query.trim().length > 0;
  const message = searching
    ? { title: "No missions found", description: "Try a different mission name or market symbol, or clear your filters to explore the arena." }
    : emptyFilterMessages[filter];
  const Icon = searching ? Search : Radar;

  return (
    <section className="mission-empty-state" aria-label="No missions">
      <div className="mission-empty-content">
        <div className="mission-empty-radar" aria-hidden="true">
          <span className="mission-empty-orbit" />
          <span className="mission-empty-orbit mission-empty-orbit-inner" />
          <span className="mission-empty-signal" />
          <span className="mission-empty-icon"><Icon className="size-7" strokeWidth={1.5} /></span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {searching ? "Search results" : "Mission radar"}
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{message.title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">{message.description}</p>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-5 text-xs font-semibold text-ink motion-safe:transition-colors motion-safe:duration-150 hover:border-primary/50 hover:text-primary"
          >
            {searching ? "Clear filters" : "Explore all missions"}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SortMenu({ value, onChange }: { value: Sort; onChange: (value: Sort) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, sortOptions.findIndex((option) => option.value === value));
  const selectedOption = sortOptions[selectedIndex];

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedIndex]?.focus();

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open, selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="mission-sort"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Sort missions: ${selectedOption.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          setOpen(true);
        }}
        className="mission-sort-trigger"
      >
        <ArrowDownWideNarrow className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`mission-sort-chevron size-4 shrink-0 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Sort missions"
          className="mission-sort-menu"
          onKeyDown={(event) => {
            const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
            let nextIndex: number;
            if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % sortOptions.length;
            else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + sortOptions.length) % sortOptions.length;
            else if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = sortOptions.length - 1;
            else return;
            event.preventDefault();
            optionRefs.current[nextIndex]?.focus();
          }}
        >
          {sortOptions.map((option, index) => {
            const selected = option.value === value;
            const Icon = option.icon;
            return (
              <button
                ref={(element) => { optionRefs.current[index] = element; }}
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`mission-sort-option ${selected ? "is-selected" : ""}`}
              >
                <span className="mission-sort-option-icon"><Icon className="size-[18px]" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{option.label}</span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function matchesFilter(mission: Mission, filter: Filter) {
  if (filter === "ALL") return true;
  if (filter === "LIVE") {
    return LIVE_STATUSES.includes(mission.status as (typeof LIVE_STATUSES)[number]);
  }
  if (filter === "UPCOMING") {
    return UPCOMING_STATUSES.includes(
      mission.status as (typeof UPCOMING_STATUSES)[number],
    );
  }
  return COMPLETED_STATUSES.includes(
    mission.status as (typeof COMPLETED_STATUSES)[number],
  );
}

function MissionsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading missions">
      <div className="h-14 animate-pulse border-b border-line bg-surface" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
