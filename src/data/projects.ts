import raw from './projects.json';

export type ProjectStatus = 'stable' | 'wip' | 'experiment';
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
}

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  accent: string;
}

export const districts: District[] = [
  { id: 'agent-works', name: 'Agent Works', blurb: 'machines that do things', accent: '#09e6f2' },
  { id: 'mcp-alley', name: 'MCP Alley', blurb: 'plumbing for AI assistants', accent: '#f2a707' },
  { id: 'odd-shop', name: 'The Odd Shop', blurb: 'curiosities & one-offs', accent: '#a12cf9' },
];

export const projects = raw as Project[];

export const byDistrict = (id: DistrictId): Project[] =>
  projects.filter((p) => p.district === id).sort((a, b) => a.order - b.order);
