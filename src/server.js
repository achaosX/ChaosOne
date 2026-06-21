import { createServer } from "node:http";
import { readFile, mkdir, writeFile, unlink, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const webRoot = join(root, "web");
const dataRoot = join(root, "data");
const configPath = join(dataRoot, "config.json");
const chatsPath = join(dataRoot, "chats.json");
const commandHistoryPath = join(dataRoot, "command-history.json");
const importedIdentityPath = join(dataRoot, "openclaw-identity.json");
const personalityPath = join(root, "config", "personality.json");
const modelsRegistryPath = join(root, "config", "models-registry.json");
const packagePath = join(root, "package.json");
const openClawWorkspace = join(process.env.USERPROFILE || "", ".openclaw", "workspace");
const appDataRoot = join(process.env.APPDATA || dataRoot, "ChaosOne");
const secretsRoot = join(appDataRoot, "secrets");
const openAiKeyPath = join(secretsRoot, "openai-key.dpapi");
const port = Number(process.env.CHAOSONE_PORT || process.env.NOVAOS_PORT || 4788);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const providerEnv = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  "mistral-cloud": "MISTRAL_API_KEY"
};

const recommendedLocalModels = [
  {
    id: "tinyllama",
    name: "Chaos Local Mini",
    description: "Modelo pequeno para primer arranque en equipos modestos.",
    downloadUrl: "https://ollama.com/library/tinyllama"
  },
  {
    id: "qwen2.5:0.5b",
    name: "Chaos Local Ligero",
    description: "Modelo muy pequeno, multilingue y rapido.",
    downloadUrl: "https://ollama.com/library/qwen2.5:0.5b"
  },
  {
    id: "llama3.2:1b",
    name: "Chaos Local Base",
    description: "Modelo pequeno de Llama para dialogo general.",
    downloadUrl: "https://ollama.com/library/llama3.2:1b"
  },
  {
    id: "llama3.2:3b",
    name: "Chaos Local Equilibrado",
    description: "Mas calidad si el equipo tiene memoria suficiente.",
    downloadUrl: "https://ollama.com/library/llama3.2:3b"
  },
  {
    id: "qwen2.5-coder:3b",
    name: "Chaos Local Codigo",
    description: "Opcion enfocada a programacion y lectura de proyectos.",
    downloadUrl: "https://ollama.com/library/qwen2.5-coder"
  }
];

const localModelJobs = new Map();

const defaultPermissions = {
  readAttachedDocuments: true,
  fetchUrls: true,
  useCloudProviders: false,
  importOpenClawIdentity: true,
  saveApiKeys: true,
  executeProcesses: false,
  readWorkspaceFiles: true,
  writeWorkspaceFiles: false,
  allowedProjectRoots: [root],
  commandTimeoutMs: 15000
};

async function ensureConfig() {
  await mkdir(dataRoot, { recursive: true });
  await mkdir(secretsRoot, { recursive: true });
  if (!existsSync(configPath)) {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          provider: "ollama",
          model: "tinyllama",
          apiKeyEnv: "OPENAI_API_KEY",
          createdAt: new Date().toISOString()
        },
        null,
        2
      )
    );
  }
  const config = await readJson(configPath);
  if (!config.permissions) {
    await writeJson(configPath, {
      ...config,
      permissions: defaultPermissions,
      updatedAt: new Date().toISOString()
    });
  }
  if (!existsSync(chatsPath)) {
    await writeFile(chatsPath, JSON.stringify({ activeChatId: null, chats: [] }, null, 2));
  }
  if (!existsSync(commandHistoryPath)) {
    await writeFile(commandHistoryPath, JSON.stringify({ commands: [] }, null, 2));
  }
}

async function readJson(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2));
}

function runPowerShell(script, input = "") {
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { input, encoding: "utf8", windowsHide: true }
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || "PowerShell command failed").trim());
  }

  return result.stdout.trim();
}

function readPermissions(config) {
  const permissions = { ...defaultPermissions, ...(config.permissions || {}) };
  permissions.allowedProjectRoots = Array.isArray(permissions.allowedProjectRoots) && permissions.allowedProjectRoots.length
    ? permissions.allowedProjectRoots
    : [root];
  return permissions;
}

function commandLooksDangerous(command) {
  return /\b(remove-item|rm|rmdir|del|erase|format|diskpart|shutdown|restart-computer|stop-computer)\b/i.test(command);
}

function clipCommandOutput(text, limit = 12000) {
  const value = String(text || "");
  return value.length > limit ? `${value.slice(0, limit)}\n[truncated]` : value;
}

