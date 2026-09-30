import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CommissionerGate } from "@/components/commissioner";
import { DraftRoom } from "@/components/draft/room";

// The draft room and War Room: commissioner only. Client-only: the session lives in the browser.
export const Route = createFileRoute("/draft")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Draft Room — War Room Hockey Pool" }, { name: "robots", content: "noindex" }],
  }),
  component: DraftPage,
});

function DraftPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
      <h1 className="mb-4 text-4xl font-extrabold uppercase sm:text-5xl">Draft room</h1>
      <CommissionerGate>{() => <DraftRoom />}</CommissionerGate>
      <Toaster position="bottom-center" richColors closeButton />
    </main>
  );
}
