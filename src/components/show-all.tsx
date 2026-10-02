// The button under a long list that shows its first few until asked for the rest; the state behind
// it is useShowAll in hooks/use-show-all.ts.
import { ChevronDown, ChevronUp } from "lucide-react";

export function ShowAllButton({
  all,
  total,
  few,
  onToggle,
}: {
  all: boolean;
  total: number;
  // What the short list is called once the long one is open: "the latest 5", "the top 5"
  few: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={all}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border px-3 py-2.5 font-semibold uppercase tracking-wide hover:bg-muted"
    >
      {all ? (
        <>
          Show {few} <ChevronUp className="h-5 w-5" aria-hidden />
        </>
      ) : (
        <>
          Show all {total} <ChevronDown className="h-5 w-5" aria-hidden />
        </>
      )}
    </button>
  );
}
