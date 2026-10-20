/**
 * The suite, in the order one task moves through it. Status and version were checked by hand
 * against each product's latest release and README on `checked`; recheck before changing them.
 */
export interface Product {
  slug: string;
  name: string;
  /** The step this product owns on the home page flow. */
  step: string;
  blurb: string;
  summary: string;
  features: [string, string, string];
  status: string;
  version?: string;
  checked: string;
  /**
   * The product's colour, taken from its logo in the SJL brand pack
   * (sjl-marketing/brand/product-logos/translucent-v2), so a sign, a button
   * and the mark beside them agree. `fg` is text on that colour; `ink` is the
   * colour as text on a light page, darkened until it reads.
   */
  hex: string;
  fg: string;
  ink: string;
  /** the product's own website, when it has one; it is where every "go to" link leads */
  site?: string;
  cta: { label: string; href: string };
  links: { label: string; href: string }[];
}

const GH = 'https://github.com/SuperJackfruitLabs';

export const suite: Product[] = [
  {
    slug: 'supermessage',
    name: 'Supermessage',
    step: 'You talk',
    blurb: 'chat with your agents',
    summary: 'An agent-aware Matrix chat client for iOS, Android, Windows, macOS and Linux. Talk to agents where you already talk to people.',
    features: [
      'One Rust Matrix core under every platform: SwiftUI on iOS, Compose on Android, Tauri on desktop',
      'Agents answer, ask for permission and report progress in the room',
      'End-to-end encrypted by default',
    ],
    status: 'Released',
    version: 'v0.0.15',
    checked: '2026-10-20',
    hex: '#8549ef',
    fg: '#ffffff',
    ink: '#6a35cc',
    site: 'https://supermessage.dev',
    cta: { label: 'Visit supermessage.dev', href: 'https://supermessage.dev' },
    links: [
      { label: 'Download', href: `${GH}/supermessage/releases/latest` },
      { label: 'Source', href: `${GH}/supermessage` },
    ],
  },
  {
    slug: 'superpipeline',
    name: 'Superpipeline',
    step: 'Work is planned',
    blurb: 'boards for agent work',
    summary: 'A Kanban board that coordinates AI agents through pipeline stages and human approval gates. It owns the work; agents bring their own harness.',
    features: [
      'Agents connect over REST or MCP from their own infrastructure',
      'Human approval gates between stages',
      'Multi-tenant boards, templates and recurring work',
    ],
    status: 'Released',
    version: 'v0.0.18',
    checked: '2026-10-20',
    hex: '#ffc21a',
    fg: '#2c2a26',
    ink: '#8a6100',
    site: 'https://superpipeline.dev',
    cta: { label: 'Visit superpipeline.dev', href: 'https://superpipeline.dev' },
    links: [
      { label: 'Docs', href: 'https://docs.superpipeline.dev' },
      { label: 'Source', href: `${GH}/superpipeline` },
    ],
  },
  {
    slug: 'salaam',
    name: 'Salaam',
    step: 'An agent does it',
    blurb: 'a persistent home for agent work',
    summary: 'Code in the terminal, step away, and return to the same session, tasks, approvals and results.',
    features: [
      'A persistent local session service: sal service start',
      'Attach from any terminal, or observe without taking over',
      'Tasks, approvals and results survive you closing the window',
    ],
    status: 'Released',
    version: 'v0.0.2',
    checked: '2026-10-20',
    hex: '#f74783',
    fg: '#ffffff',
    ink: '#c42a62',
    site: 'https://salaam.sh',
    cta: { label: 'Visit salaam.sh', href: 'https://salaam.sh' },
    links: [
      { label: 'Docs', href: 'https://docs.salaam.sh' },
      { label: 'Source', href: `${GH}/salaam` },
    ],
  },
  {
    slug: 'agentpod',
    name: 'AgentPod',
    step: 'Your fleet runs it',
    blurb: 'hosts and supervises agents',
    summary: 'The fleet and facilities console for agent runtimes: the machines and workspaces your agents live in.',
    features: [
      'Files, logs, terminals, configuration and health for every runtime',
      'Attach to runtimes you already run, or provision new ones',
      'Self-hostable control plane',
    ],
    status: 'Released',
    version: 'v0.1.86',
    checked: '2026-10-20',
    hex: '#2196f3',
    fg: '#ffffff',
    ink: '#1565c0',
    site: 'https://agentpod.dev',
    cta: { label: 'Visit agentpod.dev', href: 'https://agentpod.dev' },
    links: [
      { label: 'Docs', href: 'https://docs.agentpod.dev' },
      { label: 'Source', href: `${GH}/agentpod` },
    ],
  },
  {
    slug: 'superlibrary',
    name: 'Superlibrary',
    step: 'It remembers',
    blurb: 'the memory of the stack',
    summary: 'Keeps what agents make and what work has been done, labelled with how each turned out, so agents consult it before they work.',
    features: [
      'Upload, view and embed artifacts',
      'Work history arrives as items, labelled by outcome',
      'Agents reach it over MCP',
    ],
    status: 'Released',
    version: 'v0.0.1',
    checked: '2026-10-20',
    hex: '#f2704e',
    fg: '#ffffff',
    ink: '#b8442a',
    site: 'https://superlibrary.dev',
    cta: { label: 'Visit superlibrary.dev', href: 'https://superlibrary.dev' },
    // no Source link yet: the repository is not public
    links: [{ label: 'Docs', href: 'https://docs.superlibrary.dev' }],
  },
  {
    slug: 'superwitness',
    name: 'Superwitness',
    step: 'You see proof',
    blurb: 'observability and evals',
    summary: 'Shows what an agent did, how the product it ran on behaved, and whether the work was any good, joined on one run.',
    features: [
      'Agent traces and product telemetry on one run',
      'Evaluations of whether the work was good',
      'Run documents for Superpipeline runs',
    ],
    status: 'Released',
    version: 'v0.0.7',
    checked: '2026-10-20',
    hex: '#0ea875',
    fg: '#ffffff',
    ink: '#087a55',
    site: 'https://superwitness.dev',
    cta: { label: 'Visit superwitness.dev', href: 'https://superwitness.dev' },
    links: [
      { label: 'Docs', href: 'https://docs.superwitness.dev' },
      { label: 'Source', href: `${GH}/superwitness` },
    ],
  },
];

export const coming = [
  { name: 'Agentnagar', blurb: 'a place to watch your agents at work' },
  { name: 'Captain Jack', blurb: 'a guide who shows you around' },
];

export const CONTACT = 'rakesh@superjackfruit.com';

/** the product's colours as CSS custom properties; Site.astro maps them onto vibekit's accent tokens */
export const accentAttrs = (p: Product) => ({
  'data-brand': p.slug,
  style: `--brand:${p.hex};--brand-fg:${p.fg};--brand-ink:${p.ink}`,
});