function commandRisk(command) {
  if (commandLooksDangerous(command)) return "blocked";
  if (/\b(npm|node|powershell|pwsh|winget|git|python|pip|start-process)\b/i.test(command)) return "elevated";
  return "normal";
}

async function readCommandHistory() {
  if (!existsSync(commandHistoryPath)) {
    await writeJson(commandHistoryPath, { commands: [] });
  }
  const history = await readJson(commandHistoryPath);
  return { commands: Array.isArray(history.commands) ? history.commands : [] };
}

async function appendCommandHistory(record) {
  const history = await readCommandHistory();
  history.commands.unshift(record);
  history.commands = history.commands.slice(0, 80);
  await writeJson(commandHistoryPath, history);
  return record;
}

async function clearCommandHistory() {
  const history = { commands: [] };
  await writeJson(commandHistoryPath, history);
  return history;
}

function runUserCommand(command, timeoutMs = defaultPermissions.commandTimeoutMs) {
  if (!command || typeof command !== "string" || !command.trim()) {
    throw new Error("Comando vacio");
  }
  if (commandLooksDangerous(command)) {
    throw new Error("Comando bloqueado por seguridad en este MVP");
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: root,
      encoding: "utf8",
      timeout: Math.min(Math.max(Number(timeoutMs) || defaultPermissions.commandTimeoutMs, 1000), 60000),
      windowsHide: true
    }
  );

  return {
    id: makeId("cmd"),
    command,
    exitCode: result.status,
    stdout: clipCommandOutput(result.stdout),
    stderr: clipCommandOutput(result.stderr),
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
    risk: commandRisk(command),
    startedAt,
    durationMs: Date.now() - started
  };
}

async function saveOpenAiKey(apiKey) {
  const encrypted = runPowerShell(
    "$plain = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $plain -AsPlainText -Force; ConvertFrom-SecureString $secure",
    apiKey
  );
  await mkdir(secretsRoot, { recursive: true });
  await writeFile(openAiKeyPath, encrypted, "utf8");
}

async function readSavedOpenAiKey() {
  if (!existsSync(openAiKeyPath)) return null;
  const encrypted = await readFile(openAiKeyPath, "utf8");
  return runPowerShell(
    "$encrypted = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $encrypted; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringUni($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }",
    encrypted
  );
}

function safeProviderId(providerId) {
  return String(providerId || "").replace(/[^a-z0-9-]/gi, "");
}

function secretPathForProvider(providerId) {
  const safeId = safeProviderId(providerId);
  return safeId === "openai" ? openAiKeyPath : join(secretsRoot, `${safeId}-key.dpapi`);
}

function apiKeyEnvForProvider(config, providerId = config.provider) {
  if (providerId === "openai") return config.apiKeyEnv || providerEnv.openai;
  return config.apiKeyEnvs?.[providerId] || providerEnv[providerId] || "";
}

async function saveProviderKey(providerId, apiKey) {
  if (providerId === "openai") {
    await saveOpenAiKey(apiKey);
    return;
  }

  const encrypted = runPowerShell(
    "$plain = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $plain -AsPlainText -Force; ConvertFrom-SecureString $secure",
    apiKey
  );
  await mkdir(secretsRoot, { recursive: true });
  await writeFile(secretPathForProvider(providerId), encrypted, "utf8");
}

async function readSavedProviderKey(providerId) {
  if (providerId === "openai") return readSavedOpenAiKey();
  const path = secretPathForProvider(providerId);
  if (!existsSync(path)) return null;
  const encrypted = await readFile(path, "utf8");
  return runPowerShell(
    "$encrypted = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $encrypted; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringUni($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }",
    encrypted
  );
}

async function getConfiguredApiKey(config, providerId = config.provider) {
  const env = apiKeyEnvForProvider(config, providerId);
  return (env ? process.env[env] : null) || (await readSavedProviderKey(providerId));
}

function hasSavedProviderKey(providerId) {
  return existsSync(secretPathForProvider(providerId));
}

function isLocalProvider(config) {
  return config.provider === "mock" || config.provider === "ollama";
}

function localBaseUrl(config) {
  return config.localBaseUrl || "http://localhost:11434";
}

