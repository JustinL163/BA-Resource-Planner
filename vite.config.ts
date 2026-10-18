import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

const migratedPageUrls: Plugin = {
  name: 'migrated-page-urls',
  configureServer(server) {
    const aliases: Record<string, string> = {
      '/': '/planner/resources/',
      '/planner': '/planner/resources/',
      '/planner/': '/planner/resources/',
      '/planner/index.html': '/planner/resources/',
      '/planner/events': '/planner/event-planner/',
      '/planner/events/': '/planner/event-planner/',
      '/planner/events.html': '/planner/event-planner/',
      '/planner/raids.html': '/planner/raids/',
      '/planner/tournaments.html': '/planner/tournaments/',
      '/game/guesser.html': '/game/'
    };
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
  resolve: {
    // Native realpath can fail with EPERM for files in restricted Windows worktrees.
    preserveSymlinks: process.platform === 'win32'
  },
  plugins: [migratedPageUrls, sveltekit()]
});
