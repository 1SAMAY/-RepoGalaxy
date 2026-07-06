"use strict";

const API_ROOT = "https://api.github.com";
const TOKEN_KEY = "repogalaxy:github-token";
const THEME_KEY = "repogalaxy:theme";
const LAST_USERNAME_KEY = "repogalaxy:last-username";
const PROJECT_CACHE_PREFIX = "repogalaxy:project-cache:";
const PROJECT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_FILE_LIMIT = 1000;
const LOAD_MORE_FILE_COUNT = 1000;
const MAX_IMPORT_FILES_WITH_TOKEN = 180;
const MAX_IMPORT_FILES_WITHOUT_TOKEN = 42;

const IMPORT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py", ".css", ".html"];
const DEPENDENCY_FILE_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "requirements.txt",
  "pyproject.toml",
  "pipfile",
  "composer.json",
  "pom.xml",
  "dockerfile",
  "docker-compose.yml"
]);
const ENTRY_FILE_NAMES = new Set([
  "index.html",
  "main.js",
  "app.js",
  "server.js",
  "index.js",
  "main.py",
  "app.py",
  "manage.py"
]);
const IMPORTANT_FILE_NAMES = new Set([
  "index.html",
  "main.js",
  "app.js",
  "server.js",
  "index.js",
  "main.py",
  "app.py",
  "manage.py",
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "package-lock.json",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env.example",
  "readme.md",
  "license",
  "vite.config.js",
  "vite.config.ts",
  "vite.config.mjs",
  "next.config.js",
  "next.config.ts",
  "next.config.mjs",
  "tsconfig.json"
]);
const SECURITY_TERMS = [
  "auth",
  "login",
  "token",
  "password",
  "secret",
  "key",
  "jwt",
  "admin",
  "upload",
  "payment",
  "database",
  "db",
  "config",
  "env"
];
const ARCHITECTURE_ROLES = {
  frontend: ["frontend", "web", "ui"],
  backend: ["backend", "server"],
  api: ["api"],
  server: ["server"],
  client: ["client"],
  components: ["components", "component"],
  pages: ["pages", "page", "views"],
  routes: ["routes", "router", "routing"],
  services: ["services", "service"],
  utils: ["utils", "util", "helpers", "lib"],
  database: ["database", "db", "migrations", "prisma"],
  models: ["models", "model", "entities"],
  controllers: ["controllers", "controller"],
  config: ["config", "configs", ".github"],
  public: ["public", "static"],
  assets: ["assets", "images", "img", "fonts"],
  tests: ["test", "tests", "__tests__", "spec"]
};

const NODE_TYPE_COLORS = {
  repo: "#48d6c6",
  folder: "#ffcf5a",
  file: "#7dd3fc",
  language: "#a78bfa",
  dependency: "#f472b6",
  import: "#fb923c",
  architecture: "#34d399",
  pipeline: "#facc15",
  important: "#ffffff",
  "security-hotspot": "#ff6b7a"
};

const LANGUAGE_COLORS = {
  JavaScript: "#f7df1e",
  TypeScript: "#3178c6",
  Python: "#3776ab",
  HTML: "#e34c26",
  CSS: "#663399",
  Java: "#b07219",
  "C#": "#178600",
  C: "#555555",
  "C++": "#f34b7d",
  Go: "#00add8",
  Rust: "#dea584",
  PHP: "#4f5d95",
  Ruby: "#701516",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Shell: "#89e051",
  PowerShell: "#012456",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Jupyter: "#da5b0b",
  Unknown: "#9aa4b2"
};

const state = {
  graph: null,
  username: "",
  inputMode: "username",
  graphMode: "galaxy",
  viewMode: "galaxy",
  repos: [],
  project: null,
  projectGraphData: { nodes: [], links: [] },
  projectFileLimit: DEFAULT_FILE_LIMIT,
  focusedFolderId: null,
  selectedNode: null,
  baseGraphData: { nodes: [], links: [] },
  filteredGraphData: { nodes: [], links: [] },
  linkMode: "both",
  minStars: 0,
  highlightQuery: "",
  rateLimit: null,
  theme: "dark",
  detectedRefreshRate: null,
  displayFrameCount: 0,
  graphFrameCount: 0,
  displayFps: 0,
  graphFps: 0,
  targetFPS: null,
  lastGraphRenderTime: 0,
  rafCapInstalled: false
};

const refs = {};
const geometryCache = new Map();
const materialCache = new Map();
const uncappedRafCallbacks = new WeakSet();
let nativeRequestAnimationFrame = null;

class RepoGalaxyError extends Error {
  constructor(message, kind = "error") {
    super(message);
    this.name = "RepoGalaxyError";
    this.kind = kind;
  }
}

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindRefs();
  applySavedTheme();
  bindEvents();
  installRenderFrameCap();
  initializeGraph();
  startPerformancePanel();
  setInputMode("username");
  updateViewModeButtons();
  renderEmptyState(true);
  updateTokenInput();

  const lastUsername = localStorage.getItem(LAST_USERNAME_KEY);
  if (lastUsername) {
    refs.usernameInput.value = lastUsername;
  }
}

function bindRefs() {
  refs.form = document.getElementById("usernameForm");
  refs.usernameInput = document.getElementById("usernameInput");
  refs.visualizeButton = document.getElementById("visualizeButton");
  refs.graph = document.getElementById("graph");
  refs.emptyState = document.getElementById("emptyState");
  refs.statusText = document.getElementById("statusText");
  refs.rateLimitText = document.getElementById("rateLimitText");
  refs.loadingSpinner = document.getElementById("loadingSpinner");
  refs.highlightInput = document.getElementById("highlightInput");
  refs.minStarsRange = document.getElementById("minStarsRange");
  refs.minStarsValue = document.getElementById("minStarsValue");
  refs.repoCount = document.getElementById("repoCount");
  refs.linkCount = document.getElementById("linkCount");
  refs.visibleCount = document.getElementById("visibleCount");
  refs.legendPanel = document.getElementById("legendPanel");
  refs.legendList = document.getElementById("legendList");
  refs.repoPanel = document.getElementById("repoPanel");
  refs.screenshotButton = document.getElementById("screenshotButton");
  refs.themeButton = document.getElementById("themeButton");
  refs.settingsButton = document.getElementById("settingsButton");
  refs.settingsDialog = document.getElementById("settingsDialog");
  refs.tokenInput = document.getElementById("tokenInput");
  refs.saveTokenButton = document.getElementById("saveTokenButton");
  refs.clearTokenButton = document.getElementById("clearTokenButton");
  refs.linkModeButtons = Array.from(document.querySelectorAll("[data-link-mode]"));
  refs.inputModeButtons = Array.from(document.querySelectorAll("[data-input-mode]"));
  refs.viewModeButtons = Array.from(document.querySelectorAll("[data-view-mode]"));
  refs.loadMoreButton = document.getElementById("loadMoreButton");
  refs.primaryStatLabel = document.getElementById("primaryStatLabel");
  refs.secondaryStatLabel = document.getElementById("secondaryStatLabel");
  refs.visibleStatLabel = document.getElementById("visibleStatLabel");
  refs.architecturePanel = document.getElementById("architecturePanel");
  refs.architectureSummary = document.getElementById("architectureSummary");
  refs.refreshRateLabel = document.getElementById("refreshRateLabel");
  refs.fpsLabel = document.getElementById("fpsLabel");
  refs.graphFpsLabel = document.getElementById("graphFpsLabel");
  refs.fpsWarning = document.getElementById("fpsWarning");
  refs.performanceNote = document.getElementById("performanceNote");
  refs.fpsCapButtons = Array.from(document.querySelectorAll("[data-fps-cap]"));
}

function bindEvents() {
  refs.form.addEventListener("submit", handleSubmit);
  refs.highlightInput.addEventListener("input", () => {
    state.highlightQuery = refs.highlightInput.value.trim().toLowerCase();
    applyFilters();
  });
  refs.minStarsRange.addEventListener("input", () => {
    state.minStars = Number(refs.minStarsRange.value);
    refs.minStarsValue.textContent = formatNumber(state.minStars);
    applyFilters();
  });
  refs.linkModeButtons.forEach((button) => {
    button.addEventListener("click", () => setLinkMode(button.dataset.linkMode));
  });
  refs.screenshotButton.addEventListener("click", downloadScreenshot);
  refs.themeButton.addEventListener("click", toggleTheme);
  refs.settingsButton.addEventListener("click", openSettings);
  refs.saveTokenButton.addEventListener("click", saveToken);
  refs.clearTokenButton.addEventListener("click", clearToken);
  refs.inputModeButtons.forEach((button) => {
    button.addEventListener("click", () => setInputMode(button.dataset.inputMode));
  });
  refs.viewModeButtons.forEach((button) => {
    button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
  });
  refs.loadMoreButton.addEventListener("click", loadMoreProjectFiles);
  refs.fpsCapButtons.forEach((button) => {
    button.addEventListener("click", () => setFpsCap(button.dataset.fpsCap));
  });
  window.addEventListener("resize", debounce(resizeGraph, 120));
}