async function getLocalRuntimeStatus(config) {
  const baseUrl = localBaseUrl(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  let reachable = false;
  let models = [];
  let error = null;

  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Runtime ${response.status}`);
    const data = await response.json();
    reachable = true;
    models = Array.isArray(data.models) ? data.models.map((model) => model.name).filter(Boolean) : [];
  } catch (runtimeError) {
    error = runtimeError.name === "AbortError" ? "El runtime local no responde" : runtimeError.message;
  } finally {
    clearTimeout(timeout);
  }

  const command = spawnSync("ollama", ["--version"], {
    encoding: "utf8",
    timeout: 3000,
    windowsHide: true
  });
  const commandAvailable = command.status === 0;
  const activeModel = config.model || "tinyllama";

  return {
    baseUrl,
    reachable,
    commandAvailable,
    commandVersion: commandAvailable ? (command.stdout || "").trim() : null,
    activeModel,
    hasActiveModel: models.includes(activeModel),
    models,
    recommendedModels: recommendedLocalModels,
    error
  };
}

function assertRecommendedLocalModel(model) {
  if (!recommendedLocalModels.some((item) => item.id === model)) {
    throw new Error("Modelo no permitido en este instalador MVP");
  }
}

function publicLocalModelJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    model: job.model,
    status: job.status,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
    stdout: clipCommandOutput(job.stdout || "", 20000),
    stderr: clipCommandOutput(job.stderr || "", 12000),
    error: job.error || null
  };
}

function startLocalModelPull(model) {
  const id = makeId("model");
  const job = {
    id,
    model,
    status: "running",
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stdout: "",
    stderr: "",
    error: null
  };
  localModelJobs.set(id, job);

  const child = spawn("ollama", ["pull", model], {
    cwd: root,
    windowsHide: true
  });

  child.stdout.on("data", (chunk) => {
    job.stdout = clipCommandOutput(`${job.stdout}${chunk.toString()}`, 30000);
  });

  child.stderr.on("data", (chunk) => {
    job.stderr = clipCommandOutput(`${job.stderr}${chunk.toString()}`, 30000);
  });

  child.on("error", (error) => {
    job.status = "error";
    job.error = error.code === "ENOENT" ? "Ollama no esta instalado o no esta en PATH" : error.message;
    job.finishedAt = new Date().toISOString();
  });

  child.on("close", async (code) => {
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    if (job.status === "error") return;

    if (code === 0) {
      job.status = "done";
      try {
        const current = await readJson(configPath);
        await writeJson(configPath, {
          ...current,
          provider: "ollama",
          model,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        job.status = "error";
        job.error = `Modelo descargado, pero no pude guardar configuracion: ${error.message}`;
      }
    } else {
      job.status = "error";
      job.error = "No se pudo descargar el modelo";
    }
  });

  return publicLocalModelJob(job);
}

async function getProvider(config) {
  const registry = await readJson(modelsRegistryPath);
  return registry.providers.find((provider) => provider.id === config.provider) || null;
}

async function readTextIfExists(path) {
  if (!existsSync(path)) return null;
  return readFile(path, "utf8");
}

async function getOpenClawIdentity() {
  const files = [
    ["soul", "SOUL.md"],
    ["identity", "IDENTITY.md"],
    ["user", "USER.md"],
    ["memory", "MEMORY.md"]
  ];

  const entries = await Promise.all(
    files.map(async ([key, file]) => {
      const path = join(openClawWorkspace, file);
      return [key, { file, path, exists: existsSync(path), content: await readTextIfExists(path) }];
    })
  );

  return {
    source: openClawWorkspace,
    importedAt: null,
    files: Object.fromEntries(entries)
  };
}

function clip(text, limit = 6000) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}\n[truncated]` : text;
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUserContent(message, contextItems = []) {
  const items = Array.isArray(contextItems) ? contextItems.filter((item) => item?.content) : [];
  if (!items.length) return message;

  const context = items
    .slice(0, 8)
    .map((item, index) => {
      const title = item.title || item.name || item.url || `Contexto ${index + 1}`;
      const kind = item.kind || "texto";
      return `### ${kind}: ${title}\n${clip(item.content, 5000)}`;
    })
    .join("\n\n");

  return `${message}\n\n[Contexto adjunto]\n${context}`;
}

async function listProjectFiles(dir, rootDir = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await listProjectFiles(path, rootDir, acc);
    } else {
      const info = await stat(path);
      acc.push({
        path: path.replace(rootDir, "").replace(/^[/\\]/, ""),
        size: info.size,
        updatedAt: info.mtime.toISOString()
      });
    }
  }
  return acc;
}

function resolveAllowedProjectPath(relativePath, permissions) {
  const allowedRoots = (permissions.allowedProjectRoots || [root])
    .map((item) => normalize(String(item || "")))
    .map((item) => item.replace(/[\\/]+$/, ""))
    .filter(Boolean);
  const projectRoot = allowedRoots[0] || root;
  const normalizedRoot = normalize(projectRoot);
  const requested = normalize(join(normalizedRoot, String(relativePath || "")));

  if (requested !== normalizedRoot && !requested.startsWith(`${normalizedRoot}\\`) && !requested.startsWith(`${normalizedRoot}/`)) {
    throw new Error("Ruta fuera del proyecto permitido");
  }

  return { projectRoot: normalizedRoot, filePath: requested };
}

