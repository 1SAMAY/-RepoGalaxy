# RepoGalaxy

RepoGalaxy is a pure client-side GitHub visualizer. It can render either:

- a GitHub user's public repositories as a 3D repo galaxy
- one GitHub repository as a 3D project universe with folders, files, imports,
  dependencies, architecture roles, pipeline links, important files, and security hotspots

Everything runs in the browser. There is no backend, database, paid API, scanner, or cloud AI
service.

## Files

- `index.html` - page structure and CDN script loading.
- `style.css` - responsive full-screen UI.
- `app.js` - GitHub fetch layer, graph transforms, import/dependency parsing, rendering,
  filters, cache, theme, performance controls, and screenshot export.

## Run Locally

You can open `index.html` directly in a browser, but a local static server is usually cleaner.

With Python:

```powershell
cd C:\path\to\repo-galaxy
python -m http.server 5174
```

Then open:

```text
http://127.0.0.1:5174
```

No build step is required.

## How To Use

### Username Mode

1. Select `Username`.
2. Enter a GitHub username, for example `octocat`.
3. Click `Visualize`.
4. The graph shows that user's public repositories.
5. Repositories are colored by primary language and sized by star count.
6. Links are created when repositories share a language or topic.

Click a repo node to open it on GitHub.

### Repo URL Mode

1. Select `Repo URL`.
2. Enter a public GitHub repository URL, for example:

```text
https://github.com/1SAMAY/-RepoGalaxy
```

3. Click `Visualize`.
4. RepoGalaxy fetches the default branch and recursive file tree using the GitHub public API.
5. The graph shows the project as a 3D universe of repo, folder, file, language, dependency,
   import, architecture, pipeline, important, and security-hotspot nodes.

Click a folder to focus it. Click a file to inspect it. Double-click a file to open it on
GitHub.

## View Buttons

- `Galaxy View` - returns to the normal repository galaxy when username data is loaded.
- `Project Universe` - shows the full repository project graph.
- `Architecture View` - highlights main folders, entry files, config files, dependencies,
  backend/API/database folders, and important architecture nodes.
- `Pipeline View` - highlights file imports and folder-to-folder pipeline connections.
- `Critical Files` - shows higher-importance files and their context.
- `Dependencies` - shows dependency manifest files and dependency nodes.
- `Security Hotspots` - shows files whose paths suggest auth, token, password, secret, admin,
  upload, payment, database, config, or environment sensitivity.

## Filters And Tools

- Use the search box to highlight repos, folders, files, languages, topics, or dependency names.
- Use the star slider in username mode to reduce clutter.
- Toggle connection mode between language/topic/both in username mode.
- Use the screenshot button to export the current graph view.
- Use the theme button to switch between dark and light mode.
- Use the performance panel to see refresh rate, display FPS, graph FPS, and cap rendering at
  60, 120, 150, or Max.

## Optional GitHub Token

RepoGalaxy works without a token, but unauthenticated GitHub API requests are limited to
60 requests/hour.

You can paste a free GitHub Personal Access Token in Settings to raise the limit. The token is
stored only in your browser and is sent only to `api.github.com`.

Do not hardcode a token into `app.js` before publishing. Browser code is public.

## Deploy To GitHub Pages

1. Put these files in a GitHub repository root, or in a `/docs` folder.
2. Open the repository Settings page.
3. Go to Pages.
4. Set the source to the branch you want, then choose `/root` or `/docs`.
5. Save and wait for GitHub Pages to publish the static site.

GitHub's public REST API supports browser CORS for these public read requests, so no proxy
server is needed.

## Privacy

- Publishing on GitHub Pages does not expose your personal computer IP.
- Visitors load the site from GitHub Pages and call the GitHub API from their own browser.
- If no token is entered, requests use the visitor's unauthenticated GitHub API rate limit.
- If a visitor enters their own token, it remains in that visitor's browser storage.

## Notes

- Repo URL mode caches project tree data locally for faster repeat loading.
- Large repositories show the first set of files first and can reveal more with `Load more files`.
- Import parsing is local regex-based parsing for JavaScript, TypeScript, Python, HTML, and CSS.
- Dependency parsing is local rule-based parsing for common manifest files.
- The performance panel detects the display refresh rate, shows display FPS and graph FPS,
  and lets you cap graph rendering at 60, 120, 150, or Max.
- Rendering is tuned with capped device pixel ratio, low-poly node geometry, cached geometry
  and materials, lower graph resolutions, finite physics cooldown, and limited link particles.