function initializeGraph() {
  if (typeof window.ForceGraph3D !== "function") {
    setStatus("The 3D graph library did not load. Check your connection and reload.", "error");
    return;
  }

  state.graph = ForceGraph3D({
    controlType: "orbit",
    rendererConfig: {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    }
  })(refs.graph)
    .backgroundColor(getGraphBackground())
    .showNavInfo(false)
    .cooldownTicks(100)
    .nodeResolution(8)
    .linkResolution(3)
    .nodeId("id")
    .nodeVal("size")
    .nodeLabel((node) => repoTooltipHtml(node))
    .nodeThreeObject((node) => createRepoPlanet(node))
    .nodeThreeObjectExtend(false)
    .linkSource("source")
    .linkTarget("target")
    .linkLabel((link) => linkTooltipHtml(link))
    .linkColor((link) => link.displayColor || "#6f7a8d")
    .linkOpacity(0.32)
    .linkWidth((link) => link.displayWidth || 0.35)
    .linkDirectionalParticles((link) => link.particles || 0)
    .linkDirectionalParticleColor(() => "#ffffff")
    .linkDirectionalParticleWidth(1.6)
    .onNodeHover(handleNodeHover)
    .onNodeClick(handleNodeClick)
    .onBackgroundClick(() => {
      state.focusedFolderId = null;
      showRepoPanel(null);
      if (state.graphMode === "project") {
        applyFilters();
      }
    });

  applyRendererPixelRatio();
  resizeGraph();
  state.graph.graphData({ nodes: [], links: [] });
}

async function handleSubmit(event) {
  event.preventDefault();
  const input = refs.usernameInput.value.trim();

  if (!input) {
    setStatus(state.inputMode === "repo" ? "Enter a GitHub repository URL first." : "Enter a GitHub username first.", "error");
    refs.usernameInput.focus();
    return;
  }

  const repoRef = parseGitHubRepoInput(input);
  if (state.inputMode === "repo" || repoRef) {
    await loadRepositoryProject(input);
    return;
  }

  if (!isValidGitHubUsername(input)) {
    setStatus("GitHub usernames use letters, numbers, and single hyphens only.", "error");
    return;
  }

  await loadUser(input);
}

async function loadUser(username) {
  setLoading(true);
  setStatus(`Fetching public repositories for ${username}...`);
  showRepoPanel(null);

  try {
    const repos = await fetchUserRepos(username);
    state.username = username;
    state.repos = repos;
    state.graphMode = "galaxy";
    state.viewMode = "galaxy";
    state.focusedFolderId = null;
    localStorage.setItem(LAST_USERNAME_KEY, username);

    state.baseGraphData = buildGraphData(repos);
    state.minStars = 0;
    refs.minStarsRange.value = "0";
    refs.minStarsValue.textContent = "0";
    configureStarsRange(repos);
    renderLegend(state.baseGraphData.nodes);
    renderArchitectureSummary(null);
    updateViewModeButtons();
    applyFilters();

    if (repos.length === 0) {
      renderEmptyState(true, "No public repositories found", "This user has no public repositories to visualize.");
      setStatus(`No public repositories found for ${username}.`);
      return;
    }

    renderEmptyState(false);
    setStatus(`Loaded ${formatNumber(repos.length)} repositories for ${username}. Click a node to open it on GitHub.`);
  } catch (error) {
    console.error(error);
    resetGraph();
    renderEmptyState(true, "Could not load repositories", error.message);
    setStatus(error.message, error.kind || "error");
  } finally {
    setLoading(false);
  }
}

async function loadRepositoryProject(input) {
  const repoRef = parseGitHubRepoInput(input);
  if (!repoRef) {
    setStatus("Enter a GitHub repo URL like https://github.com/owner/repo.", "error");
    return;
  }

  setLoading(true);
  showRepoPanel(null);
  state.focusedFolderId = null;
  state.projectFileLimit = DEFAULT_FILE_LIMIT;
  setStatus(`Fetching ${repoRef.owner}/${repoRef.repo} repository tree...`);

  try {
    const cacheKey = projectCacheKey(repoRef.owner, repoRef.repo);
    const cached = readProjectCache(cacheKey);
    let projectPayload = cached;

    if (!projectPayload) {
      const meta = await fetchRepoMetadata(repoRef.owner, repoRef.repo);
      const tree = await fetchRepoTree(repoRef.owner, repoRef.repo, meta.default_branch);
      const files = tree.tree.filter((item) => item.type === "blob");
      const contentPaths = prioritizeContentFetches(files).slice(0, maxContentFetchCount());
      const dependencyPaths = files
        .map((item) => item.path)
        .filter(isDependencyFilePath);
      const uniqueContentPaths = Array.from(new Set([...dependencyPaths, ...contentPaths]));
      setStatus(`Fetching ${formatNumber(uniqueContentPaths.length)} key files for imports and dependencies...`);
      const contentMap = await fetchFileContents(repoRef.owner, repoRef.repo, meta.default_branch, uniqueContentPaths);
      projectPayload = { meta, tree: tree.tree, contentMap, cachedAt: Date.now() };
      writeProjectCache(cacheKey, projectPayload);
    }

    const graphData = buildProjectUniverseGraph(projectPayload.tree, projectPayload.meta, projectPayload.contentMap || {});
    state.project = {
      owner: repoRef.owner,
      repo: repoRef.repo,
      branch: projectPayload.meta.default_branch,
      meta: projectPayload.meta,
      tree: projectPayload.tree,
      contentMap: projectPayload.contentMap || {},
      summary: graphData.summary,
      totalFiles: graphData.files.length
    };
    state.projectGraphData = graphData;
    state.baseGraphData = graphData;
    state.graphMode = "project";
    state.viewMode = "project";
    renderArchitectureSummary(graphData.summary);
    updateViewModeButtons();
    applyFilters();
    renderEmptyState(false);
    setStatus(
      `Loaded ${repoRef.owner}/${repoRef.repo}: ${formatNumber(graphData.files.length)} files, ${formatNumber(graphData.folders.length)} folders.`
    );
  } catch (error) {
    console.error(error);
    resetGraph();
    renderEmptyState(true, "Could not load repository", error.message);
    setStatus(error.message, error.kind || "error");
  } finally {
    setLoading(false);
  }
}

function parseGitHubRepoInput(input) {
  const value = input.trim();
  const urlMatch = value.match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:[/?#].*)?$/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/i, "") };
  }

  const shortMatch = value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch && !value.includes("://")) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/i, "") };
  }

  return null;
}

async function fetchRepoMetadata(owner, repo) {
  const response = await fetch(`${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: githubHeaders()
  });
  updateRateLimitFromResponse(response);

  if (!response.ok) {
    throw await toApiError(response, `${owner}/${repo}`);
  }

  return response.json();
}

async function fetchRepoTree(owner, repo, branch) {
  const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await fetch(url, { headers: githubHeaders() });
  updateRateLimitFromResponse(response);

  if (!response.ok) {
    throw await toApiError(response, `${owner}/${repo}`);
  }

  const tree = await response.json();
  if (tree.truncated) {
    setStatus("GitHub returned a truncated tree. Showing the largest available project universe.", "error");
  }
  return tree;
}

async function fetchFileContents(owner, repo, branch, paths) {
  const contentMap = {};
  const queue = [...paths];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const path = queue.shift();
      try {
        contentMap[path] = await fetchFileText(owner, repo, branch, path);
      } catch (error) {
        console.warn(`Could not fetch ${path}`, error);
      }
    }
  });
  await Promise.all(workers);
  return contentMap;
}

async function fetchFileText(owner, repo, branch, path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders() }
  );
  updateRateLimitFromResponse(response);

  if (!response.ok) {
    throw await toApiError(response, path);
  }

  const file = await response.json();
  if (!file.content || file.encoding !== "base64") {
    return "";
  }
  return decodeBase64(file.content);
}

function decodeBase64(value) {
  const clean = value.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function maxContentFetchCount() {
  return getStoredToken() ? MAX_IMPORT_FILES_WITH_TOKEN : MAX_IMPORT_FILES_WITHOUT_TOKEN;
}

function prioritizeContentFetches(files) {
  return [...files]
    .filter((item) => shouldFetchContent(item.path))
    .sort((a, b) => contentPriority(b.path) - contentPriority(a.path))
    .map((item) => item.path);
}

function shouldFetchContent(path) {
  return IMPORT_EXTENSIONS.includes(getExtension(path)) || isDependencyFilePath(path);
}

function contentPriority(path) {
  const name = basename(path).toLowerCase();
  let score = 0;
  if (isDependencyFilePath(path)) score += 80;
  if (ENTRY_FILE_NAMES.has(name)) score += 60;
  if (IMPORTANT_FILE_NAMES.has(name)) score += 50;
  if (path.startsWith("src/")) score += 25;
  if (path.includes("/components/") || path.includes("/pages/") || path.includes("/api/")) score += 20;
  if (isTestPath(path)) score -= 15;
  return score;
}

function projectCacheKey(owner, repo) {
  return `${PROJECT_CACHE_PREFIX}${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function readProjectCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.cachedAt || Date.now() - cached.cachedAt > PROJECT_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeProjectCache(key, payload) {
  try {
    const serialized = JSON.stringify({ ...payload, cachedAt: Date.now() });
    if (serialized.length < 4_000_000) {
      localStorage.setItem(key, serialized);
    }
  } catch {
    console.warn("Project cache skipped because browser storage is full.");
  }
}

async function fetchUserRepos(username) {
  let nextUrl = `${API_ROOT}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`;
  const rawRepos = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers: githubHeaders() });
    updateRateLimitFromResponse(response);

    if (!response.ok) {
      throw await toApiError(response, username);
    }

    const page = await response.json();
    if (!Array.isArray(page)) {
      throw new RepoGalaxyError("GitHub returned an unexpected response.", "error");
    }

    rawRepos.push(...page);
    nextUrl = getNextPageUrl(response.headers.get("Link"));
  }

  console.log("RepoGalaxy raw GitHub repos:", rawRepos);
  return rawRepos.map(cleanRepo);
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json"
  };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function toApiError(response, username) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  let message = "";

  try {
    const body = await response.json();
    message = body && body.message ? body.message : "";
  } catch {
    message = "";
  }

  if (response.status === 404) {
    return new RepoGalaxyError(`GitHub user "${username}" was not found.`, "error");
  }

  if ((response.status === 403 || response.status === 429) && remaining === "0") {
    const resetText = reset ? ` after ${formatResetTime(reset)}` : " in a few minutes";
    return new RepoGalaxyError(
      `GitHub API limit reached. Try again${resetText}, or add a personal access token in Settings for 5000 requests/hour.`,
      "error"
    );
  }

  if (response.status === 403 || response.status === 429) {
    return new RepoGalaxyError(
      message || "GitHub is throttling requests. Wait a minute and try again.",
      "error"
    );
  }

  return new RepoGalaxyError(message || `GitHub request failed with HTTP ${response.status}.`, "error");
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  return linkHeader
    .split(",")
    .map((part) => part.trim())
    .map((part) => part.match(/^<([^>]+)>;\s*rel="([^"]+)"$/))
    .filter(Boolean)
    .find((match) => match[2] === "next")?.[1] || null;
}

