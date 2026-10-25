import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    files: {
      assets: '.generated-static'
    },
    alias: {
      $content: '.generated-content'
    }
  }
};
