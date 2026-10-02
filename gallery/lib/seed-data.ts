import type { Category } from "./categories";

export type SeedComponent = {
  title: string;
  description: string;
  category: Category;
  tags: string;
  author: string;
  code: string;
};

export const SEED: SeedComponent[] = [
  {
    title: "Glow Button",
    description: "Primary action button with a soft green glow and press feedback.",
    category: "Buttons",
    tags: "button,cta,glow",
    author: "UIKit",
    code: `<div class="flex min-h-[220px] items-center justify-center bg-slate-950">
  <button class="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-emerald-950 shadow-[0_0_24px_rgb(34_197_94/0.45)] transition hover:bg-emerald-400 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
    Get started
  </button>
</div>`,
  },
  {
    title: "Ghost Button Group",
    description: "Segmented secondary buttons for toolbars and filters.",
    category: "Buttons",
    tags: "button,group,toolbar",
    author: "UIKit",
    code: `<div class="flex min-h-[220px] items-center justify-center bg-slate-950">
  <div class="inline-flex overflow-hidden rounded-lg border border-slate-700">
    <button class="px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800">Day</button>
    <button class="border-x border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white">Week</button>
    <button class="px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800">Month</button>
  </div>
</div>`,
  },
  {
    title: "Stat Card",
    description: "KPI card with delta indicator, ideal for dashboards.",
    category: "Cards",
    tags: "card,kpi,dashboard",
    author: "UIKit",
    code: `<div class="flex min-h-[220px] items-center justify-center bg-slate-950 p-6">
  <div class="w-64 rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <p class="text-sm text-slate-400">Monthly revenue</p>
    <p class="mt-2 font-mono text-3xl font-semibold text-white">$48,290</p>
    <p class="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 8l4-4 4 4"/></svg>
      +12.4%
    </p>
  </div>
</div>`,
  },
  {
    title: "Profile Card",
    description: "Compact user card with avatar, role and follow action.",
    category: "Cards",
    tags: "card,profile,avatar",
    author: "UIKit",
    code: `<div class="flex min-h-[260px] items-center justify-center bg-slate-950 p-6">
  <div class="w-72 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center">
    <div class="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500"></div>
    <p class="mt-3 font-semibold text-white">Aiko Tanaka</p>
    <p class="text-sm text-slate-400">Product Designer</p>
    <button class="mt-4 w-full rounded-lg bg-white py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200">Follow</button>
  </div>
</div>`,
  },
  {
    title: "Email Capture Form",
    description: "Labelled input with inline helper text and submit button.",
    category: "Forms",
    tags: "form,input,email",
    author: "UIKit",
    code: `<form class="flex min-h-[240px] items-center justify-center bg-slate-950 p-6" onsubmit="return false">
  <div class="w-80">
    <label for="e" class="mb-1 block text-sm font-medium text-slate-200">Email</label>
    <input id="e" type="email" placeholder="you@example.com" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
    <p class="mt-1 text-xs text-slate-500">We never share your address.</p>
    <button class="mt-4 w-full rounded-lg bg-emerald-500 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400">Subscribe</button>
  </div>
</form>`,
  },
  {
    title: "Toggle Switch",
    description: "Accessible on/off switch built with a checkbox peer.",
    category: "Forms",
    tags: "toggle,switch,checkbox",
    author: "UIKit",
    code: `<div class="flex min-h-[200px] items-center justify-center bg-slate-950">
  <label class="inline-flex items-center gap-3 text-slate-200">
    <input type="checkbox" class="peer sr-only" checked />
    <span class="relative h-6 w-11 rounded-full bg-slate-700 transition peer-checked:bg-emerald-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-white after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
    Notifications
  </label>
</div>`,
  },
  {
    title: "Top Navbar",
    description: "Responsive-ready navbar with logo, links and sign-in button.",
    category: "Navigation",
    tags: "navbar,header,links",
    author: "UIKit",
    code: `<header class="bg-slate-950 p-4">
  <nav class="mx-auto flex max-w-3xl items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
    <span class="font-mono font-semibold text-white">acme<span class="text-emerald-400">/</span></span>
    <div class="hidden gap-6 text-sm text-slate-300 sm:flex">
      <a href="#" class="hover:text-white">Docs</a>
      <a href="#" class="hover:text-white">Pricing</a>
      <a href="#" class="hover:text-white">Blog</a>
    </div>
    <button class="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200">Sign in</button>
  </nav>
  <div class="h-32"></div>
</header>`,
  },
  {
    title: "Breadcrumb",
    description: "Simple breadcrumb trail with chevrons and current page state.",
    category: "Navigation",
    tags: "breadcrumb,nav",
    author: "UIKit",
    code: `<nav aria-label="Breadcrumb" class="flex min-h-[160px] items-center justify-center bg-slate-950">
  <ol class="flex items-center gap-2 text-sm text-slate-400">
    <li><a href="#" class="hover:text-white">Home</a></li><li aria-hidden="true">/</li>
    <li><a href="#" class="hover:text-white">Library</a></li><li aria-hidden="true">/</li>
    <li aria-current="page" class="text-white">Components</li>
  </ol>
</nav>`,
  },
  {
    title: "Centered Hero",
    description: "Headline, subcopy and two CTAs over a subtle radial glow.",
    category: "Hero",
    tags: "hero,landing,cta",
    author: "UIKit",
    code: `<section class="relative overflow-hidden bg-slate-950 px-6 py-16 text-center">
  <div class="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-[36rem] rounded-full bg-emerald-500/20 blur-3xl"></div>
  <h1 class="relative text-4xl font-bold tracking-tight text-white sm:text-5xl">Ship interfaces faster</h1>
  <p class="relative mx-auto mt-4 max-w-md text-slate-400">Copy-ready components built with Tailwind. No config, no lock-in.</p>
  <div class="relative mt-8 flex justify-center gap-3">
    <a href="#" class="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 hover:bg-emerald-400">Browse</a>
    <a href="#" class="rounded-lg border border-slate-700 px-5 py-2.5 text-slate-200 hover:bg-slate-800">Docs</a>
  </div>
</section>`,
  },
  {
    title: "Status Badges",
    description: "Success, warning and error pills with leading dots.",
    category: "Badges",
    tags: "badge,status,pill",
    author: "UIKit",
    code: `<div class="flex min-h-[180px] items-center justify-center gap-3 bg-slate-950">
  <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400"><i class="h-1.5 w-1.5 rounded-full bg-emerald-400"></i>Active</span>
  <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400"><i class="h-1.5 w-1.5 rounded-full bg-amber-400"></i>Pending</span>
  <span class="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400"><i class="h-1.5 w-1.5 rounded-full bg-red-400"></i>Failed</span>
</div>`,
  },
  {
    title: "Pricing Card",
    description: "Highlighted plan card with feature checklist.",
    category: "Pricing",
    tags: "pricing,plan,card",
    author: "UIKit",
    code: `<div class="flex min-h-[380px] items-center justify-center bg-slate-950 p-6">
  <div class="w-72 rounded-2xl border border-emerald-500/40 bg-slate-900 p-6">
    <p class="text-sm font-medium text-emerald-400">Pro</p>
    <p class="mt-2 text-4xl font-bold text-white">$24<span class="text-base font-normal text-slate-400">/mo</span></p>
    <ul class="mt-5 space-y-2 text-sm text-slate-300">
      <li>✓ Unlimited projects</li><li>✓ Priority support</li><li>✓ Team sharing</li>
    </ul>
    <button class="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 font-medium text-emerald-950 hover:bg-emerald-400">Choose Pro</button>
  </div>
</div>`,
  },
  {
    title: "Spinner",
    description: "Lightweight CSS-only loading spinner.",
    category: "Loaders",
    tags: "loader,spinner,loading",
    author: "UIKit",
    code: `<div class="flex min-h-[180px] items-center justify-center bg-slate-950" role="status" aria-label="Loading">
  <div class="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400"></div>
</div>`,
  },
  {
    title: "Skeleton Card",
    description: "Pulse placeholder to reserve layout while content loads.",
    category: "Loaders",
    tags: "skeleton,loading,placeholder",
    author: "UIKit",
    code: `<div class="flex min-h-[240px] items-center justify-center bg-slate-950 p-6">
  <div class="w-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div class="h-4 w-1/2 rounded bg-slate-700"></div>
    <div class="mt-4 h-3 rounded bg-slate-800"></div>
    <div class="mt-2 h-3 w-5/6 rounded bg-slate-800"></div>
    <div class="mt-5 h-9 rounded-lg bg-slate-800"></div>
  </div>
</div>`,
  },
];
