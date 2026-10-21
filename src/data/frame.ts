/**
 * What every page passes to the frontdoor frame in lab mode. The frame owns the header, the
 * theme switch and the footer; these are the site's own entries in them.
 */
export const frame = {
  cta: { label: 'Explore the suite', href: '/suite' },
  /** the header's menu drawer */
  sections: [
    { label: 'The village', href: '/' },
    { label: 'Products', href: '/suite#products' },
    { label: 'Writing', href: '/blog' },
    { label: 'Archive', href: '/archive' },
  ],
  /** the street footer's links, beside the frame's own */
  links: [
    { label: 'Writing', href: '/blog' },
    { label: 'Archive', href: '/archive' },
    { label: 'RSS', href: '/rss.xml' },
  ],
};
