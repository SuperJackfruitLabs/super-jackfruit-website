/**
 * The suite, in the order one task moves through it. Headline, summary, features, status, version
 * and actions were copied from each product's live site on `checked`; recheck there before
 * changing them, and never state a capability the product's own site does not.
 */
export interface Product {
  slug: string;
  name: string;
  /** The step this product owns on the home page flow. */
  step: string;
  blurb: string;
  /** the product site's hero headline, word for word */
  headline: string;
  /** the product site's hero subhead, word for word */
  summary: string;
  /** each one is stated on the product's own site; nothing here is the lab's claim alone */
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
  /** the product's own website; it is where every "go to" link leads */
  site: string;
  /** the one thing to do next, as the product's own site offers it: Sign in, Download or Install */
  cta: { label: 'Sign in' | 'Download' | 'Install'; href: string };
  /** Website, Docs and Source, in that order */
  links: { label: string; href: string }[];
}

const GH = 'https://github.com/SuperJackfruitLabs';
const links = (slug: string, site: string, docs: string) => [
  { label: 'Website', href: site },
  { label: 'Docs', href: docs },
  { label: 'Source', href: `${GH}/${slug}` },
];
/** A product with no docs site yet: its README is the documentation, and the Docs link says so. */
const readme = (slug: string, site: string) => [
  { label: 'Website', href: site },
  { label: 'Docs', href: `${GH}/${slug}#readme` },
  { label: 'Source', href: `${GH}/${slug}` },
];

