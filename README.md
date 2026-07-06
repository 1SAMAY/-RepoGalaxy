# RepoGalaxy

RepoGalaxy is a pure client-side GitHub repository visualizer. Enter a public GitHub
username and it renders that user's public repositories as an interactive 3D force graph.

## Files

- `index.html` - page structure and CDN script loading.
- `style.css` - responsive full-screen UI.
- `app.js` - GitHub fetch layer, data transform, graph rendering, filters, theme, and screenshot export.

## Run Locally

Open `index.html` in a browser, or serve this folder with any static file server.

No backend, database, build step, paid API, or sign-up service is required.

## Deploy To GitHub Pages

1. Put these files in a GitHub repository root, or in a `/docs` folder.
2. Open the repository Settings page.
3. Go to Pages.
4. Set the source to the branch you want, then choose `/root` or `/docs`.
5. Save and wait for GitHub Pages to publish the static site.

GitHub's public REST API supports browser CORS for these public read requests, so no proxy
server is needed.

## Notes

- Unauthenticated GitHub API requests are limited to 60 requests/hour.
- The optional token setting stores a personal access token only in this browser and sends it
  only to `api.github.com`.
- Repo nodes are colored by primary language and sized by star count.
- Links are created when repositories share a primary language or at least one topic.
- The performance panel detects the display refresh rate, shows display FPS and graph FPS,
  and lets you cap graph rendering at 60, 120, 150, or Max.
- Rendering is tuned with capped device pixel ratio, low-poly node geometry, cached geometry
  and materials, lower graph resolutions, finite physics cooldown, and limited link particles.
