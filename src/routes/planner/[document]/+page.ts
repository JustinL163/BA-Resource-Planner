import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';

const names = ['credit', 'privacy', 'changelog'] as const;
const documents = {
  credit: () => import('$content/credit'),
  privacy: () => import('$content/privacy'),
  changelog: () => import('$content/changelog')
};

export const entries: EntryGenerator = () => names.map((document) => ({ document }));

export const load: PageLoad = async ({ params }) => {
  const name = names.find((name) => name === params.document);
  if (!name) error(404, 'Page not found');
  return (await documents[name]()).document;
};
