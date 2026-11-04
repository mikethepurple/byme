// The /edit list: one readable line per post, each opening the post in
// Keystatic (whose own list shows only slug, title and date).
import { formatShort } from './posts';
import { KIND_LABEL, MISC, excerpt, leadOf, projectOf, titleOf, type Like } from './related';

export function keystaticUrl(slug: string): string {
  return `/keystatic/branch/main/collection/posts/item/${slug}`;
}

type Row = Pick<Like, 'id' | 'date' | 'kind' | 'title' | 'plain' | 'images' | 'things'> & { tags: string[] };

export function editRow(p: Row, names: Map<string, string>) {
  const proj = projectOf(p);
  const lead = leadOf(p);
  const headline = lead.title || titleOf(p, 100);
  const rest = lead.title ? lead.text : p.plain.split('\n').slice(1).join(' ');
  return {
    id: p.id,
    kind: KIND_LABEL[p.kind],
    project: proj === MISC ? 'misc' : (names.get(proj) ?? proj),
    tags: p.tags.map((t) => `#${t}`).join(' '),
    headline,
    excerpt: excerpt(rest.replace(/\s+/g, ' '), 140),
    when: formatShort(p.date),
    edit: keystaticUrl(p.id),
    view: `/${p.id}`,
  };
}
