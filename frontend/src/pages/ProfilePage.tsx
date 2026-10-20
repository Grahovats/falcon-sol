import {
  ArrowUpRight,
  Award,
  RotateCw,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { getProfile, updateProfile, type ProfileSummary } from "../api/profile";
import { AuthenticationRequired } from "../components/AuthenticationRequired";
import { SolanaAccountIcon } from "../components/SolanaAccountIcon";
import { formatCurrency, formatPercent } from "../lib/format";
import { useAuth } from "../providers/auth-context";
import "./RecordPages.css";

type State =
  | { status: "loading" }
  | { status: "success"; data: ProfileSummary }
  | { status: "error"; message: string };

const monthYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const missionDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function ProfilePage() {
  const auth = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "loading" });
    try {
      const { data } = await getProfile(signal);
      setState({ status: "success", data });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Profile could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [auth.status, auth.user?.userId, load]);

  if (auth.status === "loading" || auth.status === "signing")
    return <ProfileSkeleton />;
  if (auth.status !== "authenticated")
    return <AuthenticationRequired title="View your profile" />;
  if (state.status === "loading") return <ProfileSkeleton />;
  if (state.status === "error")
    return <ProfileError message={state.message} retry={() => void load()} />;

  const profile = state.data;
  const winRate = profile.missionsEntered
    ? (profile.wins / profile.missionsEntered) * 100
    : 0;
  const bestReturn = profile.bestResult
    ? Number(profile.bestResult.returnPercent)
    : null;

  return (
    <div className="record-workspace profile-workspace state-content">
      <div className="dossier-layout">
        <aside className="dossier-identity" aria-label="Operator profile">
          <div className="dossier-avatar"><SolanaAccountIcon address={profile.wallet ?? profile.userId} size="xl" /></div>
          <p className="record-eyebrow">Falcon operator</p>
          <h2>{profile.username}</h2>
          <p className="dossier-wallet"><WalletCards className="size-3.5" aria-hidden="true" />{compactWallet(profile.wallet)}</p>
          <button type="button" onClick={() => setEditing(true)} className="record-action focus-ring">Edit profile <ArrowUpRight className="size-4" aria-hidden="true" /></button>
          <dl className="dossier-details">
            <div><dt>Member since</dt><dd>{monthYearFormatter.format(new Date(profile.memberSince))}</dd></div>
            <div><dt>Missions entered</dt><dd>{profile.missionsEntered}</dd></div>
            <div><dt>Podium finishes</dt><dd>{profile.topThreeFinishes}</dd></div>
          </dl>
          <Link to="/missions" className="dossier-next focus-ring"><span>Build your track record<strong>Find your next mission</strong></span><ArrowUpRight className="size-5" aria-hidden="true" /></Link>
        </aside>
        <div className="dossier-main">
          <section className="dossier-performance" aria-labelledby="performance-title">
            <div className="record-section-title"><h2 id="performance-title">Performance overview</h2><span>Career record</span></div>
            <div className="dossier-performance-grid">
              <div className="dossier-return"><p>Average return</p><strong className={Number(profile.averageReturn) >= 0 ? "text-primary" : "text-danger"}>{formatPercent(profile.averageReturn)}</strong><span>Across your mission record</span></div>
              <dl className="dossier-stats">
                <ProfileMetric label="Wins" value={String(profile.wins)} />
                <ProfileMetric label="Win rate" value={formatPercent(winRate)} />
                <ProfileMetric label="Best return" value={bestReturn === null ? "—" : formatPercent(bestReturn)} positive={bestReturn !== null && bestReturn >= 0} />
              </dl>
            </div>
          </section>
          <section className="dossier-highlight" aria-label="Personal best">
            <div className="dossier-best-place"><span>Best finish</span><strong>{profile.bestResult?.rank ? `#${profile.bestResult.rank}` : "—"}</strong></div>
            <div className="dossier-best-details"><p className="record-eyebrow">Personal best</p><h2>{profile.bestResult?.missionName ?? "Your first result starts here"}</h2><p>{profile.bestResult ? missionDateFormatter.format(new Date(profile.bestResult.missionDate)) : "Enter a mission to establish your record."}</p></div>
            <div className="dossier-best-result"><span>Return</span><strong className={bestReturn !== null && bestReturn < 0 ? "text-danger" : "text-primary"}>{bestReturn === null ? "—" : formatPercent(bestReturn)}</strong><Link to={profile.bestResult ? `/missions/${profile.bestResult.missionId}` : "/missions"} className="dossier-best-link focus-ring">{profile.bestResult ? "View mission" : "Explore missions"}<ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
          </section>
      <section
        className="record-panel dossier-history overflow-hidden"
        aria-labelledby="records-title"
      >
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-5 sm:px-6">
          <h2 id="records-title" className="text-sm font-semibold text-ink">
            Mission history
          </h2>
          <p className="text-xs text-muted">{profile.results.length} records · Most recent first</p>
        </div>
        {profile.results.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Trophy
              className="mx-auto size-7 text-primary"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-semibold text-ink">
              No mission history yet
            </h3>
            <p className="mt-2 text-sm text-muted">
              Deploy into a mission to establish your operator record.
            </p>
            <Link
              to="/missions"
              className="app-button focus-ring mt-5 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-ink"
            >
              Browse missions
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="app-table w-full min-w-[850px] text-left">
                <thead className="border-b border-line bg-surface-muted text-xs text-muted">
                  <tr>
                    <th className="px-5 py-4 font-normal sm:px-6">Mission</th>
                    <th className="px-5 py-4 font-normal">Return</th>
                    <th className="px-5 py-4 font-normal">Rank</th>
                    <th className="px-5 py-4 font-normal">Final equity</th>
                    <th className="px-5 py-4 font-normal">Finish</th>
                    <th className="w-20 px-5 py-4">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {profile.results.map((result) => (
                    <MissionRow key={result.missionId} result={result} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-line md:hidden">
              {profile.results.map((result) => (
                <MissionCard key={result.missionId} result={result} />
              ))}
            </div>
          </>
        )}
      </section>
      <p className="mt-4 text-xs leading-5 text-muted">
        Historical records reflect your completed and active paper-trading
        missions. No real assets are used.
      </p>

        </div>
      </div>

      <EditProfileDialog
        open={editing}
        username={profile.username}
        onClose={() => setEditing(false)}
        onSaved={(username) => {
          setState({ status: "success", data: { ...profile, username } });
          setEditing(false);
        }}
      />
    </div>
  );
}

type Result = ProfileSummary["results"][number];

function MissionRow({ result }: { result: Result }) {
  const finish = getFinish(result.rank);
  const positive = Number(result.returnPercent) >= 0;
  return (
    <tr className="group hover:bg-primary/[0.025]">
      <td className="px-5 py-4 sm:px-6">
        <Link
          to={`/missions/${result.missionId}`}
          className="focus-ring inline-flex min-h-10 flex-col justify-center font-semibold text-ink group-hover:text-primary"
        >
          <span>{result.missionName}</span>
          <span className="mt-1 text-[11px] font-normal text-muted">
            {missionDateFormatter.format(new Date(result.missionDate))}
          </span>
        </Link>
      </td>
      <td
        className={`px-5 py-4 font-mono text-sm font-semibold tabular-nums ${positive ? "text-primary" : "text-danger"}`}
      >
        {formatPercent(result.returnPercent)}
      </td>
      <td className="px-5 py-4 font-mono text-sm tabular-nums text-ink">
        <span
          className={
            result.rank !== null && result.rank <= 3
              ? "text-primary"
              : "text-ink"
          }
        >
          {result.rank ? `#${result.rank}` : "N/A"}
        </span>
        <span className="text-muted"> / {result.participantCount}</span>
      </td>
      <td className="px-5 py-4 font-mono text-sm font-semibold tabular-nums text-ink">
        {formatCurrency(result.equity)}
      </td>
      <td className="px-5 py-4">
        <FinishBadge finish={finish} />
      </td>
      <td className="px-5 py-4">
        <Link
          to={`/missions/${result.missionId}`}
          aria-label={`Open ${result.missionName}`}
          className="app-button app-table-action focus-ring flex size-10 items-center justify-center rounded-md text-muted hover:text-primary"
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

function MissionCard({ result }: { result: Result }) {
  const positive = Number(result.returnPercent) >= 0;
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={`/missions/${result.missionId}`}
            className="focus-ring inline-flex min-h-10 items-center font-semibold text-ink hover:text-primary"
          >
            {result.missionName}
          </Link>
          <p className="text-[11px] text-muted">
            {missionDateFormatter.format(new Date(result.missionDate))}
          </p>
        </div>
        <FinishBadge finish={getFinish(result.rank)} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <MobileMetric
          label="Return"
          value={formatPercent(result.returnPercent)}
          className={positive ? "text-primary" : "text-danger"}
        />
        <MobileMetric
          label="Rank"
          value={`${result.rank ? `#${result.rank}` : "N/A"} / ${result.participantCount}`}
        />
        <MobileMetric label="Equity" value={formatCurrency(result.equity)} />
      </dl>
    </article>
  );
}

function ProfileMetric({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="record-metric">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${positive ? "text-primary" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  className = "text-ink",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd
        className={`mt-1.5 truncate font-mono text-xs font-semibold ${className}`}
      >
        {value}
      </dd>
    </div>
  );
}

function FinishBadge({
  finish,
}: {
  finish: "Winner" | "Podium" | "Completed";
}) {
  return finish === "Completed" ? (
    <span className="text-xs font-medium text-muted">Completed</span>
  ) : (
    <span className="inline-flex rounded border border-primary/25 bg-primary/[0.07] px-2 py-1 text-xs font-semibold text-primary">
      {finish}
    </span>
  );
}

function EditProfileDialog({
  open,
  username,
  onClose,
  onSaved,
}: {
  open: boolean;
  username: string;
  onClose: () => void;
  onSaved: (username: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValue(username);
      setError("");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, username]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await updateProfile(value);
      onSaved(data.username);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Profile could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="edit-profile-title"
      className="profile-edit-dialog app-modal wallet-dialog m-auto w-[min(92vw,30rem)] p-0 text-ink"
    >
      <form onSubmit={submit} className="p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="edit-profile-title" className="text-xl font-semibold">
            Edit profile
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="app-button focus-ring flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-raised hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <label
          htmlFor="operator-name"
          className="mt-6 block text-xs font-medium text-muted"
        >
          Operator name
        </label>
        <input
          id="operator-name"
          name="username"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-zA-Z0-9_-]+"
          autoComplete="username"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="app-field focus-ring mt-2 min-h-11 w-full rounded-md px-3 text-sm text-ink"
        />
        {error && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="app-button focus-ring min-h-11 rounded-md px-4 text-sm font-semibold text-ink"
          >
            Cancel
          </button>
          <button
            disabled={busy || value.trim() === username}
            aria-busy={busy}
            className="app-button focus-ring min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function compactWallet(wallet: string | null) {
  return wallet
    ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
    : "Authenticated Falcon operator";
}

function getFinish(rank: number | null): "Winner" | "Podium" | "Completed" {
  if (rank === 1) return "Winner";
  if (rank !== null && rank <= 3) return "Podium";
  return "Completed";
}

function ProfileSkeleton() {
  return (
    <div
      className="record-workspace space-y-6 py-6"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="app-subtle-surface h-20 motion-safe:animate-pulse bg-surface" />
      <div className="app-surface h-72 motion-safe:animate-pulse rounded-[10px] border border-line bg-surface" />
      <div className="app-surface h-80 motion-safe:animate-pulse rounded-[10px] border border-line bg-surface" />
    </div>
  );
}

function ProfileError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div
      className="w-full rounded-[10px] border border-danger/40 bg-danger/5 p-6"
      role="alert"
    >
      <Award className="size-5 text-danger" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-ink">
        Profile unavailable
      </h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={retry}
        className="app-button focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink hover:border-primary"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}
