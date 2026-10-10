import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

const legacyPageUrls: Plugin = {
  name: 'legacy-page-urls',
  configureServer(server) {
    const aliases: Record<string, string> = {
      '/': '/planner/index.html',
      '/planner': '/planner/index.html',
      '/planner/': '/planner/index.html'
    };
    for (const name of ['events']) {
      aliases[`/planner/${name}`] = `/planner/${name}.html`;
      aliases[`/planner/${name}/`] = `/planner/${name}.html`;
    }
    for (const name of ['credit', 'privacy', 'changelog', 'debug']) {
      aliases[`/planner/${name}.html`] = `/planner/${name}/`;
    }
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const destination = aliases[url.pathname];
      if (!destination) {
        next();
        return;
      }
      response.writeHead(302, { Location: destination + url.search });
      response.end();
    });
  }
};

export default defineConfig({
  plugins: [legacyPageUrls, sveltekit()]
});