function isBlockedProjectFile(relativePath) {
  const value = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
  return (
    value.includes("/node_modules/") ||
    value.includes("/.git/") ||
    value.endsWith(".dpapi") ||
    value.endsWith(".exe") ||
    value.endsWith(".dll") ||
    value.endsWith(".png") ||
    value.endsWith(".jpg") ||
    value.endsWith(".jpeg") ||
    value.endsWith(".ico") ||
    value.endsWith(".psd")
  );
}

async function readProjectFile(relativePath, permissions) {
  if (isBlockedProjectFile(relativePath)) {
    throw new Error("Este tipo de archivo no se abre desde el editor MVP");
  }
  const { projectRoot, filePath } = resolveAllowedProjectPath(relativePath, permissions);
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("La ruta no apunta a un archivo");
  if (info.size > 1024 * 1024) throw new Error("Archivo demasiado grande para el editor MVP");
  const content = await readFile(filePath, "utf8");
  return {
    path: filePath.replace(projectRoot, "").replace(/^[/\\]/, ""),
    size: info.size,
    updatedAt: info.mtime.toISOString(),
    content
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessage(message) {
  const title = String(message || "Nuevo chat").replace(/\s+/g, " ").trim();
  return title.length > 52 ? `${title.slice(0, 49)}...` : title || "Nuevo chat";
}

function getDisplayNameFromIdentity(identity) {
  const userContent = identity?.files?.user?.content || "";
  const match =
    userContent.match(/\*\*What to call them:\*\*\s*([^\r\n]+)/i) ||
    userContent.match(/\*\*Name:\*\*\s*([^\r\n]+)/i);
  return match?.[1]?.trim() || process.env.USERNAME || "Usuario";
}

async function getProfile() {
  const identity = existsSync(importedIdentityPath)
    ? await readJson(importedIdentityPath)
    : await getOpenClawIdentity();
  const displayName = getDisplayNameFromIdentity(identity);
  return {
    displayName,
    windowsUser: process.env.USERNAME || null,
    initial: displayName.slice(0, 1).toUpperCase() || "N"
  };
}

async function readChats() {
  if (!existsSync(chatsPath)) {
    await writeJson(chatsPath, { activeChatId: null, chats: [] });
  }
  return readJson(chatsPath);
}

async function createChat(firstMessage = "") {
  const store = await readChats();
  const now = new Date().toISOString();
  const chat = {
    id: makeId("chat"),
    title: firstMessage ? titleFromMessage(firstMessage) : "Nuevo chat",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  store.activeChatId = chat.id;
  store.chats.unshift(chat);
  await writeJson(chatsPath, store);
  return { store, chat };
}

async function deleteChat(id) {
  const store = await readChats();
  const before = store.chats.length;
  store.chats = store.chats.filter((chat) => chat.id !== id);

  if (store.activeChatId === id) {
    store.activeChatId = store.chats[0]?.id || null;
  }

  await writeJson(chatsPath, store);
  return { deleted: store.chats.length !== before, store };
}

async function deleteAllChats() {
  const store = { activeChatId: null, chats: [] };
  await writeJson(chatsPath, store);
  return store;
}

async function getOrCreateActiveChat(firstMessage = "", requestedId = null) {
  const store = await readChats();
  let chat = requestedId ? store.chats.find((item) => item.id === requestedId) : null;
  chat ||= store.chats.find((item) => item.id === store.activeChatId);

  if (!chat) {
    const created = await createChat(firstMessage);
    return created;
  }

  store.activeChatId = chat.id;
  if (firstMessage && chat.messages.length === 0) {
    chat.title = titleFromMessage(firstMessage);
  }
  return { store, chat };
}

function publicChats(store) {
  return {
    activeChatId: store.activeChatId,
    chats: store.chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messages.length
    }))
  };
}

