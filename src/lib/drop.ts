// The drop page's pure parts: how big a picture is sent, and the form the
// publish endpoint reads. Kept here so they are tested against the real parser.

/** A picture's size shrunk so its long edge is at most `max`; never enlarged. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= max) return { w, h };
  const k = max / long;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export interface Drop {
  text: string;
  project: string; // '' = let the #tags (or nothing) decide
  photos: Blob[];
  tz: string;
}

/** The multipart form for /micropub: h=entry, content, category, photo[] and the sender's zone. */
export function dropForm(d: Drop): FormData {
  const fd = new FormData();
  fd.append('h', 'entry');
  if (d.text.trim()) fd.append('content', d.text.trim());
  if (d.project) fd.append('category[]', d.project);
  if (d.tz) fd.append('tz', d.tz);
  d.photos.forEach((p, i) => fd.append('photo[]', p, `drop-${i + 1}.jpg`));
  return fd;
}
