import raw from './projects.json';
import { suite } from './suite';

export type ProjectStatus = 'released' | 'live' | 'stable' | 'wip' | 'experiment';
export type DistrictId = 'agent-works' | 'mcp-alley' | 'odd-shop';

export interface Project {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  tags: string[];
  status: ProjectStatus;
  github: string;
  demo?: string;
  district: DistrictId;
  order: number;
  /** Suite only: the product's own colour, and the one after it in the flow. */
  accent?: string;
  /** text colour on the accent, for a light accent like SuperPipeline's yellow */
  accentFg?: string;
  next?: string;
  /** the product's colour mark, from the SJL brand pack */
  logo?: string;
}

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  accent: string;
}

export const districts: District[] = [
  { id: 'agent-works', name: 'The Suite', blurb: 'six tools, one task from ask to proof', accent: '#d98a1f' },
  { id: 'mcp-alley', name: 'MCP Alley', blurb: 'wiring AI into everything', accent: '#f2a707' },
  { id: 'odd-shop', name: 'The Odd Shop', blurb: 'no refunds on curiosity', accent: '#a12cf9' },
];

/** The lab's earlier experiments, as they were catalogued. The archive page lists these. */
export const archive = raw as Project[];
export const archiveDistricts: District[] = [
  { id: 'agent-works', name: 'Agent Works', blurb: 'machines that work the night shift', accent: '#09e6f2' },
  ...districts.slice(1),
];
export const archiveByDistrict = (id: DistrictId): Project[] =>
  archive.filter((p) => p.district === id).sort((a, b) => a.order - b.order);

/**
 * What the village shows: the suite on the first street, in flow order, and the older experiments
 * on the other two. A suite house links to its product page rather than to source.
 */
export const projects: Project[] = [
  ...suite.map((p, i): Project => ({
    name: p.name,
    slug: p.slug,
    tagline: `${p.step.toLowerCase()} — ${p.blurb}`,
    description: p.summary,
    tags: p.version ? [p.version] : [],
    status: p.version ? 'released' : 'live',
    accent: p.hex,
    accentFg: p.fg,
    logo: `/brand/${p.slug}.svg`,
    next: suite[i + 1]?.name,
    // the card's main link: the product's own website, or its page here if it has none
    github: p.site ?? `/products/${p.slug}`,
    demo: p.site ? `/products/${p.slug}` : undefined,
    district: 'agent-works',
    order: i + 1,
  })),
  ...archive.filter((p) => !suite.some((s) => s.slug === p.slug))
    .map((p) => (p.district === 'agent-works' ? { ...p, district: 'odd-shop' as const, order: 10 + p.order } : p)),
];

export const byDistrict = (id: DistrictId): Project[] =>
  projects.filter((p) => p.district === id).sort((a, b) => a.order - b.order);