async function buildSystemPrompt(personality) {
  const parts = [
    `You are ${personality.name}.`,
    personality.shortDescription,
    `Tone: ${personality.tone}.`,
    `Product: ${personality.productName}.`
  ];

  if (existsSync(importedIdentityPath)) {
    const imported = await readJson(importedIdentityPath);
    const files = imported.files || {};
    parts.push("Imported OpenClaw identity follows. Use it to preserve voice, preferences and working style.");
    for (const key of ["identity", "soul", "user"]) {
      if (files[key]?.content) {
        parts.push(`--- ${files[key].file} ---\n${clip(files[key].content)}`);
      }
    }
    if (files.memory?.exists) {
      parts.push("MEMORY.md exists and is imported, but do not expose private memory unless it is relevant to the user's request.");
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function responseTextFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function callOpenAi({ apiKey, config, systemPrompt, chat }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        ...chat.messages.slice(-10).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content
        }))
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json();
  return data.output_text || "He recibido respuesta, pero no venia texto legible.";
}

async function callAnthropic({ apiKey, config, systemPrompt, chat }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: chat.messages.slice(-10).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }))
    })
  });

  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  const data = await response.json();
  return responseTextFromContent(data.content) || "Claude respondio, pero no venia texto legible.";
}

async function callGemini({ apiKey, config, systemPrompt, chat }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: chat.messages.slice(-10).map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }]
        }))
      })
    }
  );

  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const data = await response.json();
  return responseTextFromContent(data.candidates?.[0]?.content?.parts) || "Gemini respondio, pero no venia texto legible.";
}