function cleanRepo(repo) {
  return {
    id: repo.full_name,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description || "",
    language: repo.language || "Unknown",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    forks: Number(repo.forks_count || 0),
    stars: Number(repo.stargazers_count || 0),
    url: repo.html_url,
    updatedAt: repo.updated_at,
    isFork: Boolean(repo.fork)
  };
}

function buildGraphData(repos) {
  const nodes = repos.map((repo) => {
    const color = getLanguageColor(repo.language);
    const size = scaleStarsToSize(repo.stars);
    return {
      ...repo,
      label: repo.name,
      size,
      radius: Math.max(2.2, Math.min(12, size * 0.58)),
      color
    };
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const bucketsByLanguage = new Map();
  const bucketsByTopic = new Map();

  nodes.forEach((node) => {
    if (node.language && node.language !== "Unknown") {
      addToBucket(bucketsByLanguage, node.language, node.id);
    }

    node.topics.forEach((topic) => {
      addToBucket(bucketsByTopic, topic.toLowerCase(), node.id);
    });
  });

  const linksByKey = new Map();
  addBucketLinks(bucketsByLanguage, "language", linksByKey, nodesById);
  addBucketLinks(bucketsByTopic, "topic", linksByKey, nodesById);

  return {
    nodes,
    links: Array.from(linksByKey.values())
  };
}

function buildProjectUniverseGraph(treeItems, repoMeta, contentMap) {
  const files = treeItems
    .filter((item) => item.type === "blob")
    .map((item, index) => ({
      path: item.path,
      name: basename(item.path),
      extension: getExtension(item.path),
      language: languageFromPath(item.path),
      size: item.size || 0,
      sha: item.sha,
      index
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const folders = buildFolderList(files);
  const folderStats = countFilesByFolder(files);
  const nodes = [];
  const links = [];
  const nodesById = new Map();
  const linksByKey = new Set();
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const dependenciesByName = new Map();
  const dependencyFiles = [];
  const importLinks = [];
  const folderPipelineLinks = new Set();
  const repoId = `repo:${repoMeta.full_name}`;

  function addNode(node) {
    if (nodesById.has(node.id)) {
      return nodesById.get(node.id);
    }
    const normalized = {
      connections: 0,
      imports: [],
      importedBy: [],
      dependencies: [],
      importanceScore: 0,
      importanceReasons: [],
      ...node
    };
    nodesById.set(normalized.id, normalized);
    nodes.push(normalized);
    return normalized;
  }

  function addLink(sourceId, targetId, linkType, reasonLabel, baseColor = "#6f7a8d", extra = {}) {
    if (!sourceId || !targetId || sourceId === targetId) return null;
    if (!nodesById.has(sourceId) || !nodesById.has(targetId)) return null;
    const key = `${sourceId}|||${targetId}|||${linkType}`;
    if (linksByKey.has(key)) return null;
    linksByKey.add(key);
    const link = {
      key,
      sourceId,
      targetId,
      source: sourceId,
      target: targetId,
      linkType,
      mode: linkType,
      reasonLabel,
      baseColor,
      displayWidth: extra.displayWidth || 0.45,
      ...extra
    };
    links.push(link);
    const source = nodesById.get(sourceId);
    const target = nodesById.get(targetId);
    if (source) source.connections += 1;
    if (target) target.connections += 1;
    return link;
  }

  addNode({
    id: repoId,
    type: "repo",
    nodeType: "repo",
    label: repoMeta.full_name,
    path: repoMeta.full_name,
    language: repoMeta.language || "Unknown",
    color: NODE_TYPE_COLORS.repo,
    size: 18,
    radius: 10,
    url: repoMeta.html_url,
    githubUrl: repoMeta.html_url,
    description: repoMeta.description || ""
  });

  folders.forEach((folder) => {
    const role = detectArchitectureRole(folder.path);
    addNode({
      id: folder.id,
      type: "folder",
      nodeType: "folder",
      label: folder.name,
      path: folder.path,
      role,
      language: role || "Folder",
      color: role ? NODE_TYPE_COLORS.architecture : NODE_TYPE_COLORS.folder,
      size: Math.max(5, Math.min(18, 5 + Math.log2((folderStats.get(folder.path) || 1) + 1) * 2)),
      radius: Math.max(3, Math.min(9, 3 + Math.log2((folderStats.get(folder.path) || 1) + 1))),
      url: githubTreeUrl(repoMeta, folder.path),
      githubUrl: githubTreeUrl(repoMeta, folder.path)
    });
    addLink(folder.parentId || repoId, folder.id, "contains", "folder hierarchy", NODE_TYPE_COLORS.folder);
  });

  files.forEach((file) => {
    const node = addNode({
      id: fileNodeId(file.path),
      type: "file",
      nodeType: "file",
      label: file.name,
      name: file.name,
      path: file.path,
      extension: file.extension,
      language: file.language,
      sizeBytes: file.size,
      projectIndex: file.index,
      color: getLanguageColor(file.language),
      size: 4,
      radius: 2.8,
      url: githubFileUrl(repoMeta, file.path),
      githubUrl: githubFileUrl(repoMeta, file.path),
      isSecurityHotspot: isSecurityHotspot(file.path),
      isDependencyFile: isDependencyFilePath(file.path),
      isEntryFile: isEntryFile(file.path)
    });
    const parentFolder = parentFolderId(file.path);
    addLink(parentFolder || repoId, node.id, "contains", "folder contains file", NODE_TYPE_COLORS.folder);
  });

  const languages = new Map();
  files.forEach((file) => {
    if (!file.language || file.language === "Unknown") return;
    if (!languages.has(file.language)) {
      languages.set(file.language, addNode({
        id: `language:${file.language}`,
        type: "language",
        nodeType: "language",
        label: file.language,
        language: file.language,
        color: getLanguageColor(file.language),
        size: 7,
        radius: 4
      }));
    }
    addLink(fileNodeId(file.path), `language:${file.language}`, "language", `language: ${file.language}`, getLanguageColor(file.language), { displayWidth: 0.25 });
  });

  Object.entries(contentMap).forEach(([path, text]) => {
    if (!filesByPath.has(path)) return;
    if (isDependencyFilePath(path)) {
      dependencyFiles.push(path);
      const parsed = parseDependencies(path, text);
      parsed.forEach((dependency) => {
        const depId = `dependency:${dependency.manager}:${dependency.name}`;
        dependenciesByName.set(dependency.name.toLowerCase(), depId);
        addNode({
          id: depId,
          type: "dependency",
          nodeType: "dependency",
          label: dependency.name,
          name: dependency.name,
          manager: dependency.manager,
          version: dependency.version || "",
          language: dependency.manager,
          color: NODE_TYPE_COLORS.dependency,
          size: 5,
          radius: 3.2
        });
        const fileNode = nodesById.get(fileNodeId(path));
        if (fileNode && !fileNode.dependencies.includes(dependency.name)) {
          fileNode.dependencies.push(dependency.name);
        }
        addLink(fileNodeId(path), depId, "dependency", `${dependency.manager} dependency`, NODE_TYPE_COLORS.dependency, { displayWidth: 0.6 });
      });
    }
  });

  Object.entries(contentMap).forEach(([path, text]) => {
    if (!filesByPath.has(path)) return;
    parseImports(path, text).forEach((importItem) => {
      const resolved = resolveImportPath(path, importItem.source, filesByPath);
      const sourceNodeId = fileNodeId(path);
      const sourceNode = nodesById.get(sourceNodeId);
      if (!sourceNode) return;
      sourceNode.imports.push(importItem.source);

      if (resolved) {
        const targetNodeId = fileNodeId(resolved.path);
        const targetNode = nodesById.get(targetNodeId);
        if (targetNode && !targetNode.importedBy.includes(path)) {
          targetNode.importedBy.push(path);
        }
        importLinks.push({ sourcePath: path, targetPath: resolved.path });
        addLink(sourceNodeId, targetNodeId, "import", `imports ${resolved.path}`, NODE_TYPE_COLORS.import, { displayWidth: 0.75 });
        const sourceFolder = parentFolderId(path);
        const targetFolder = parentFolderId(resolved.path);
        if (sourceFolder && targetFolder && sourceFolder !== targetFolder) {
          folderPipelineLinks.add(`${sourceFolder}|||${targetFolder}`);
        }
        return;
      }

      const depName = packageNameFromImport(importItem.source);
      const depId = dependenciesByName.get(depName.toLowerCase());
      if (depId) {
        addLink(sourceNodeId, depId, "dependency-use", `uses dependency ${depName}`, NODE_TYPE_COLORS.dependency, { displayWidth: 0.35 });
        return;
      }

      if (!isLikelyLocalImport(importItem.source)) {
        const importId = `import:${depName}`;
        addNode({
          id: importId,
          type: "import",
          nodeType: "import",
          label: depName,
          name: depName,
          language: "External import",
          color: NODE_TYPE_COLORS.import,
          size: 4,
          radius: 2.7
        });
        addLink(sourceNodeId, importId, "import", `external import ${depName}`, NODE_TYPE_COLORS.import, { displayWidth: 0.25 });
      }
    });
  });

  folderPipelineLinks.forEach((item) => {
    const [sourceId, targetId] = item.split("|||");
    addLink(sourceId, targetId, "pipeline", "folder-to-folder import pipeline", NODE_TYPE_COLORS.pipeline, {
      displayWidth: 1.2,
      pipeline: true
    });
  });

  const roleNodes = new Set();
  folders.forEach((folder) => {
    const role = detectArchitectureRole(folder.path);
    if (!role) return;
    const roleId = `architecture:${role}`;
    if (!roleNodes.has(roleId)) {
      roleNodes.add(roleId);
      addNode({
        id: roleId,
        type: "architecture",
        nodeType: "architecture",
        label: role,
        role,
        language: "Architecture",
        color: NODE_TYPE_COLORS.architecture,
        size: 7,
        radius: 4
      });
    }
    addLink(folder.id, roleId, "architecture", `folder role: ${role}`, NODE_TYPE_COLORS.architecture, { displayWidth: 0.45 });
  });

  addNode({
    id: "architecture:config",
    type: "architecture",
    nodeType: "architecture",
    label: "config",
    role: "config",
    language: "Architecture",
    color: NODE_TYPE_COLORS.architecture,
    size: 7,
    radius: 4
  });

  const pipelineId = "pipeline:main";
  addNode({
    id: pipelineId,
    type: "pipeline",
    nodeType: "pipeline",
    label: "main pipeline",
    language: "Pipeline",
    color: NODE_TYPE_COLORS.pipeline,
    size: 8,
    radius: 4.5
  });

  const importantId = "important:files";
  addNode({
    id: importantId,
    type: "important",
    nodeType: "important",
    label: "important files",
    language: "Important",
    color: NODE_TYPE_COLORS.important,
    size: 7,
    radius: 4
  });

  const securityId = "security:hotspots";
  addNode({
    id: securityId,
    type: "security-hotspot",
    nodeType: "security-hotspot",
    label: "security hotspots",
    language: "Security",
    color: NODE_TYPE_COLORS["security-hotspot"],
    size: 7,
    radius: 4
  });

  scoreProjectFiles(nodesById, folderStats);
  files.forEach((file) => {
    const node = nodesById.get(fileNodeId(file.path));
    if (!node) return;
    node.size = Math.max(4, Math.min(15, 4 + node.importanceScore / 12));
    node.radius = Math.max(2.5, Math.min(8.5, 2.5 + node.importanceScore / 18));
    if (node.importanceScore >= 45) {
      addLink(importantId, node.id, "important", `importance score ${node.importanceScore}`, NODE_TYPE_COLORS.important, { displayWidth: 0.6 });
    }
    if (node.isSecurityHotspot) {
      addLink(securityId, node.id, "security-hotspot", "security-sensitive path or name", NODE_TYPE_COLORS["security-hotspot"], { displayWidth: 0.8 });
    }
    if (node.isEntryFile) {
      addLink(node.id, pipelineId, "pipeline", "entry file feeds main pipeline", NODE_TYPE_COLORS.pipeline, { displayWidth: 1 });
    }
    if (node.isDependencyFile) {
      addLink(node.id, "architecture:config", "architecture", "dependency/config file shapes architecture", NODE_TYPE_COLORS.architecture, { displayWidth: 0.65 });
    }
  });

  const summary = generateArchitectureSummary(files, folders, nodesById, dependenciesByName, importLinks, repoMeta);

  return {
    nodes,
    links,
    files,
    folders,
    summary
  };
}

function addToBucket(map, key, nodeId) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(nodeId);
}

function buildFolderList(files) {
  const folders = new Map();
  files.forEach((file) => {
    const parts = file.path.split("/").slice(0, -1);
    let current = "";
    parts.forEach((part) => {
      const parent = current;
      current = current ? `${current}/${part}` : part;
      if (!folders.has(current)) {
        folders.set(current, {
          id: folderNodeId(current),
          path: current,
          name: part,
          parentId: parent ? folderNodeId(parent) : null
        });
      }
    });
  });
  return Array.from(folders.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function countFilesByFolder(files) {
  const counts = new Map();
  files.forEach((file) => {
    const parts = file.path.split("/").slice(0, -1);
    for (let i = 0; i < parts.length; i += 1) {
      const folder = parts.slice(0, i + 1).join("/");
      counts.set(folder, (counts.get(folder) || 0) + 1);
    }
  });
  return counts;
}

function fileNodeId(path) {
  return `file:${path}`;
}

function folderNodeId(path) {
  return `folder:${path}`;
}

function parentFolderId(path) {
  const folder = dirname(path);
  return folder ? folderNodeId(folder) : null;
}

function basename(path) {
  return path.split("/").pop() || path;
}

function dirname(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function getExtension(path) {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index).toLowerCase() : "";
}

function languageFromPath(path) {
  const ext = getExtension(path);
  const name = basename(path).toLowerCase();
  const byExt = {
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".py": "Python",
    ".html": "HTML",
    ".css": "CSS",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".xml": "XML",
    ".java": "Java",
    ".php": "PHP",
    ".rb": "Ruby",
    ".go": "Go",
    ".rs": "Rust",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".sh": "Shell"
  };
  if (name === "dockerfile") return "Docker";
  return byExt[ext] || "Unknown";
}

function githubFileUrl(repoMeta, path) {
  return `${repoMeta.html_url}/blob/${encodeURIComponent(repoMeta.default_branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function githubTreeUrl(repoMeta, path) {
  return `${repoMeta.html_url}/tree/${encodeURIComponent(repoMeta.default_branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function isDependencyFilePath(path) {
  return DEPENDENCY_FILE_NAMES.has(basename(path).toLowerCase());
}

function isEntryFile(path) {
  return ENTRY_FILE_NAMES.has(basename(path).toLowerCase());
}

function isTestPath(path) {
  const lower = path.toLowerCase();
  return lower.includes("/test/") || lower.includes("/tests/") || lower.includes("__tests__") || lower.includes(".spec.") || lower.includes(".test.");
}

function isSecurityHotspot(path) {
  const lower = path.toLowerCase();
  return SECURITY_TERMS.some((term) => lower.includes(term));
}

function detectArchitectureRole(path) {
  const segments = path.toLowerCase().split("/");
  for (const [role, terms] of Object.entries(ARCHITECTURE_ROLES)) {
    if (segments.some((segment) => terms.includes(segment))) {
      return role;
    }
  }
  return "";
}

function parseImports(path, text) {
  const ext = getExtension(path);
  if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) return parseJsImports(text);
  if (ext === ".py") return parsePythonImports(text);
  if (ext === ".html") return parseHtmlImports(text);
  if (ext === ".css") return parseCssImports(text);
  return [];
}

function parseJsImports(text) {
  const imports = [];
  collectMatches(text, /\bimport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g, imports);
  collectMatches(text, /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, imports);
  collectMatches(text, /\bexport\s+(?:[^'"]+?\s+from\s+)?["']([^"']+)["']/g, imports);
  return dedupeImports(imports, "javascript");
}

function parsePythonImports(text) {
  const imports = [];
  text.split(/\r?\n/).forEach((line) => {
    const fromMatch = line.match(/^\s*from\s+([.\w]+)\s+import\s+/);
    if (fromMatch) imports.push(fromMatch[1]);
    const importMatch = line.match(/^\s*import\s+(.+)/);
    if (importMatch) {
      importMatch[1].split(",").forEach((item) => imports.push(item.trim().split(/\s+/)[0]));
    }
  });
  return dedupeImports(imports, "python");
}

function parseHtmlImports(text) {
  const imports = [];
  collectMatches(text, /<script[^>]+src=["']([^"']+)["']/gi, imports);
  collectMatches(text, /<link[^>]+href=["']([^"']+)["']/gi, imports);
  collectMatches(text, /<img[^>]+src=["']([^"']+)["']/gi, imports);
  return dedupeImports(imports, "html");
}

function parseCssImports(text) {
  const imports = [];
  collectMatches(text, /@import\s+(?:url\()?["']([^"']+)["']/gi, imports);
  collectMatches(text, /url\(["']?([^)"']+)["']?\)/gi, imports);
  return dedupeImports(imports, "css");
}

function collectMatches(text, regex, target) {
  let match = regex.exec(text);
  while (match) {
    target.push(match[1]);
    match = regex.exec(text);
  }
}

function dedupeImports(imports, parser) {
  return Array.from(new Set(imports.map(cleanImportSource).filter(Boolean)))
    .filter((source) => !source.startsWith("http") && !source.startsWith("data:") && !source.startsWith("#"))
    .map((source) => ({ source, parser }));
}

function cleanImportSource(source) {
  return String(source || "").trim().replace(/[?#].*$/, "");
}

function resolveImportPath(fromPath, source, filesByPath) {
  const cleaned = cleanImportSource(source);
  if (!cleaned) return null;

  if (isLikelyLocalImport(cleaned)) {
    const baseDir = cleaned.startsWith("/") ? "" : dirname(fromPath);
    const normalized = normalizePath(cleaned.startsWith("/") ? cleaned.slice(1) : `${baseDir}/${cleaned}`);
    return findFileCandidate(normalized, filesByPath);
  }

  const pythonModulePath = cleaned.replace(/\./g, "/");
  return findFileCandidate(pythonModulePath, filesByPath);
}

function isLikelyLocalImport(source) {
  return source.startsWith(".") || source.startsWith("/") || source.startsWith("..");
}

function findFileCandidate(basePath, filesByPath) {
  const normalized = normalizePath(basePath);
  const candidates = [normalized];
  if (!getExtension(normalized)) {
    IMPORT_EXTENSIONS.forEach((ext) => candidates.push(`${normalized}${ext}`));
    IMPORT_EXTENSIONS.forEach((ext) => candidates.push(`${normalized}/index${ext}`));
    candidates.push(`${normalized}/__init__.py`);
  }
  for (const candidate of candidates) {
    if (filesByPath.has(candidate)) {
      return filesByPath.get(candidate);
    }
  }
  return null;
}

function normalizePath(path) {
  const parts = [];
  path.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function packageNameFromImport(source) {
  const cleaned = cleanImportSource(source);
  if (cleaned.startsWith("@")) {
    return cleaned.split("/").slice(0, 2).join("/");
  }
  return cleaned.split(/[/.]/)[0] || cleaned;
}

function parseDependencies(path, text) {
  const name = basename(path).toLowerCase();
  if (name === "package.json" || name === "package-lock.json") return parsePackageJsonDependencies(text);
  if (name === "requirements.txt") return parseRequirementsDependencies(text);
  if (name === "pyproject.toml" || name === "pipfile") return parsePythonProjectDependencies(text);
  if (name === "composer.json") return parseComposerDependencies(text);
  if (name === "pom.xml") return parsePomDependencies(text);
  if (name === "dockerfile" || name === "docker-compose.yml") return parseDockerDependencies(text);
  return [];
}

function parsePackageJsonDependencies(text) {
  try {
    const json = JSON.parse(text);
    return [
      ...dependencyEntries(json.dependencies, "npm"),
      ...dependencyEntries(json.devDependencies, "npm-dev")
    ];
  } catch {
    return [];
  }
}

function dependencyEntries(record, manager) {
  if (!record || typeof record !== "object") return [];
  return Object.entries(record).map(([name, version]) => ({ name, version: String(version || ""), manager }));
}

function parseRequirementsDependencies(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => line.split(/[<>=!~;\[]/)[0].trim())
    .filter(Boolean)
    .map((name) => ({ name, manager: "pip" }));
}

function parsePythonProjectDependencies(text) {
  const matches = Array.from(text.matchAll(/["']([A-Za-z0-9_.-]+)(?:[<>=!~].*)?["']/g));
  return matches.slice(0, 80).map((match) => ({ name: match[1], manager: "python" }));
}

function parseComposerDependencies(text) {
  try {
    const json = JSON.parse(text);
    return dependencyEntries(json.require, "composer");
  } catch {
    return [];
  }
}

function parsePomDependencies(text) {
  const dependencies = [];
  const regex = /<artifactId>([^<]+)<\/artifactId>/g;
  let match = regex.exec(text);
  while (match && dependencies.length < 80) {
    dependencies.push({ name: match[1], manager: "maven" });
    match = regex.exec(text);
  }
  return dependencies;
}

function parseDockerDependencies(text) {
  const dependencies = [];
  text.split(/\r?\n/).forEach((line) => {
    const fromMatch = line.match(/^\s*FROM\s+([^\s]+)/i);
    if (fromMatch) dependencies.push({ name: fromMatch[1], manager: "docker" });
  });
  return dependencies;
}

function scoreProjectFiles(nodesById, folderStats) {
  Array.from(nodesById.values())
    .filter((node) => node.type === "file")
    .forEach((node) => {
      let score = 0;
      const reasons = [];
      const lowerName = node.name.toLowerCase();
      const folder = dirname(node.path);

      if (isEntryFile(node.path)) addScore(30, "entry point file");
      if (isConfigFile(node.path)) addScore(20, "configuration file");
      if (isDependencyFilePath(node.path)) addScore(25, "dependency manifest");
      if (IMPORTANT_FILE_NAMES.has(lowerName)) addScore(10, "known important project file");
      if (node.importedBy.length >= 3) addScore(20, "imported by many files");
      if (node.imports.length >= 5) addScore(15, "imports many files");
      if (isSecurityHotspot(node.path)) addScore(25, "security-sensitive path or name");
      if (lowerName.includes("readme") || lowerName.includes("license") || node.path.toLowerCase().includes("docs/")) addScore(10, "README/license/docs file");
      if (isTestPath(node.path)) addScore(8, "test file");
      if ((folderStats.get(folder) || 0) >= 20) addScore(15, "large central folder");

      node.importanceScore = Math.min(100, score);
      node.importanceReasons = reasons;

      function addScore(points, reason) {
        score += points;
        reasons.push(reason);
      }
    });
}

function isConfigFile(path) {
  const lower = basename(path).toLowerCase();
  return lower.includes("config") || lower.endsWith(".config.js") || lower.endsWith(".config.ts") || lower === "tsconfig.json" || lower === ".env.example";
}

function generateArchitectureSummary(files, folders, nodesById, dependenciesByName, importLinks, repoMeta) {
  const filePaths = files.map((file) => file.path.toLowerCase());
  const languages = countBy(files.map((file) => file.language).filter((language) => language !== "Unknown"));
  const entryFiles = files.filter((file) => isEntryFile(file.path)).map((file) => file.path);
  const importantFolders = folders
    .filter((folder) => detectArchitectureRole(folder.path))
    .map((folder) => `${folder.path} (${detectArchitectureRole(folder.path)})`)
    .slice(0, 12);
  const securityHotspots = Array.from(nodesById.values())
    .filter((node) => node.type === "file" && node.isSecurityHotspot)
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .map((node) => node.path)
    .slice(0, 12);
  const dependencies = Array.from(dependenciesByName.keys()).slice(0, 18);
  const pipelineFlow = importLinks
    .map((link) => `${dirname(link.sourcePath) || "."} -> ${dirname(link.targetPath) || "."}`)
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .slice(0, 10);
  const missing = [];
  if (!filePaths.some((path) => basename(path).startsWith("readme"))) missing.push("README.md");
  if (!filePaths.some((path) => basename(path).startsWith("license"))) missing.push("LICENSE");
  if (!filePaths.some((path) => isTestPath(path))) missing.push("tests");
  if (filePaths.includes("package.json") && !filePaths.includes("package-lock.json")) missing.push("package-lock.json");

  const projectType = detectProjectType(filePaths);
  const suggestions = [];
  if (securityHotspots.length) suggestions.push("Review security hotspot files before releases.");
  if (dependencies.length > 15) suggestions.push("Use dependency filtering to inspect third-party surface area.");
  if (pipelineFlow.length > 8) suggestions.push("Use Pipeline View to inspect cross-folder coupling.");
  if (missing.length) suggestions.push(`Consider adding ${missing.slice(0, 3).join(", ")}.`);

  return {
    projectType,
    mainLanguages: Array.from(languages.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
    entryFiles,
    importantFolders,
    dependencies,
    pipelineFlow,
    securityHotspots,
    missing,
    suggestions,
    repo: repoMeta.full_name
  };
}

function detectProjectType(paths) {
  const has = (target) => paths.some((path) => path === target || path.endsWith(`/${target}`));
  const types = [];
  if (has("next.config.js") || has("next.config.ts")) types.push("Next.js");
  if (has("package.json") && paths.some((path) => /src\/app\.(jsx|tsx|js|ts)$/.test(path))) types.push("React/Vite");
  if ((has("app.py") || has("main.py")) && has("requirements.txt")) types.push("Python backend");
  if (has("index.html") && has("app.js")) types.push("Static frontend");
  if (has("dockerfile")) types.push("Docker-ready");
  if (has("docker-compose.yml")) types.push("multi-service");
  return types.length ? types.join(" + ") : "General repository";
}

function countBy(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return counts;
}

function addBucketLinks(bucketMap, reasonType, linksByKey, nodesById) {
  bucketMap.forEach((ids, reasonValue) => {
    const uniqueIds = Array.from(new Set(ids)).sort();
    if (uniqueIds.length < 2) {
      return;
    }

    for (let i = 0; i < uniqueIds.length - 1; i += 1) {
      for (let j = i + 1; j < uniqueIds.length; j += 1) {
        upsertLink(uniqueIds[i], uniqueIds[j], reasonType, reasonValue, linksByKey, nodesById);
      }
    }
  });
}

function upsertLink(sourceId, targetId, reasonType, reasonValue, linksByKey, nodesById) {
  const key = sourceId < targetId ? `${sourceId}|||${targetId}` : `${targetId}|||${sourceId}`;
  const source = nodesById.get(sourceId);
  const target = nodesById.get(targetId);

  if (!source || !target) {
    return;
  }

  if (!linksByKey.has(key)) {
    linksByKey.set(key, {
      key,
      sourceId,
      targetId,
      languages: [],
      topics: []
    });
  }

  const link = linksByKey.get(key);
  const bucket = reasonType === "language" ? link.languages : link.topics;
  if (!bucket.includes(reasonValue)) {
    bucket.push(reasonValue);
  }

  link.mode = link.languages.length > 0 && link.topics.length > 0
    ? "both"
    : link.languages.length > 0
      ? "language"
      : "topic";
  link.reasonLabel = linkReasonLabel(link);
  link.baseColor = link.languages.length > 0 ? getLanguageColor(link.languages[0]) : "#48d6c6";
}

function applyFilters() {
  if (!state.graph) {
    return;
  }

  if (state.graphMode === "project") {
    applyProjectFilters();
    return;
  }

  applyRepoFilters();
}

function applyRepoFilters() {
  if (!state.graph) {
    return;
  }

  const highlight = state.highlightQuery;
  const minStars = state.minStars;
  const visibleBaseNodes = state.baseGraphData.nodes.filter((node) => node.stars >= minStars);
  const visibleNodeIds = new Set(visibleBaseNodes.map((node) => node.id));
  const displayNodes = visibleBaseNodes.map((node) => {
    const highlighted = !highlight || nodeMatchesQuery(node, highlight);
    return {
      ...node,
      highlighted,
      displayColor: highlighted ? node.color : mutedNodeColor()
    };
  });
  const displayNodeMap = new Map(displayNodes.map((node) => [node.id, node]));
  const displayLinks = state.baseGraphData.links
    .filter((link) => visibleNodeIds.has(link.sourceId) && visibleNodeIds.has(link.targetId))
    .filter((link) => linkMatchesMode(link, state.linkMode))
    .map((link) => {
      const source = displayNodeMap.get(link.sourceId);
      const target = displayNodeMap.get(link.targetId);
      const highlighted = !highlight || source?.highlighted || target?.highlighted || linkMatchesQuery(link, highlight);
      return {
        ...link,
        source: link.sourceId,
        target: link.targetId,
        highlighted,
        displayColor: highlighted ? link.baseColor : mutedLinkColor(),
        displayWidth: highlighted ? 0.7 : 0.18,
        particles: highlighted && highlight ? 2 : 0
      };
    });

  state.filteredGraphData = { nodes: displayNodes, links: displayLinks };
  state.graph.graphData(state.filteredGraphData);
  tuneForces();
  renderRepoStats();
  renderLegend(displayNodes);
  renderArchitectureSummary(null);
  updatePerformanceBottleneck();
}

function applyProjectFilters() {
  const highlight = state.highlightQuery;
  const visibleNodeIds = new Set();
  const graphData = state.projectGraphData;
  const fileNodes = graphData.nodes.filter((node) => node.type === "file");
  const limitedFileIds = new Set(
    fileNodes
      .sort((a, b) => (a.projectIndex || 0) - (b.projectIndex || 0))
      .slice(0, state.projectFileLimit)
      .map((node) => node.id)
  );

  graphData.nodes.forEach((node) => {
    if (projectNodeVisibleInView(node, limitedFileIds)) {
      visibleNodeIds.add(node.id);
      includeParentFolders(node, visibleNodeIds);
    }
  });

  graphData.links.forEach((link) => {
    if (!projectLinkVisibleInView(link)) return;
    if (visibleNodeIds.has(link.sourceId) && visibleNodeIds.has(link.targetId)) return;
    if (["pipeline", "import", "dependency", "dependency-use", "security-hotspot", "important", "architecture"].includes(link.linkType)) {
      if (visibleNodeIds.has(link.sourceId) || visibleNodeIds.has(link.targetId)) {
        visibleNodeIds.add(link.sourceId);
        visibleNodeIds.add(link.targetId);
      }
    }
  });

  const displayNodes = graphData.nodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node) => {
      const highlighted = !highlight || projectNodeMatchesQuery(node, highlight);
      return {
        ...node,
        highlighted,
        displayColor: highlighted ? node.color : mutedNodeColor()
      };
    });
  const displayNodeIds = new Set(displayNodes.map((node) => node.id));
  const displayLinks = graphData.links
    .filter((link) => displayNodeIds.has(link.sourceId) && displayNodeIds.has(link.targetId))
    .filter(projectLinkVisibleInView)
    .map((link) => {
      const highlighted = !highlight || projectLinkMatchesQuery(link, highlight);
      return {
        ...link,
        source: link.sourceId,
        target: link.targetId,
        highlighted,
        displayColor: highlighted ? link.baseColor : mutedLinkColor(),
        displayWidth: link.pipeline && state.viewMode === "pipeline" ? 1.8 : link.displayWidth || 0.35,
        particles: link.pipeline && (state.viewMode === "pipeline" || state.viewMode === "architecture") ? 1 : 0
      };
    });

  state.filteredGraphData = { nodes: displayNodes, links: displayLinks };
  state.graph.graphData(state.filteredGraphData);
  tuneForces();
  renderProjectStats();
  renderLegend(displayNodes.filter((node) => node.language && node.type === "file"));
  renderArchitectureSummary(state.project?.summary || null);
  updatePerformanceBottleneck();
  updateLoadMoreButton();
}

function linkMatchesMode(link, mode) {
  if (mode === "language") {
    return link.languages.length > 0;
  }
  if (mode === "topic") {
    return link.topics.length > 0;
  }
  return true;
}

function nodeMatchesQuery(node, query) {
  if (!query) {
    return true;
  }

  return [
    node.label,
    node.fullName,
    node.language,
    ...node.topics
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

function linkMatchesQuery(link, query) {
  if (!query) {
    return true;
  }

  return [...link.languages, ...link.topics]
    .some((value) => String(value || "").toLowerCase().includes(query));
}

function tuneForces() {
  if (!state.graph || typeof state.graph.d3Force !== "function") {
    return;
  }

  const charge = state.graph.d3Force("charge");
  const link = state.graph.d3Force("link");
  if (charge && typeof charge.strength === "function") {
    charge.strength(-80);
  }
  if (link && typeof link.distance === "function") {
    link.distance((item) => (item.mode === "topic" ? 72 : 54));
  }
}

function configureStarsRange(repos) {
  const maxStars = repos.reduce((max, repo) => Math.max(max, repo.stars), 0);
  const roundedMax = Math.max(20, Math.ceil(maxStars / 10) * 10);
  refs.minStarsRange.max = String(roundedMax);
  refs.minStarsRange.step = roundedMax > 200 ? "5" : "1";
}

function renderLegend(nodes) {
  const counts = new Map();
  nodes.forEach((node) => {
    counts.set(node.language, (counts.get(node.language) || 0) + 1);
  });

  const items = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  refs.legendPanel.hidden = items.length === 0;
  refs.legendList.innerHTML = items.map(([language, count]) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background: ${getLanguageColor(language)}; color: ${getLanguageColor(language)}"></span>
      <span class="legend-name" title="${escapeHtml(language)}">${escapeHtml(language)}</span>
      <span>${formatNumber(count)}</span>
    </div>
  `).join("");
}

function renderStats() {
  if (state.graphMode === "project") {
    renderProjectStats();
    return;
  }
  renderRepoStats();
}

function renderRepoStats() {
  refs.primaryStatLabel.textContent = "Repos";
  refs.secondaryStatLabel.textContent = "Links";
  refs.visibleStatLabel.textContent = "Visible";
  refs.repoCount.textContent = formatNumber(state.baseGraphData.nodes.length);
  refs.linkCount.textContent = formatNumber(state.baseGraphData.links.length);
  refs.visibleCount.textContent = formatNumber(state.filteredGraphData.nodes.length);
}

function renderProjectStats() {
  refs.primaryStatLabel.textContent = "Nodes";
  refs.secondaryStatLabel.textContent = "Links";
  refs.visibleStatLabel.textContent = "Files";
  refs.repoCount.textContent = formatNumber(state.projectGraphData.nodes.length);
  refs.linkCount.textContent = formatNumber(state.filteredGraphData.links.length);
  refs.visibleCount.textContent = formatNumber(
    state.filteredGraphData.nodes.filter((node) => node.type === "file").length
  );
}

function projectNodeVisibleInView(node, limitedFileIds) {
  if (state.focusedFolderId && node.type === "file") {
    const focused = state.focusedFolderId.replace(/^folder:/, "");
    if (!node.path.startsWith(`${focused}/`)) return false;
  }

  if (node.type === "repo") return true;
  if (node.type === "folder") {
    if (state.focusedFolderId) {
      const focused = state.focusedFolderId.replace(/^folder:/, "");
      return node.id === state.focusedFolderId || node.path.startsWith(`${focused}/`) || focused.startsWith(`${node.path}/`);
    }
    if (state.viewMode === "architecture") return Boolean(node.role) || topLevelFolder(node.path);
    if (state.viewMode === "pipeline") return true;
    return true;
  }

  if (state.viewMode === "project") {
    if (node.type === "file") return limitedFileIds.has(node.id) || node.importanceScore >= 60;
    return ["language", "dependency", "import", "architecture", "pipeline", "important", "security-hotspot"].includes(node.type);
  }
  if (state.viewMode === "architecture") {
    if (node.type === "file") return node.importanceScore >= 45 || node.isEntryFile || node.isDependencyFile || node.isSecurityHotspot;
    return ["architecture", "pipeline", "important", "security-hotspot", "dependency"].includes(node.type);
  }
  if (state.viewMode === "pipeline") {
    if (node.type === "file") return node.imports.length || node.importedBy.length || node.isEntryFile;
    return ["folder", "pipeline"].includes(node.type);
  }
  if (state.viewMode === "critical") {
    if (node.type === "file") return node.importanceScore >= 50;
    return ["important", "security-hotspot", "pipeline"].includes(node.type);
  }
  if (state.viewMode === "dependencies") {
    if (node.type === "file") return node.isDependencyFile;
    return node.type === "dependency";
  }
  if (state.viewMode === "security") {
    if (node.type === "file") return node.isSecurityHotspot;
    return node.type === "security-hotspot";
  }
  return true;
}

function projectLinkVisibleInView(link) {
  if (state.viewMode === "pipeline") return ["pipeline", "import", "contains"].includes(link.linkType);
  if (state.viewMode === "architecture") return ["architecture", "pipeline", "important", "security-hotspot", "contains", "dependency"].includes(link.linkType);
  if (state.viewMode === "critical") return ["important", "security-hotspot", "contains", "pipeline"].includes(link.linkType);
  if (state.viewMode === "dependencies") return ["dependency", "dependency-use", "contains"].includes(link.linkType);
  if (state.viewMode === "security") return ["security-hotspot", "contains"].includes(link.linkType);
  return true;
}

function includeParentFolders(node, visibleNodeIds) {
  if (!node.path || !["file", "folder"].includes(node.type)) return;
  let current = node.type === "folder" ? node.path : dirname(node.path);
  while (current) {
    visibleNodeIds.add(folderNodeId(current));
    current = dirname(current);
  }
}

function projectNodeMatchesQuery(node, query) {
  return [
    node.label,
    node.name,
    node.path,
    node.type,
    node.language,
    node.role,
    ...(node.importanceReasons || []),
    ...(node.dependencies || [])
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

function projectLinkMatchesQuery(link, query) {
  return [link.linkType, link.reasonLabel].some((value) => String(value || "").toLowerCase().includes(query));
}

function topLevelFolder(path) {
  return path && !path.includes("/");
}

function updateLoadMoreButton() {
  if (state.graphMode !== "project" || !state.project) {
    refs.loadMoreButton.hidden = true;
    return;
  }
  refs.loadMoreButton.hidden = state.project.totalFiles <= state.projectFileLimit || state.viewMode !== "project";
  refs.loadMoreButton.textContent = `Load more files (${formatNumber(Math.min(state.project.totalFiles - state.projectFileLimit, LOAD_MORE_FILE_COUNT))})`;
}

function renderEmptyState(show, title = "Enter a username above to begin", message = "Repo nodes connect when they share a primary language or topic.") {
  refs.emptyState.hidden = !show;
  refs.emptyState.querySelector("h2").textContent = title;
  refs.emptyState.querySelector("p").textContent = message;
}

function resetGraph() {
  state.repos = [];
  state.project = null;
  state.projectGraphData = { nodes: [], links: [] };
  state.baseGraphData = { nodes: [], links: [] };
  state.filteredGraphData = { nodes: [], links: [] };
  if (state.graph) {
    state.graph.graphData(state.filteredGraphData);
  }
  refs.legendPanel.hidden = true;
  refs.legendList.innerHTML = "";
  refs.loadMoreButton.hidden = true;
  refs.architecturePanel.hidden = true;
  refs.architectureSummary.innerHTML = "";
  renderStats();
}

function createRepoPlanet(node) {
  if (!window.THREE) {
    return null;
  }

  const color = new THREE.Color(node.displayColor || node.color);
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    getSphereGeometry(node.radius),
    getPlanetMaterial(color, node.highlighted === false)
  );
  group.add(sphere);

  if (node.stars > 0) {
    const ring = new THREE.Mesh(
      getRingGeometry(node.radius),
      getRingMaterial(node.highlighted === false)
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.PI / 7;
    group.add(ring);
  }

  return group;
}

function getSphereGeometry(radius) {
  const key = `sphere:${radius.toFixed(1)}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.SphereGeometry(radius, 8, 8));
  }
  return geometryCache.get(key);
}

function getRingGeometry(radius) {
  const key = `ring:${radius.toFixed(1)}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(
      key,
      new THREE.TorusGeometry(radius * 1.45, Math.max(0.05, radius * 0.035), 6, 24)
    );
  }
  return geometryCache.get(key);
}

function getPlanetMaterial(color, dimmed) {
  const key = `planet:${color.getHexString()}:${dimmed}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshPhongMaterial({
      color,
      emissive: color.clone().multiplyScalar(dimmed ? 0.05 : 0.18),
      shininess: 28,
      transparent: true,
      opacity: dimmed ? 0.58 : 0.96
    }));
  }
  return materialCache.get(key);
}

function getRingMaterial(dimmed) {
  const key = `ring:${dimmed}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshBasicMaterial({
      color: dimmed ? 0x7d8796 : 0xffffff,
      transparent: true,
      opacity: dimmed ? 0.12 : 0.28
    }));
  }
  return materialCache.get(key);
}

function handleNodeHover(node) {
  refs.graph.style.cursor = node ? "pointer" : "";
  showRepoPanel(node);
}

function handleNodeClick(node) {
  if (!node) return;
  if (state.graphMode === "galaxy") {
    if (node.url) window.open(node.url, "_blank", "noopener,noreferrer");
    return;
  }

  const now = Date.now();
  const doubleClick = state.selectedNode?.id === node.id && now - state.selectedNode.clickedAt < 450;
  state.selectedNode = { id: node.id, clickedAt: now };
  showRepoPanel(node);

  if (node.type === "folder") {
    state.focusedFolderId = node.id;
    setStatus(`Focused folder: ${node.path}`);
    applyFilters();
    return;
  }

  if (node.type === "file" && doubleClick && node.githubUrl) {
    window.open(node.githubUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (node.type === "language") {
    refs.highlightInput.value = node.language || node.label;
    state.highlightQuery = refs.highlightInput.value.trim().toLowerCase();
    applyFilters();
  }
}

function showRepoPanel(node) {
  if (!node) {
    refs.repoPanel.hidden = true;
    refs.repoPanel.innerHTML = "";
    return;
  }

  if (state.graphMode === "project") {
    showProjectNodePanel(node);
    return;
  }

  refs.repoPanel.hidden = false;
  refs.repoPanel.innerHTML = `
    <h2>${escapeHtml(node.label)}</h2>
    <p>${escapeHtml(node.description || "No description provided.")}</p>
    <div class="repo-meta">
      <span>${escapeHtml(node.language)}</span>
      <span>${formatNumber(node.stars)} stars</span>
      <span>${formatNumber(node.forks)} forks</span>
      <span>Updated ${formatDate(node.updatedAt)}</span>
    </div>
    ${node.topics.length ? `
      <div class="topic-list">
        ${node.topics.slice(0, 8).map((topic) => `<span class="topic-pill">${escapeHtml(topic)}</span>`).join("")}
      </div>
    ` : ""}
  `;
}

function showProjectNodePanel(node) {
  refs.repoPanel.hidden = false;
  refs.repoPanel.innerHTML = `
    <h2>${escapeHtml(node.label || node.name || node.path)}</h2>
    <p>${escapeHtml(node.description || node.path || node.type)}</p>
    <div class="repo-meta">
      <span>${escapeHtml(node.type)}</span>
      ${node.language ? `<span>${escapeHtml(node.language)}</span>` : ""}
      ${Number.isFinite(node.importanceScore) ? `<span>${formatNumber(node.importanceScore)} score</span>` : ""}
      <span>${formatNumber(node.connections || 0)} connections</span>
    </div>
    <dl class="detail-grid">
      ${detailRow("Path", node.path)}
      ${detailRow("Extension", node.extension)}
      ${detailRow("Why important", (node.importanceReasons || []).join(", "))}
      ${detailRow("Imports", (node.imports || []).slice(0, 8).join(", "))}
      ${detailRow("Imported by", (node.importedBy || []).slice(0, 8).join(", "))}
      ${detailRow("Dependencies", (node.dependencies || []).slice(0, 8).join(", "))}
      ${detailRow("GitHub", node.githubUrl || node.url)}
    </dl>
  `;
}

function detailRow(label, value) {
  if (!value) return "";
  const safe = escapeHtml(value);
  if (String(value).startsWith("https://")) {
    return `<div><dt>${escapeHtml(label)}</dt><dd><a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a></dd></div>`;
  }
  return `<div><dt>${escapeHtml(label)}</dt><dd>${safe}</dd></div>`;
}

function repoTooltipHtml(node) {
  if (state.graphMode === "project") {
    return `
      <div class="graph-tooltip">
        <strong>${escapeHtml(node.label || node.path)}</strong>
        <span>${escapeHtml(node.type)}${node.language ? ` - ${escapeHtml(node.language)}` : ""}</span>
        <span>${node.path ? escapeHtml(node.path) : ""}</span>
        <span>Score ${formatNumber(node.importanceScore || 0)} - ${formatNumber(node.connections || 0)} connections</span>
      </div>
    `;
  }

  return `
    <div class="graph-tooltip">
      <strong>${escapeHtml(node.label)}</strong>
      <span>${escapeHtml(node.language)} - ${formatNumber(node.stars)} stars - ${formatNumber(node.forks)} forks</span>
      <span>${escapeHtml(node.description || "No description provided.")}</span>
    </div>
  `;
}

function linkTooltipHtml(link) {
  if (state.graphMode === "project") {
    return `
      <div class="graph-tooltip">
        <strong>${escapeHtml(link.linkType || "connection")}</strong>
        <span>${escapeHtml(link.reasonLabel || "")}</span>
      </div>
    `;
  }

  return `
    <div class="graph-tooltip">
      <strong>Shared ${escapeHtml(link.mode)}</strong>
      <span>${escapeHtml(link.reasonLabel)}</span>
    </div>
  `;
}

function linkReasonLabel(link) {
  const parts = [];
  if (link.languages.length) {
    parts.push(`language: ${link.languages.join(", ")}`);
  }
  if (link.topics.length) {
    parts.push(`topics: ${link.topics.slice(0, 5).join(", ")}`);
  }
  return parts.join(" | ");
}

function setLinkMode(mode) {
  state.linkMode = mode;
  refs.linkModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.linkMode === mode);
  });
  applyFilters();
}

function setInputMode(mode) {
  state.inputMode = mode;
  refs.inputModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.inputMode === mode);
  });
  refs.usernameInput.placeholder = mode === "repo" ? "https://github.com/owner/repo" : "GitHub username";
  refs.usernameInput.setAttribute("aria-label", mode === "repo" ? "GitHub repository URL" : "GitHub username");
}

function setViewMode(mode) {
  if (mode === "galaxy") {
    state.graphMode = "galaxy";
    state.viewMode = "galaxy";
    if (state.repos.length) {
      state.baseGraphData = buildGraphData(state.repos);
      applyFilters();
      renderEmptyState(false);
    } else {
      setStatus("Galaxy View needs username data. Project views are still available.", "error");
      state.graphMode = state.project ? "project" : "galaxy";
      state.viewMode = state.project ? "project" : "galaxy";
      if (state.project) {
        state.baseGraphData = state.projectGraphData;
        applyFilters();
      } else {
        renderEmptyState(true, "Enter a username above to begin", "Username mode shows the repository galaxy.");
      }
    }
    updateViewModeButtons();
    return;
  }

  if (!state.project) {
    setStatus("Load a GitHub repo URL first to use project views.", "error");
    return;
  }

  state.graphMode = "project";
  state.viewMode = mode;
  state.baseGraphData = state.projectGraphData;
  updateViewModeButtons();
  applyFilters();
}

function updateViewModeButtons() {
  refs.viewModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewMode === state.viewMode);
  });
  refs.architecturePanel.hidden = !(state.graphMode === "project" && ["architecture", "pipeline", "critical", "dependencies", "security"].includes(state.viewMode));
}

function loadMoreProjectFiles() {
  if (state.graphMode !== "project") return;
  state.projectFileLimit += LOAD_MORE_FILE_COUNT;
  applyFilters();
}

function renderArchitectureSummary(summary) {
  if (!summary) {
    refs.architecturePanel.hidden = true;
    refs.architectureSummary.innerHTML = "";
    return;
  }

  refs.architectureSummary.innerHTML = `
    <div class="architecture-summary">
      ${summarySection("Project type", [summary.projectType])}
      ${summarySection("Main languages", summary.mainLanguages.map(([language, count]) => `${language} (${count})`))}
      ${summarySection("Entry files", summary.entryFiles)}
      ${summarySection("Important folders", summary.importantFolders)}
      ${summarySection("Dependencies", summary.dependencies)}
      ${summarySection("Pipeline flow", summary.pipelineFlow)}
      ${summarySection("Security hotspots", summary.securityHotspots)}
      ${summarySection("Missing useful files", summary.missing)}
      ${summarySection("Suggestions", summary.suggestions)}
    </div>
  `;
  refs.architecturePanel.hidden = !(state.graphMode === "project" && ["architecture", "pipeline", "critical", "dependencies", "security"].includes(state.viewMode));
}

function summarySection(title, items) {
  const values = items && items.length ? items.slice(0, 10) : ["None detected"];
  return `
    <section>
      <h3>${escapeHtml(title)}</h3>
      <ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function downloadScreenshot() {
  const canvas = refs.graph.querySelector("canvas");
  if (!canvas) {
    setStatus("There is no graph to capture yet.", "error");
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `repogalaxy-${state.username || "graph"}.png`;
    link.click();
    setStatus("Screenshot saved from the current graph view.");
  } catch (error) {
    console.error(error);
    setStatus("Screenshot failed. Try again after the graph finishes rendering.", "error");
  }
}

function openSettings() {
  updateTokenInput();
  if (typeof refs.settingsDialog.showModal === "function") {
    refs.settingsDialog.showModal();
  } else {
    refs.settingsDialog.setAttribute("open", "");
  }
}

function saveToken() {
  const token = refs.tokenInput.value.trim();
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    setStatus("Token saved locally. Future GitHub requests will use the higher authenticated limit.");
  } else {
    localStorage.removeItem(TOKEN_KEY);
    setStatus("Token cleared. RepoGalaxy will use the unauthenticated GitHub API limit.");
  }
  refs.settingsDialog.close();
}

function clearToken() {
  refs.tokenInput.value = "";
  localStorage.removeItem(TOKEN_KEY);
  setStatus("Token cleared. RepoGalaxy will use the unauthenticated GitHub API limit.");
  refs.settingsDialog.close();
}

function updateTokenInput() {
  refs.tokenInput.value = getStoredToken();
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(THEME_KEY, state.theme);
  if (state.graph) {
    state.graph.backgroundColor(getGraphBackground());
    applyFilters();
  }
}

function installRenderFrameCap() {
  if (state.rafCapInstalled || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    if (uncappedRafCallbacks.has(callback)) {
      uncappedRafCallbacks.delete(callback);
      return nativeRequestAnimationFrame(callback);
    }

    return scheduleGraphFrame(callback);
  };
  state.rafCapInstalled = true;
}

function scheduleGraphFrame(callback) {
  return nativeRequestAnimationFrame((now) => {
    if (!state.targetFPS) {
      state.lastGraphRenderTime = now;
      state.graphFrameCount += 1;
      callback(now);
      return;
    }

    const interval = 1000 / state.targetFPS;
    if (now - state.lastGraphRenderTime >= interval - 0.5) {
      state.lastGraphRenderTime = now;
      state.graphFrameCount += 1;
      callback(now);
    } else {
      scheduleGraphFrame(callback);
    }
  });
}

function requestUtilityFrame(callback) {
  if (!nativeRequestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }
  uncappedRafCallbacks.add(callback);
  return nativeRequestAnimationFrame(callback);
}

function startPerformancePanel() {
  detectRefreshRate((hz) => {
    state.detectedRefreshRate = hz;
    refs.refreshRateLabel.textContent = `${hz}Hz`;
    updateFpsWarning();
  });
  startFpsCounter();
  setFpsCap("max");
  updatePerformanceBottleneck();
}

function detectRefreshRate(callback) {
  let frames = 0;
  const start = performance.now();

  function tick() {
    frames += 1;
    const elapsed = performance.now() - start;
    if (elapsed < 1000) {
      requestUtilityFrame(tick);
      return;
    }

    const measured = Math.round((frames * 1000) / elapsed);
    const common = [60, 75, 90, 120, 144, 165, 240];
    const closest = common.reduce((a, b) =>
      Math.abs(b - measured) < Math.abs(a - measured) ? b : a
    );
    callback(closest);
  }

  requestUtilityFrame(tick);
}

function startFpsCounter() {
  let displayFrames = 0;
  let lastFpsUpdate = performance.now();

  function fpsTick() {
    displayFrames += 1;
    const now = performance.now();
    if (now - lastFpsUpdate >= 500) {
      state.displayFps = Math.round((displayFrames * 1000) / (now - lastFpsUpdate));
      state.graphFps = Math.round((state.graphFrameCount * 1000) / (now - lastFpsUpdate));
      refs.fpsLabel.textContent = `${state.displayFps}`;
      refs.graphFpsLabel.textContent = `${state.graphFps}`;
      displayFrames = 0;
      state.graphFrameCount = 0;
      lastFpsUpdate = now;
    }
    requestUtilityFrame(fpsTick);
  }

  requestUtilityFrame(fpsTick);
}

function setFpsCap(cap) {
  state.targetFPS = cap === "max" ? null : Number(cap);
  state.lastGraphRenderTime = 0;
  refs.fpsCapButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.fpsCap === cap);
  });
  updateFpsWarning();
}

function updateFpsWarning() {
  if (!state.detectedRefreshRate || !state.targetFPS || state.detectedRefreshRate >= state.targetFPS) {
    refs.fpsWarning.hidden = true;
    refs.fpsWarning.textContent = "";
    return;
  }

  refs.fpsWarning.hidden = false;
  refs.fpsWarning.textContent =
    `Your display maxes out at ${state.detectedRefreshRate}Hz. Higher caps will not look faster.`;
}

function applyRendererPixelRatio() {
  if (!state.graph || typeof state.graph.renderer !== "function") {
    return;
  }

  const renderer = state.graph.renderer();
  if (renderer && typeof renderer.setPixelRatio === "function") {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }
}

function updatePerformanceBottleneck() {
  if (!refs.performanceNote) {
    return;
  }

  const nodes = state.filteredGraphData.nodes.length;
  const links = state.filteredGraphData.links.length;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

  if (!nodes) {
    refs.performanceNote.textContent = "Bottleneck: waiting for graph data.";
    return;
  }

  if (links > nodes * 8) {
    refs.performanceNote.textContent =
      `Bottleneck: ${formatNumber(links)} links. Use star filter or link mode to reduce draw work.`;
    return;
  }

  if (nodes > 180) {
    refs.performanceNote.textContent =
      `Bottleneck: ${formatNumber(nodes)} nodes. Low-poly spheres and cached geometry are active.`;
    return;
  }

  if ((window.devicePixelRatio || 1) > 1.5) {
    refs.performanceNote.textContent =
      `Bottleneck avoided: device pixel ratio capped at ${pixelRatio}.`;
    return;
  }

  refs.performanceNote.textContent = "Bottleneck: physics while cooling. Layout stops after 100 ticks.";
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  state.theme = savedTheme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
}

function setLoading(isLoading) {
  refs.loadingSpinner.hidden = !isLoading;
  refs.visualizeButton.disabled = isLoading;
  refs.usernameInput.disabled = isLoading;
}

function setStatus(message, kind = "info") {
  refs.statusText.textContent = message;
  refs.statusText.style.color = kind === "error" ? "var(--danger)" : "var(--text)";
}

function updateRateLimitFromResponse(response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const limit = response.headers.get("x-ratelimit-limit");
  const reset = response.headers.get("x-ratelimit-reset");

  if (remaining === null || limit === null) {
    return;
  }

  state.rateLimit = { remaining, limit, reset };
  const resetText = reset ? ` resets ${formatResetTime(reset)}` : "";
  refs.rateLimitText.textContent = `API ${remaining}/${limit}${resetText}`;
}

function resizeGraph() {
  if (!state.graph) {
    return;
  }
  const rect = refs.graph.getBoundingClientRect();
  state.graph.width(Math.max(320, rect.width));
  state.graph.height(Math.max(320, rect.height));
  applyRendererPixelRatio();
}

function getGraphBackground() {
  return getComputedStyle(document.documentElement).getPropertyValue("--graph-bg").trim() || "#050609";
}

function getLanguageColor(language) {
  if (LANGUAGE_COLORS[language]) {
    return LANGUAGE_COLORS[language];
  }
  return hashToColor(language || "Unknown");
}

function hashToColor(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 68%, 57%)`;
}

function scaleStarsToSize(stars) {
  return Math.max(4, Math.min(22, 4 + Math.log2(stars + 1) * 2.4));
}

function mutedNodeColor() {
  return state.theme === "light" ? "#b8c0cc" : "#465060";
}

function mutedLinkColor() {
  return state.theme === "light" ? "#9ca8b8" : "#4f5b6b";
}

function isValidGitHubUsername(value) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatResetTime(epochSeconds) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(Number(epochSeconds) * 1000));
}

function debounce(callback, wait) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}
