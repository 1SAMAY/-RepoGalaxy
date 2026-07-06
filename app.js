"use strict";

const API_ROOT = "https://api.github.com";
const TOKEN_KEY = "repogalaxy:github-token";
const THEME_KEY = "repogalaxy:theme";
const LAST_USERNAME_KEY = "repogalaxy:last-username";

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
  repos: [],
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
    .onNodeClick((node) => {
      if (node.url) {
        window.open(node.url, "_blank", "noopener,noreferrer");
      }
    })
    .onBackgroundClick(() => showRepoPanel(null));

  applyRendererPixelRatio();
  resizeGraph();
  state.graph.graphData({ nodes: [], links: [] });
}

async function handleSubmit(event) {
  event.preventDefault();
  const username = refs.usernameInput.value.trim();

  if (!username) {
    setStatus("Enter a GitHub username first.", "error");
    refs.usernameInput.focus();
    return;
  }

  if (!isValidGitHubUsername(username)) {
    setStatus("GitHub usernames use letters, numbers, and single hyphens only.", "error");
    return;
  }

  await loadUser(username);
}

async function loadUser(username) {
  setLoading(true);
  setStatus(`Fetching public repositories for ${username}...`);
  showRepoPanel(null);

  try {
    const repos = await fetchUserRepos(username);
    state.username = username;
    state.repos = repos;
    localStorage.setItem(LAST_USERNAME_KEY, username);

    state.baseGraphData = buildGraphData(repos);
    state.minStars = 0;
    refs.minStarsRange.value = "0";
    refs.minStarsValue.textContent = "0";
    configureStarsRange(repos);
    renderLegend(state.baseGraphData.nodes);
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

function addToBucket(map, key, nodeId) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(nodeId);
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
  renderStats();
  renderLegend(displayNodes);
  updatePerformanceBottleneck();
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
  refs.repoCount.textContent = formatNumber(state.baseGraphData.nodes.length);
  refs.linkCount.textContent = formatNumber(state.baseGraphData.links.length);
  refs.visibleCount.textContent = formatNumber(state.filteredGraphData.nodes.length);
}

function renderEmptyState(show, title = "Enter a username above to begin", message = "Repo nodes connect when they share a primary language or topic.") {
  refs.emptyState.hidden = !show;
  refs.emptyState.querySelector("h2").textContent = title;
  refs.emptyState.querySelector("p").textContent = message;
}

function resetGraph() {
  state.repos = [];
  state.baseGraphData = { nodes: [], links: [] };
  state.filteredGraphData = { nodes: [], links: [] };
  if (state.graph) {
    state.graph.graphData(state.filteredGraphData);
  }
  refs.legendPanel.hidden = true;
  refs.legendList.innerHTML = "";
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

function showRepoPanel(node) {
  if (!node) {
    refs.repoPanel.hidden = true;
    refs.repoPanel.innerHTML = "";
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

function repoTooltipHtml(node) {
  return `
    <div class="graph-tooltip">
      <strong>${escapeHtml(node.label)}</strong>
      <span>${escapeHtml(node.language)} - ${formatNumber(node.stars)} stars - ${formatNumber(node.forks)} forks</span>
      <span>${escapeHtml(node.description || "No description provided.")}</span>
    </div>
  `;
}

function linkTooltipHtml(link) {
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