export const suite: Product[] = [
  {
    slug: 'supermessage',
    name: 'SuperMessage',
    step: 'You talk',
    blurb: 'chat with your agents',
    headline: 'Chat where your agents are in the room.',
    summary: 'SuperMessage is a Matrix client in development. When an agent finishes a turn, asks permission, or reaches an approval gate, that arrives as a card in the room, next to what everyone else said.',
    features: [
      'Agent turns, permission requests and approval gates arrive as cards in the room',
      'Any homeserver; the people you talk to can use Element or Cinny',
      'Unsigned desktop previews for macOS, Windows and Linux; no public mobile build yet',
    ],
    status: 'In development',
    version: 'v0.0.15',
    checked: '2026-10-21',
    hex: '#8549ef',
    fg: '#ffffff',
    ink: '#6a35cc',
    site: 'https://supermessage.dev',
    cta: { label: 'Download', href: `${GH}/supermessage/releases/latest` },
    links: links('supermessage', 'https://supermessage.dev', 'https://docs.supermessage.dev'),
  },
  {
    slug: 'superpipeline',
    name: 'SuperPipeline',
    step: 'Work is planned',
    blurb: 'boards for agent work',
    headline: 'Agents do the work. A person approves it.',
    summary: 'SuperPipeline is a board whose stages are owned by a person or by a capability. Any agent with that capability can claim a card in its stage, and a gate holds the card until a person decides.',
    features: [
      'Each stage is owned by a person or a capability, with an optional WIP limit and gate',
      'Agents claim cards under a lease and connect over MCP or REST',
      'At a gate you approve, request changes or reject; whoever produced the work cannot approve it',
    ],
    status: 'Released',
    version: 'v0.0.19',
    checked: '2026-10-21',
    hex: '#ffc21a',
    fg: '#2c2a26',
    ink: '#8a6100',
    site: 'https://superpipeline.dev',
    cta: { label: 'Sign in', href: 'https://app.superpipeline.dev' },
    links: links('superpipeline', 'https://superpipeline.dev', 'https://docs.superpipeline.dev'),
  },
  {
    slug: 'superdispatch',
    name: 'SuperDispatch',
    step: 'It finds its agent',
    blurb: 'which agent takes the card, and why',
    headline: 'Which agent takes the card, and why.',
    summary: 'SuperDispatch is the scheduler between SuperPipeline and AgentPod. When a card is ready, it places it on an agent by capability, load and history, and records every decision with its reasons. An agent outside it keeps working by pull.',
    features: [
      'Filters every agent by capability, grants, policy, health and load, then scores the rest',
      'Every decision is recorded with each candidate considered and the reason for each',
      'Early: proven on staging; nothing requires it, and agents keep pulling work without it',
    ],
    status: 'In development',
    checked: '2026-11-13',
    hex: '#00afab',
    fg: '#06201f',
    ink: '#007a77',
    site: 'https://superdispatch.dev',
    cta: { label: 'Install', href: `${GH}/superdispatch#run-it` },
    links: readme('superdispatch', 'https://superdispatch.dev'),
  },
  {
    slug: 'salaam',
    name: 'Salaam',
    step: 'An agent does it',
    blurb: 'coding sessions that outlast your terminal',
    headline: 'Agent coding sessions that outlast your terminal.',
    summary: 'Salaam is a persistent session service for terminal coding and unattended agent work, built on Pi. Each session, with its approvals and results, lives on your machine, so you can close the terminal and pick it up later.',
    features: [
      'Close the terminal and the session keeps going',
      'Reattach from another terminal, over SSH, or from an editor that speaks ACP',
      'A patch waits in your approval inbox before it is applied',
    ],
    status: 'Released',
    version: 'v0.0.2',
    checked: '2026-10-21',
    hex: '#f74783',
    fg: '#ffffff',
    ink: '#c42a62',
    site: 'https://salaam.sh',
    cta: { label: 'Install', href: 'https://docs.salaam.sh/install/' },
    links: links('salaam', 'https://salaam.sh', 'https://docs.salaam.sh'),
  },
  {
    slug: 'supertoolkit',
    name: 'SuperToolkit',
    step: 'It uses your tools',
    blurb: 'tools for agents, with the credential out of reach',
    headline: 'The agent never holds the credential.',
    summary: 'SuperToolkit is a credential broker for agents. An agent asks for an effect by name; the broker substitutes, signs or mints the credential on the wire, where the agent cannot reach. If it reads its own token, it has read nothing.',
    features: [
      'Agents run with a placeholder where their token would be; the broker puts the credential on the wire',
      'Policy is one file: a read is the agent’s, a write waits for your approval, and the audit shows what was done',
      'Early and deliberately narrow: it brokers agent tools and their credentials, and its limits are published',
    ],
    status: 'Released',
    version: 'v0.0.9',
    checked: '2026-11-13',
    hex: '#5b5fe0',
    fg: '#ffffff',
    ink: '#5b5fe0',
    site: 'https://supertoolkit.dev',
    cta: { label: 'Install', href: 'https://docs.supertoolkit.dev/install/' },
    links: links('supertoolkit', 'https://supertoolkit.dev', 'https://docs.supertoolkit.dev'),
  },
  {
    slug: 'agentpod',
    name: 'AgentPod',
    step: 'Your fleet runs it',
    blurb: 'the console for your agents\' machines',
    headline: 'The console for the machines your agents live on.',
    summary: "AgentPod puts a small Go agent on each machine where your agents run. It dials out to a hub, and from one console you read each runtime's files, tail its logs, open a terminal and check its health.",
    features: [
      'The node agent dials out over a WebSocket, so it needs no inbound port',
      'Files, logs, terminal and health for each runtime from one console',
      'apn scan checks a host with no hub, no account and no network',
    ],
    status: 'Released',
    version: 'v0.1.98',
    checked: '2026-10-21',
    hex: '#2196f3',
    fg: '#ffffff',
    ink: '#1565c0',
    site: 'https://agentpod.dev',
    cta: { label: 'Sign in', href: 'https://console.agentpod.dev' },
    links: links('agentpod', 'https://agentpod.dev', 'https://docs.agentpod.dev'),
  },
  {
    slug: 'superexchange',
    name: 'SuperExchange',
    step: 'You decide in chat',
    blurb: 'board decisions, answered in chat',
    headline: 'The board asks. Answer in chat.',
    summary: 'SuperExchange is a Matrix application service. It carries SuperPipeline’s gates, questions and waiting cards into the board’s encrypted room, and when a person answers there, the board acts on it as that person.',
    features: [
      'Gates, questions, follow-ups and waiting cards posted once in the board’s encrypted Matrix room',
      'An answer acts on the board as the person who gave it, with one receipt; an agent cannot answer',
      'Early: in production, but no production board has moved to it yet',
    ],
    status: 'Released',
    version: 'v0.0.2',
    checked: '2026-11-13',
    hex: '#00a0d7',
    fg: '#06201f',
    ink: '#007aa2',
    site: 'https://superexchange.dev',
    cta: { label: 'Install', href: `${GH}/superexchange#run-it` },
    links: readme('superexchange', 'https://superexchange.dev'),
  },
  {
    slug: 'superlibrary',
    name: 'SuperLibrary',
    step: 'It remembers',
    blurb: 'the memory of the stack',
    headline: 'Find what agents made, and whether it worked.',
    summary: 'SuperLibrary keeps the files agents make and the record of finished work, each labelled with its outcome, and lets people and agents search them.',
    features: [
      'Files are uploaded as versioned artifacts, each carrying one of seven outcomes',
      'Full-text and vector search together; approved and completed work ranks first',
      'Agents search it through three read-only MCP tools',
    ],
    status: 'Released',
    version: 'v0.0.1',
    checked: '2026-10-21',
    hex: '#f2704e',
    fg: '#ffffff',
    ink: '#b8442a',
    site: 'https://superlibrary.dev',
    cta: { label: 'Sign in', href: 'https://app.superlibrary.dev' },
    links: links('superlibrary', 'https://superlibrary.dev', 'https://docs.superlibrary.dev'),
  },
  {
    slug: 'superwitness',
    name: 'SuperWitness',
    step: 'You see proof',
    blurb: 'every run, on the record',
    headline: 'Every run, on the record.',
    summary: 'SuperWitness is a self-hosted service that joins a SuperPipeline run, its AgentPod attempts, traces, logs and verdicts into one document: what your agents did, how your products behaved, and whether the work was good.',
    features: [
      'A run, its attempts, traces, logs and verdicts joined into one document',
      'Self-hosted beside Postgres, VictoriaTraces, VictoriaLogs and the OpenTelemetry Collector',
      'Not standalone yet: it reads runs from SuperPipeline and attempts from AgentPod',
    ],
    status: 'Released',
    version: 'v0.0.8',
    checked: '2026-10-21',
    hex: '#0ea875',
    fg: '#ffffff',
    ink: '#087a55',
    site: 'https://superwitness.dev',
    cta: { label: 'Sign in', href: 'https://app.superwitness.dev' },
    links: links('superwitness', 'https://superwitness.dev', 'https://docs.superwitness.dev'),
  },
];

export const CONTACT = 'rakesh@superjackfruit.com';

/** the product's colours as CSS custom properties; Site.astro maps them onto vibekit's accent tokens */
export const accentAttrs = (p: Product) => ({
  'data-brand': p.slug,
  style: `--brand:${p.hex};--brand-fg:${p.fg};--brand-ink:${p.ink}`,
});
