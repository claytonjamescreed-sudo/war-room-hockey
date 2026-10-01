import { EllipsisVertical, Share, Smartphone, SquarePlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deviceOf, type Device } from "@/lib/install";

// Chrome and Edge offer their own install prompt. It fires once, around page load, so it's caught
// here as soon as this file loads rather than when the button mounts.
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let deferred: InstallPrompt | null = null;
if (typeof window !== "undefined")
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });

// Already opened from the home screen
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function Step({ n, children, note }: { n: number; children: ReactNode; note?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-accent-foreground">
        {n}
      </span>
      <span className="pt-0.5">
        <span className="font-semibold">{children}</span>
        {note && <span className="mt-0.5 block text-sm text-muted-foreground">{note}</span>}
      </span>
    </li>
  );
}

const Icon = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex translate-y-0.5 items-center">{children}</span>
);

function Steps({ device }: { device: Device }) {
  if (device === "ios")
    return (
      <ol className="space-y-4">
        <Step
          n={1}
          note="Tapped the link in WhatsApp? If you don't see Safari's buttons, choose Open in Safari first."
        >
          Open this page in Safari
        </Step>
        <Step
          n={2}
          note="At the bottom of the screen. On newer iPhones, tap ••• first, then Share. In Chrome it's at the top right."
        >
          Tap Share{" "}
          <Icon>
            <Share className="h-5 w-5" aria-label="the Share button" />
          </Icon>
        </Step>
        <Step n={3} note="You may need to scroll down the list.">
          Tap Add to Home Screen{" "}
          <Icon>
            <SquarePlus className="h-5 w-5" aria-hidden />
          </Icon>
        </Step>
        <Step
          n={4}
          note="WG Hockey Pool lands on your Home Screen with the gold icon, one tap away."
        >
          Tap Add
        </Step>
      </ol>
    );
  if (device === "android")
    return (
      <ol className="space-y-4">
        <Step n={1} note="Tapped the link in WhatsApp? Tap ⋮ and choose Open in Chrome first.">
          Open this page in Chrome
        </Step>
        <Step n={2} note="At the top right of the screen.">
          Tap the menu{" "}
          <Icon>
            <EllipsisVertical className="h-5 w-5" aria-label="the three-dot menu" />
          </Icon>
        </Step>
        <Step n={3} note="Then tap Add or Install to confirm.">
          Tap Add to Home screen or Install app
        </Step>
      </ol>
    );
  return (
    <ol className="space-y-4">
      <Step n={1} note="In Chrome or Edge, or use the browser's menu and look for Install.">
        Click the install icon at the right of the address bar
      </Step>
      <Step n={2} note="Open the site on your phone and tap Get the app for its steps.">
        On a phone?
      </Step>
    </ol>
  );
}

// "Get the app" in the header: the browser's own install prompt where there is one, otherwise the
// steps to save WG Hockey Pool to the home screen. Hidden once it's opened from the home screen.
export function InstallButton({ variant = "pill" }: { variant?: "pill" | "row" }) {
  const [device, setDevice] = useState<Device | null>(null); // null on the server and when installed
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!standalone()) setDevice(deviceOf(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  if (!device) return null;
  const onClick = async () => {
    const prompt = deferred;
    if (!prompt) return setOpen(true);
    deferred = null; // each prompt can only be shown once
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setDevice(null);
  };
  return (
    <>
      {variant === "row" ? (
        <button
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-lg font-semibold uppercase tracking-wider text-band-foreground/80 hover:bg-band-foreground/10"
        >
          <Smartphone className="h-6 w-6" aria-hidden />
          Get the app
        </button>
      ) : (
        <button
          onClick={onClick}
          aria-label="Get the app"
          className="flex items-center gap-1.5 rounded-full border border-band-foreground/40 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-band-foreground hover:bg-band-foreground/10 sm:gap-2 sm:px-3 sm:text-sm"
        >
          <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          {/* On most phones the icon alone, so the header stays on one line beside the site's
              name; the phone menu has it spelled out */}
          <span className="hidden min-[480px]:inline">Get the app</span>
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-extrabold uppercase">
              WG Hockey Pool on your home screen
            </DialogTitle>
            <DialogDescription className="text-base">
              It opens like an app: full screen, one tap away, no app store needed.
            </DialogDescription>
          </DialogHeader>
          <Steps device={device} />
        </DialogContent>
      </Dialog>
    </>
  );
}