async function callMistral({ apiKey, config, systemPrompt, chat }) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...chat.messages.slice(-10).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content
        }))
      ]
    })
  });

  if (!response.ok) throw new Error(`Mistral ${response.status}`);
  const data = await response.json();
  return responseTextFromContent(data.choices?.[0]?.message?.content) || "Mistral respondio, pero no venia texto legible.";
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/status") {
    const config = await readJson(configPath);
    const packageInfo = await readJson(packagePath);
    const hasSavedKey = hasSavedProviderKey(config.provider);
    const localProvider = isLocalProvider(config);
    const provider = await getProvider(config);
    const apiKeyEnv = apiKeyEnvForProvider(config);
    sendJson(res, 200, {
      ok: true,
      name: "ChaosOne",
      version: packageInfo.version || "0.0.0",
      port,
      provider: config.provider,
      providerName: provider?.name || config.provider,
      privacyMode: provider?.mode || (localProvider ? "local" : "cloud"),
      model: config.model,
      hasApiKey: localProvider || Boolean(apiKeyEnv && process.env[apiKeyEnv]) || hasSavedKey,
      apiKeySource: localProvider
        ? "local-provider"
        : apiKeyEnv && process.env[apiKeyEnv]
          ? "environment"
          : hasSavedKey
            ? "encrypted-local"
            : null,
      apiKeyEnv,
      permissions: readPermissions(config),
      hasImportedIdentity: existsSync(importedIdentityPath)
    });
    return;
  }

  if (url.pathname === "/api/providers" && req.method === "GET") {
    const config = await readJson(configPath);
    sendJson(res, 200, {
      activeProvider: config.provider,
      activeModel: config.model,
      localBaseUrl: localBaseUrl(config),
      ...(await readJson(modelsRegistryPath))
    });
    return;
  }

  if (url.pathname === "/api/local-runtime/status" && req.method === "GET") {
    const config = await readJson(configPath);
    sendJson(res, 200, await getLocalRuntimeStatus(config));
    return;
  }

  if (url.pathname.startsWith("/api/local-runtime/jobs/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.replace("/api/local-runtime/jobs/", ""));
    const job = publicLocalModelJob(localModelJobs.get(id));
    if (!job) {
      sendJson(res, 404, { error: "Job no encontrado" });
      return;
    }
    sendJson(res, 200, job);
    return;
  }

  if (url.pathname === "/api/local-runtime/pull" && req.method === "POST") {
    const { model, approved } = await readBody(req);
    if (!approved) {
      sendJson(res, 428, { error: "Descargar un modelo local necesita aprobacion explicita" });
      return;
    }

    try {
      assertRecommendedLocalModel(model);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }

    sendJson(res, 202, startLocalModelPull(model));
    return;
  }

  if (url.pathname === "/api/personality") {
    sendJson(res, 200, await readJson(personalityPath));
    return;
  }

  if (url.pathname === "/api/profile") {
    sendJson(res, 200, await getProfile());
    return;
  }

  if (url.pathname === "/api/chats" && req.method === "GET") {
    sendJson(res, 200, publicChats(await readChats()));
    return;
  }

  if (url.pathname === "/api/chats" && req.method === "POST") {
    const { chat } = await createChat();
    sendJson(res, 200, chat);
    return;
  }

  if (url.pathname === "/api/chats" && req.method === "DELETE") {
    sendJson(res, 200, publicChats(await deleteAllChats()));
    return;
  }

  if (url.pathname.startsWith("/api/chats/") && req.method === "GET") {
    const id = decodeURIComponent(url.pathname.replace("/api/chats/", ""));
    const store = await readChats();
    const chat = store.chats.find((item) => item.id === id);
    if (!chat) {
      sendJson(res, 404, { error: "Chat not found" });
      return;
    }
    store.activeChatId = chat.id;
    await writeJson(chatsPath, store);
    sendJson(res, 200, chat);
    return;
  }

  if (url.pathname.startsWith("/api/chats/") && req.method === "DELETE") {
    const id = decodeURIComponent(url.pathname.replace("/api/chats/", ""));
    const { deleted, store } = await deleteChat(id);
    sendJson(res, deleted ? 200 : 404, deleted ? publicChats(store) : { error: "Chat not found" });
    return;
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, await readJson(configPath));
    return;
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const current = await readJson(configPath);
    const body = await readBody(req);
    const next = {
      ...current,
      ...body,
      apiKeyEnvs: { ...(current.apiKeyEnvs || {}), ...(body.apiKeyEnvs || {}) },
      updatedAt: new Date().toISOString()
    };
    await writeFile(configPath, JSON.stringify(next, null, 2));
    sendJson(res, 200, next);
    return;
  }

  if (url.pathname === "/api/permissions" && req.method === "GET") {
    const config = await readJson(configPath);
    sendJson(res, 200, readPermissions(config));
    return;
  }

  if (url.pathname === "/api/permissions" && req.method === "POST") {
    const current = await readJson(configPath);
    const body = await readBody(req);
    const nextPermissions = {
      ...readPermissions(current),
      ...body
    };
    const next = {
      ...current,
      permissions: nextPermissions,
      updatedAt: new Date().toISOString()
    };
    await writeJson(configPath, next);
    sendJson(res, 200, nextPermissions);
    return;
  }

  if (url.pathname === "/api/secrets/status" && req.method === "GET") {
    const config = await readJson(configPath);
    const providerId = url.searchParams.get("provider") || config.provider;
    const hasSavedKey = hasSavedProviderKey(providerId);
    const localProvider = isLocalProvider(config);
    const apiKeyEnv = apiKeyEnvForProvider(config, providerId);
    sendJson(res, 200, {
      provider: providerId,
      hasApiKey: localProvider || Boolean(apiKeyEnv && process.env[apiKeyEnv]) || hasSavedKey,
      source: localProvider
        ? "local-provider"
        : apiKeyEnv && process.env[apiKeyEnv]
          ? "environment"
          : hasSavedKey
            ? "encrypted-local"
            : null,
      apiKeyEnv
    });
    return;
  }

  if ((url.pathname === "/api/secrets/openai-key" || url.pathname.startsWith("/api/secrets/")) && req.method === "POST") {
    const config = await readJson(configPath);
    if (!readPermissions(config).saveApiKeys) {
      sendJson(res, 403, { error: "Guardar claves esta desactivado en Permisos" });
      return;
    }
    const providerId = url.pathname === "/api/secrets/openai-key"
      ? "openai"
      : safeProviderId(url.pathname.replace("/api/secrets/", "").replace(/-key$/, ""));
    const { apiKey } = await readBody(req);
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      sendJson(res, 400, { error: "Missing apiKey" });
      return;
    }

    await saveProviderKey(providerId, apiKey.trim());
    sendJson(res, 200, { saved: true, provider: providerId, source: "encrypted-local" });
    return;
  }

  if ((url.pathname === "/api/secrets/openai-key" || url.pathname.startsWith("/api/secrets/")) && req.method === "DELETE") {
    const providerId = url.pathname === "/api/secrets/openai-key"
      ? "openai"
      : safeProviderId(url.pathname.replace("/api/secrets/", "").replace(/-key$/, ""));
    const path = secretPathForProvider(providerId);
    if (existsSync(path)) await unlink(path);
    sendJson(res, 200, { deleted: true, provider: providerId });
    return;
  }

  if (url.pathname === "/api/context/url" && req.method === "POST") {
    const config = await readJson(configPath);
    if (!readPermissions(config).fetchUrls) {
      sendJson(res, 403, { error: "Leer URLs esta desactivado en Permisos" });
      return;
    }
    const { targetUrl } = await readBody(req);
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      sendJson(res, 400, { error: "URL no valida" });
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      sendJson(res, 400, { error: "Solo se aceptan URLs http/https" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(parsed, {
        signal: controller.signal,
        headers: { "user-agent": "ChaosOne/0.1 local context fetcher" }
      });
    } catch (error) {
      sendJson(res, 502, { error: error.name === "AbortError" ? "La URL tardo demasiado en responder" : error.message });
      return;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      sendJson(res, 502, { error: `No se pudo descargar la URL (${response.status})` });
      return;
    }
    const html = await response.text();
    sendJson(res, 200, {
      kind: "url",
      title: parsed.hostname,
      url: parsed.href,
      content: clip(htmlToText(html), 12000)
    });
    return;
  }

  if (url.pathname === "/api/project/status" && req.method === "GET") {
    const files = await listProjectFiles(root);
    const latest = files
      .map((file) => file.updatedAt)
      .sort()
      .at(-1);
    sendJson(res, 200, {
      name: "ChaosOne MVP",
      root,
      fileCount: files.length,
      updatedAt: latest || null,
      files: files.slice(0, 80)
    });
    return;
  }

  if (url.pathname === "/api/project/file" && req.method === "GET") {
    const config = await readJson(configPath);
    const permissions = readPermissions(config);
    if (!permissions.readWorkspaceFiles) {
      sendJson(res, 403, { error: "Leer archivos del workspace esta desactivado en Permisos" });
      return;
    }
    const relativePath = url.searchParams.get("path") || "";
    try {
      sendJson(res, 200, await readProjectFile(relativePath, permissions));
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/project/file" && req.method === "POST") {
    const config = await readJson(configPath);
    const permissions = readPermissions(config);
    if (!permissions.writeWorkspaceFiles) {
      sendJson(res, 403, { error: "Editar archivos del workspace esta desactivado en Permisos" });
      return;
    }
    const { path, content, approved } = await readBody(req);
    if (!approved) {
      sendJson(res, 428, { error: "Guardar archivos necesita aprobacion explicita" });
      return;
    }
    if (isBlockedProjectFile(path)) {
      sendJson(res, 400, { error: "Este tipo de archivo no se edita desde el editor MVP" });
      return;
    }
    if (typeof content !== "string") {
      sendJson(res, 400, { error: "Contenido no valido" });
      return;
    }
    if (content.length > 1024 * 1024) {
      sendJson(res, 400, { error: "Contenido demasiado grande para el editor MVP" });
      return;
    }
    try {
      const { projectRoot, filePath } = resolveAllowedProjectPath(path, permissions);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
      const info = await stat(filePath);
      sendJson(res, 200, {
        path: filePath.replace(projectRoot, "").replace(/^[/\\]/, ""),
        size: info.size,
        updatedAt: info.mtime.toISOString(),
        saved: true
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/openclaw/identity" && req.method === "GET") {
    if (existsSync(importedIdentityPath)) {
      sendJson(res, 200, { imported: true, ...(await readJson(importedIdentityPath)) });
      return;
    }

    sendJson(res, 200, { imported: false, ...(await getOpenClawIdentity()) });
    return;
  }

  if (url.pathname === "/api/openclaw/import" && req.method === "POST") {
    const config = await readJson(configPath);
    if (!readPermissions(config).importOpenClawIdentity) {
      sendJson(res, 403, { error: "Importar identidad esta desactivado en Permisos" });
      return;
    }
    const identity = await getOpenClawIdentity();
    const next = { ...identity, importedAt: new Date().toISOString() };
    await writeFile(importedIdentityPath, JSON.stringify(next, null, 2));
    sendJson(res, 200, { imported: true, ...next });
    return;
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    const { message, chatId, contextItems = [] } = await readBody(req);
    const config = await readJson(configPath);
    const permissions = readPermissions(config);
    const isMockProvider = config.provider === "mock" || process.env.CHAOSONE_MOCK === "1";
    const isOllamaProvider = config.provider === "ollama";
    const isOpenAiProvider = config.provider === "openai";
    if (!isLocalProvider(config) && !permissions.useCloudProviders) {
      sendJson(res, 403, {
        role: "assistant",
        content: "El uso de proveedores cloud esta desactivado en Permisos. Activalo en Cerebro > Permisos o usa Chaos Local / Demo."
      });
      return;
    }
    if (contextItems.length && !permissions.readAttachedDocuments) {
      sendJson(res, 403, {
        role: "assistant",
        content: "Leer documentos adjuntos esta desactivado en Permisos."
      });
      return;
    }
    const apiKey = isMockProvider || isOllamaProvider ? null : await getConfiguredApiKey(config);
    const userContent = buildUserContent(message, contextItems);
    const { store, chat } = await getOrCreateActiveChat(message, chatId);
    const now = new Date().toISOString();

    chat.messages.push({ role: "user", content: userContent, createdAt: now });
    chat.updatedAt = now;

    if (isMockProvider) {
      const reply = {
        role: "assistant",
        content: `Modo demo activo. He recibido: "${message}". El chat, el historial y el borrado ya funcionan sin consumir creditos.`
      };
      chat.messages.push({ ...reply, createdAt: new Date().toISOString() });
      chat.updatedAt = new Date().toISOString();
      await writeJson(chatsPath, store);
      sendJson(res, 200, { ...reply, chatId: chat.id });
      return;
    }

    if (isOllamaProvider) {
      const personality = await readJson(personalityPath);
      const systemPrompt = await buildSystemPrompt(personality);
      const response = await fetch(`${localBaseUrl(config)}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model || "tinyllama",
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            ...chat.messages.slice(-10).map((item) => ({
              role: item.role === "assistant" ? "assistant" : "user",
              content: item.content
            }))
          ]
        })
      });

      if (!response.ok) {
        sendJson(res, 502, {
          role: "assistant",
          content: `No he podido hablar con el modelo local (${response.status}). Comprueba que Ollama este abierto y que el modelo "${config.model}" este instalado.`
        });
        return;
      }

      const data = await response.json();
      const reply = {
        role: "assistant",
        content: data.message?.content || "El modelo local respondio, pero no devolvio texto legible."
      };
      chat.messages.push({ ...reply, createdAt: new Date().toISOString() });
      chat.updatedAt = new Date().toISOString();
      await writeJson(chatsPath, store);
      sendJson(res, 200, { ...reply, chatId: chat.id });
      return;
    }

    if (!isOpenAiProvider) {
      if (!apiKey) {
        const fallback = {
          role: "assistant",
          content: `Falta configurar la API key de ${config.provider}. Guardala en Cerebro o usa la variable ${apiKeyEnvForProvider(config)}.`
        };
        chat.messages.push({ ...fallback, createdAt: new Date().toISOString() });
        await writeJson(chatsPath, store);
        sendJson(res, 200, { ...fallback, chatId: chat.id });
        return;
      }
    } else if (!apiKey) {
      const fallback = {
        role: "assistant",
        content:
          "Estoy despierta, pero todavia falta configurar la clave de OpenAI. Pon OPENAI_API_KEY en el entorno y reinicia ChaosOne para activar respuestas reales."
      };
      chat.messages.push({ ...fallback, createdAt: new Date().toISOString() });
      await writeJson(chatsPath, store);
      sendJson(res, 200, { ...fallback, chatId: chat.id });
      return;
    }

    const personality = await readJson(personalityPath);
    const systemPrompt = await buildSystemPrompt(personality);
    let content;
    try {
      if (config.provider === "openai") {
        content = await callOpenAi({ apiKey, config, systemPrompt, chat });
      } else if (config.provider === "anthropic") {
        content = await callAnthropic({ apiKey, config, systemPrompt, chat });
      } else if (config.provider === "gemini") {
        content = await callGemini({ apiKey, config, systemPrompt, chat });
      } else if (config.provider === "mistral-cloud") {
        content = await callMistral({ apiKey, config, systemPrompt, chat });
      } else {
        content = `El proveedor "${config.provider}" no tiene conector todavia.`;
      }
    } catch (error) {
      sendJson(res, 502, {
        role: "assistant",
        content: `No he podido hablar con el proveedor (${error.message}). Revisa la clave, el modelo o la conexion.`
      });
      return;
    }

    const reply = {
      role: "assistant",
      content
    };
    chat.messages.push({ ...reply, createdAt: new Date().toISOString() });
    chat.updatedAt = new Date().toISOString();
    await writeJson(chatsPath, store);
    sendJson(res, 200, { ...reply, chatId: chat.id });
    return;
  }

  if (url.pathname === "/api/process/run" && req.method === "POST") {
    const config = await readJson(configPath);
    const permissions = readPermissions(config);
    if (!permissions.executeProcesses) {
      sendJson(res, 403, { error: "Ejecutar procesos esta desactivado en Permisos" });
      return;
    }

    const { command, approved } = await readBody(req);
    if (!approved) {
      sendJson(res, 428, { error: "Este comando necesita aprobacion explicita antes de ejecutarse" });
      return;
    }

    try {
      const result = runUserCommand(command, permissions.commandTimeoutMs);
      await appendCommandHistory(result);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/process/history" && req.method === "GET") {
    sendJson(res, 200, await readCommandHistory());
    return;
  }

  if (url.pathname === "/api/process/history" && req.method === "DELETE") {
    sendJson(res, 200, await clearCommandHistory());
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(webRoot, requested));

  if (!filePath.startsWith(webRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

await ensureConfig();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}).listen(port, () => {
  console.log(`ChaosOne running at http://localhost:${port}`);
});

