import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { UpdateNotice } from "@/components/update-notice";
import appCss from "../styles.css?url";
import { freshStart, freshStartOnce, isStaleChunk, newerBuildIsOut } from "../lib/fresh";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // Most often this page is an older version that has lost its files: go to the newest one
    if (isStaleChunk(error)) freshStartOnce();
    else void newerBuildIsOut().then((stale) => stale && freshStartOnce());
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            // A clean load of the newest version, not another go at the request that failed
            onClick={freshStart}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WG Hockey Pool" },
      {
        name: "description",
        content: "Standings and live points for our 15-team NHL hockey pool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Saved to a phone's home screen it opens full screen as "WG Hockey Pool" (see install-button.tsx)
      { name: "theme-color", content: "#15130F" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "WG Hockey Pool" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // The logo for the browser tab; the square PNG is for browsers that don't take SVG icons
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "64x64" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Big+Shoulders+Display:wght@600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  // A sign-in link that lands anywhere else (if the auth redirect to /admin isn't allowed) still
  // signs the commissioner in, then goes to /admin
  useEffect(() => {
    const { hash, search, pathname } = window.location;
    if (!/access_token=/.test(hash) && !/[?&]code=/.test(search)) return;
    if (pathname === "/admin" || pathname === "/draft") return;
    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      await supabase.auth.getSession();
      router.navigate({ to: "/admin" });
    });
  }, [router]);
  // The TV board fills the screen on its own
  const bare = useRouterState({ select: (s) => s.location.pathname === "/tv" });

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      {/* First, so that on phones its bar sits above the header */}
      <UpdateNotice />
      {!bare && <SiteHeader />}
      <Outlet />
      {!bare && <SiteFooter />}
    </QueryClientProvider>
  );
}
