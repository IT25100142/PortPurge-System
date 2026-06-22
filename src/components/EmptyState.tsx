export type EmptyStateVariant = "no-ports" | "no-results" | "permission-denied";

interface EmptyStateConfig {
  imageSrc: string;
  title: string;
  description: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateVariant, EmptyStateConfig> = {
  "no-ports": {
    imageSrc: "/illustrations/empty-ports.webp",
    title: "No localhost ports active",
    description:
      "No TCP listeners or UDP binds were found on 127.0.0.1, ::1, or localhost. Start a dev server or check back after refreshing.",
  },
  "no-results": {
    imageSrc: "/illustrations/no-results.webp",
    title: "No matching ports",
    description:
      "Nothing matches your current search or protocol filter. Try clearing filters or broadening your search.",
  },
  "permission-denied": {
    imageSrc: "/illustrations/permission-denied.webp",
    title: "Permission denied",
    description:
      "This process could not be terminated. Run PortPurge as administrator (Windows) or with sudo (macOS/Linux) and try again.",
  },
};

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onClearFilters?: () => void;
}

export function EmptyState({ variant, onClearFilters }: EmptyStateProps) {
  const { imageSrc, title, description } = EMPTY_STATE_CONFIG[variant];

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center animate-fade-in">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <img
          src={imageSrc}
          alt=""
          width={128}
          height={128}
          loading="lazy"
          className="illustration-blend w-28 h-28 object-contain"
        />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      {variant === "no-results" && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-lg px-2 py-1"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
