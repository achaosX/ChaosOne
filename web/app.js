const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll("nav button");
const shell = document.querySelector(".shell");
const heroPanel = document.querySelector("#heroPanel");
const inspector = document.querySelector(".inspector");
const toggleInspector = document.querySelector("#toggleInspector");
const closeInspector = document.querySelector("#closeInspector");
const collapseSidebar = document.querySelector("#collapseSidebar");
const openSidebar = document.querySelector("#openSidebar");
const newChatButton = document.querySelector("#newChat");
const statusPill = document.querySelector("#statusPill");
const viewButtons = document.querySelectorAll("[data-view-button]");
const quickActionButtons = document.querySelectorAll(".quick-actions button[data-prompt]");
const recentList = document.querySelector("#recentList");
const historyList = document.querySelector("#historyList");
const deleteAllChats = document.querySelector("#deleteAllChats");
const deleteAllChatsSettings = document.querySelector("#deleteAllChatsSettings");
const greetingName = document.querySelector("#greetingName");
const profileName = document.querySelector("#profileName");
const profileSubline = document.querySelector("#profileSubline");
const profileInitial = document.querySelector("#profileInitial");
const userInitial = document.querySelector("#userInitial");
const statusJson = document.querySelector("#statusJson");
const gatewayStatus = document.querySelector("#gatewayStatus");
const modelStatus = document.querySelector("#modelStatus");
const appVersion = document.querySelector("#appVersion");
const personalityDetails = document.querySelector("#personalityDetails");
const providerInput = document.querySelector("#providerInput");
const modelInput = document.querySelector("#modelInput");
const providerGrid = document.querySelector("#providerGrid");
const modelSelect = document.querySelector("#modelSelect");
const privacyBanner = document.querySelector("#privacyBanner");
const activeProviderLabel = document.querySelector("#activeProviderLabel");
const providerDetails = document.querySelector("#providerDetails");
const applyBrain = document.querySelector("#applyBrain");
const apiKeyEnvInput = document.querySelector("#apiKeyEnvInput");
const apiKeyInput = document.querySelector("#apiKeyInput");
const saveConfig = document.querySelector("#saveConfig");
const saveApiKey = document.querySelector("#saveApiKey");
const deleteApiKey = document.querySelector("#deleteApiKey");
const enableLocalMode = document.querySelector("#enableLocalMode");
const enableMockMode = document.querySelector("#enableMockMode");
const toggleTheme = document.querySelector("#toggleTheme");
const fileInput = document.querySelector("#fileInput");
const attachFiles = document.querySelector("#attachFiles");
const insertMention = document.querySelector("#insertMention");
const addLinkContext = document.querySelector("#addLinkContext");
const formatCode = document.querySelector("#formatCode");
const contextTray = document.querySelector("#contextTray");
const agentSelect = document.querySelector("#agentSelect");
const changeAgent = document.querySelector("#changeAgent");
const changeProject = document.querySelector("#changeProject");
const openProject = document.querySelector("#openProject");
const projectFileCount = document.querySelector("#projectFileCount");
const projectActivity = document.querySelector("#projectActivity");
const projectSummary = document.querySelector("#projectSummary");
const projectFiles = document.querySelector("#projectFiles");
const fileEditorStatus = document.querySelector("#fileEditorStatus");
const filePathInput = document.querySelector("#filePathInput");
const openFile = document.querySelector("#openFile");
const useFileInChat = document.querySelector("#useFileInChat");
const fileEditor = document.querySelector("#fileEditor");
const saveFile = document.querySelector("#saveFile");
const mcpStatus = document.querySelector("#mcpStatus");
const commandInput = document.querySelector("#commandInput");
const runCommand = document.querySelector("#runCommand");
const commandOutput = document.querySelector("#commandOutput");
const commandHistory = document.querySelector("#commandHistory");
const clearCommandHistory = document.querySelector("#clearCommandHistory");
const permReadDocs = document.querySelector("#permReadDocs");
const permFetchUrls = document.querySelector("#permFetchUrls");
const permCloud = document.querySelector("#permCloud");
const permImportIdentity = document.querySelector("#permImportIdentity");
const permSaveKeys = document.querySelector("#permSaveKeys");
const permExecuteProcesses = document.querySelector("#permExecuteProcesses");
const permReadWorkspaceFiles = document.querySelector("#permReadWorkspaceFiles");
const permWriteWorkspaceFiles = document.querySelector("#permWriteWorkspaceFiles");
const allowedProjectRootInput = document.querySelector("#allowedProjectRootInput");
const commandTimeoutInput = document.querySelector("#commandTimeoutInput");
const savePermissions = document.querySelector("#savePermissions");
const permissionsStatus = document.querySelector("#permissionsStatus");
const secretStatus = document.querySelector("#secretStatus");
const setupChecklist = document.querySelector("#setupChecklist");
const openClawSummary = document.querySelector("#openClawSummary");
const importOpenClaw = document.querySelector("#importOpenClaw");
const localRuntimeSummary = document.querySelector("#localRuntimeSummary");
const localModelSelect = document.querySelector("#localModelSelect");
const checkLocalRuntime = document.querySelector("#checkLocalRuntime");
const pullLocalModel = document.querySelector("#pullLocalModel");
const localRuntimeOutput = document.querySelector("#localRuntimeOutput");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const messages = document.querySelector("#messages");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmCancel = document.querySelector("#confirmCancel");
const confirmAccept = document.querySelector("#confirmAccept");
const textDialog = document.querySelector("#textDialog");
const textDialogTitle = document.querySelector("#textDialogTitle");
const textDialogMessage = document.querySelector("#textDialogMessage");
const textDialogInput = document.querySelector("#textDialogInput");
const textDialogCancel = document.querySelector("#textDialogCancel");
const textDialogAccept = document.querySelector("#textDialogAccept");
let activeChatId = null;
let pendingConfirm = null;
let pendingTextDialog = null;
let providersRegistry = null;
let selectedProviderId = null;
let contextItems = [];
let activeProjectFile = null;
let localModelJobTimer = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === id));
  if (id !== "chat") setInspectorOpen(false);
}

function setHasChat(hasChat) {
  heroPanel?.classList.toggle("has-chat", hasChat);
}

function setInspectorOpen(open) {
  inspector?.classList.toggle("open", open);
  toggleInspector?.setAttribute("aria-expanded", String(open));
}

function askConfirm({ title = "Confirmar accion", message, acceptText = "Borrar" }) {
  if (!confirmDialog) return Promise.resolve(false);

  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmAccept.textContent = acceptText;
  confirmDialog.hidden = false;

  return new Promise((resolve) => {
    pendingConfirm = resolve;
    confirmAccept.focus();
  });
}

function closeConfirm(value) {
  if (!pendingConfirm) return;
  confirmDialog.hidden = true;
  pendingConfirm(value);
  pendingConfirm = null;
}

function askText({ title = "Anadir contexto", message = "", placeholder = "", acceptText = "Anadir" }) {
  if (!textDialog) return Promise.resolve(null);

  textDialogTitle.textContent = title;
  textDialogMessage.textContent = message;
  textDialogInput.value = "";
  textDialogInput.placeholder = placeholder;
  textDialogAccept.textContent = acceptText;
  textDialog.hidden = false;

  return new Promise((resolve) => {
    pendingTextDialog = resolve;
    textDialogInput.focus();
  });
}

function closeTextDialog(value) {
  if (!pendingTextDialog) return;
  textDialog.hidden = true;
  pendingTextDialog(value ? textDialogInput.value.trim() : null);
  pendingTextDialog = null;
}

function addMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<span>${role === "user" ? "Tu" : "ChaosOne"}</span><p></p>`;
  article.querySelector("p").textContent = content;
  messages.append(article);
  setHasChat(messages.children.length > 0);
  document.querySelector(".chat-scroll")?.scrollTo({ top: 999999, behavior: "smooth" });
}

function visibleMessage(message, items) {
  if (!items.length) return message;
  const labels = items.map((item) => item.title || item.name || item.url || item.kind).join(", ");
  return `${message}\n\nContexto adjunto: ${labels}`;
}

function insertAtCursor(text) {
  const start = messageInput.selectionStart ?? messageInput.value.length;
  const end = messageInput.selectionEnd ?? messageInput.value.length;
  messageInput.value = `${messageInput.value.slice(0, start)}${text}${messageInput.value.slice(end)}`;
  const next = start + text.length;
  messageInput.focus();
  messageInput.setSelectionRange(next, next);
}

function renderContextTray() {
  contextTray.innerHTML = "";
  contextTray.hidden = contextItems.length === 0;

  contextItems.forEach((item, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "context-chip";
    chip.title = "Quitar del contexto";
    chip.innerHTML = `<span></span><strong></strong>`;
    chip.querySelector("span").textContent = item.kind === "url" ? "link" : "doc";
    chip.querySelector("strong").textContent = item.title || item.name || item.url || "Contexto";
    chip.addEventListener("click", () => {
      contextItems.splice(index, 1);
      renderContextTray();
    });
    contextTray.append(chip);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.readAsText(file);
  });
}

function renderChat(chat) {
  activeChatId = chat?.id || null;
  messages.innerHTML = "";
  (chat?.messages || []).forEach((message) => addMessage(message.role, message.content));
  setHasChat(Boolean(chat?.messages?.length));
}

function renderChecklist(status) {
  const items = [
    ["Servidor local", status.ok],
    ["Identidad OpenClaw importada", status.hasImportedIdentity],
    ["API key disponible", status.hasApiKey]
  ];

  setupChecklist.innerHTML = "";
  items.forEach(([label, done]) => {
    const row = document.createElement("div");
    row.className = `check ${done ? "done" : ""}`;
    row.innerHTML = `<span>${done ? "OK" : "TODO"}</span><strong></strong>`;
    row.querySelector("strong").textContent = label;
    setupChecklist.append(row);
  });
}

async function refreshStatus() {
  const status = await api("/api/status");
  if (statusPill) {
    statusPill.className = `status-pill ${status.privacyMode === "local" ? "local" : "cloud"}`;
    statusPill.textContent =
      status.privacyMode === "local"
        ? "Privado local"
        : status.hasApiKey
          ? "Cloud conectado"
          : "Cloud sin key";
  }
  if (gatewayStatus) gatewayStatus.textContent = status.ok ? "Conectado" : "Revisar";
  if (modelStatus) modelStatus.textContent = status.model || "-";
  if (appVersion) appVersion.textContent = status.version ? `v${status.version}` : "-";
  statusJson.textContent = JSON.stringify(status, null, 2);
  renderChecklist(status);
}

function renderPermissions(permissions) {
  if (permReadDocs) permReadDocs.checked = Boolean(permissions.readAttachedDocuments);
  if (permFetchUrls) permFetchUrls.checked = Boolean(permissions.fetchUrls);
  if (permCloud) permCloud.checked = Boolean(permissions.useCloudProviders);
  if (permImportIdentity) permImportIdentity.checked = Boolean(permissions.importOpenClawIdentity);
  if (permSaveKeys) permSaveKeys.checked = Boolean(permissions.saveApiKeys);
  if (permExecuteProcesses) permExecuteProcesses.checked = Boolean(permissions.executeProcesses);
  if (permReadWorkspaceFiles) permReadWorkspaceFiles.checked = Boolean(permissions.readWorkspaceFiles);
  if (permWriteWorkspaceFiles) permWriteWorkspaceFiles.checked = Boolean(permissions.writeWorkspaceFiles);
  if (allowedProjectRootInput) allowedProjectRootInput.value = permissions.allowedProjectRoots?.[0] || "";
  if (commandTimeoutInput) commandTimeoutInput.value = permissions.commandTimeoutMs || 15000;
  if (commandOutput && !permissions.executeProcesses) {
    commandOutput.textContent = "Permiso requerido: ejecutar procesos.";
  }
}

async function loadPermissions() {
  const permissions = await api("/api/permissions");
  renderPermissions(permissions);
  return permissions;
}

function collectPermissions() {
  return {
    readAttachedDocuments: Boolean(permReadDocs?.checked),
    fetchUrls: Boolean(permFetchUrls?.checked),
    useCloudProviders: Boolean(permCloud?.checked),
    importOpenClawIdentity: Boolean(permImportIdentity?.checked),
    saveApiKeys: Boolean(permSaveKeys?.checked),
    executeProcesses: Boolean(permExecuteProcesses?.checked),
    readWorkspaceFiles: Boolean(permReadWorkspaceFiles?.checked),
    writeWorkspaceFiles: Boolean(permWriteWorkspaceFiles?.checked),
    allowedProjectRoots: allowedProjectRootInput?.value ? [allowedProjectRootInput.value] : undefined,
    commandTimeoutMs: Number(commandTimeoutInput?.value || 15000)
  };
}

async function loadPersonality() {
  const personality = await api("/api/personality");
  personalityDetails.innerHTML = "";
  Object.entries(personality).forEach(([key, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = Array.isArray(value) ? value.join(" | ") : value;
    personalityDetails.append(dt, dd);
  });

  const identity = await api("/api/openclaw/identity");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = "openclaw";
  dd.textContent = identity.imported
    ? `Importado desde ${identity.source}`
    : `Disponible en ${identity.source}`;
  personalityDetails.append(dt, dd);
}

async function loadConfig() {
  const config = await api("/api/config");
  providerInput.value = config.provider;
  modelInput.value = config.model;
  apiKeyEnvInput.value = config.apiKeyEnv || "";
}

function providerModeText(mode) {
  return mode === "local" ? "Local / privado" : "Cloud / externo";
}

function providerStatusText(status) {
  return status === "ready" ? "Listo" : "Previsto";
}

function renderModelOptions(provider, activeModel = "") {
  modelSelect.innerHTML = "";
  (provider?.models || []).forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    option.selected = model.id === activeModel;
    modelSelect.append(option);
  });

  if (!modelSelect.value && provider?.models?.[0]) {
    modelSelect.value = provider.models[0].id;
  }

  modelInput.value = modelSelect.value;
}

function renderPrivacy(provider) {
  const isLocal = provider?.mode === "local";
  privacyBanner.className = `privacy-banner ${isLocal ? "local" : "cloud"}`;
  privacyBanner.querySelector("strong").textContent = isLocal ? "Modo privado local" : "Modo cloud externo";
  privacyBanner.querySelector("span").textContent = isLocal
    ? "El chat se procesa en este equipo si el modelo local esta instalado."
    : "Las conversaciones pueden salir a internet hacia el proveedor seleccionado.";
  activeProviderLabel.textContent = provider
    ? `${provider.shortName || provider.name} - ${providerModeText(provider.mode)}`
    : "-";
}

function selectProvider(providerId, activeModel = "") {
  const provider = providersRegistry?.providers.find((item) => item.id === providerId);
  if (!provider) return;

  selectedProviderId = provider.id;
  providerInput.value = provider.id;
  apiKeyEnvInput.value = provider.apiKeyEnv || (provider.id === "openai" ? "OPENAI_API_KEY" : "");
  renderModelOptions(provider, activeModel);
  renderPrivacy(provider);

  providerDetails.innerHTML = `
    <p><strong>${provider.name}</strong></p>
    <p>${provider.description}</p>
    <p class="small">Estado: ${providerStatusText(provider.status)} - ${providerModeText(provider.mode)}</p>
    <p class="small">API key: ${provider.mode === "local" ? "No necesaria" : provider.apiKeyEnv || "Configurable"}</p>
  `;

  providerGrid.querySelectorAll(".provider-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.provider === provider.id);
  });
}

async function loadProviders() {
  providersRegistry = await api("/api/providers");
  selectedProviderId = providersRegistry.activeProvider;
  providerGrid.innerHTML = "";

  providersRegistry.providers.forEach((provider) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `provider-card ${provider.mode} ${provider.status !== "ready" ? "planned" : ""}`;
    button.dataset.provider = provider.id;
    button.innerHTML = `
      <span class="provider-mode">${providerModeText(provider.mode)}</span>
      <strong></strong>
      <small>${providerStatusText(provider.status)}</small>
      <p></p>
    `;
    button.querySelector("strong").textContent = provider.name;
    button.querySelector("p").textContent = provider.description;
    button.addEventListener("click", () => selectProvider(provider.id, provider.models?.[0]?.id));
    providerGrid.append(button);
  });

  selectProvider(providersRegistry.activeProvider, providersRegistry.activeModel);
}

async function setProvider(provider, model = modelInput.value) {
  await api("/api/config", {
    method: "POST",
    body: JSON.stringify({
      provider,
      model,
      apiKeyEnv: provider === "openai" ? apiKeyEnvInput.value : undefined,
      apiKeyEnvs: provider !== "openai" ? { [provider]: apiKeyEnvInput.value } : undefined
    })
  });
  await Promise.all([loadConfig(), refreshStatus(), loadSecretStatus(), loadProviders()]);
}

async function loadSecretStatus() {
  const provider = selectedProviderId || providerInput.value;
  const status = await api(`/api/secrets/status?provider=${encodeURIComponent(provider)}`);
  secretStatus.textContent = status.hasApiKey
    ? `API key configurada para ${status.provider} (${status.source}).`
    : status.apiKeyEnv
      ? `API key no configurada para ${status.provider}. Puedes usar ${status.apiKeyEnv} o guardarla cifrada aqui.`
      : "Este proveedor no necesita API key.";
}

async function loadOpenClawSummary() {
  const identity = await api("/api/openclaw/identity");
  const files = Object.values(identity.files || {});
  const found = files.filter((file) => file.exists).length;
  openClawSummary.innerHTML = `
    <p><strong>${identity.imported ? "Importado" : "Detectado"}</strong></p>
    <p>${found}/${files.length} archivos encontrados</p>
    <p class="small">${identity.source}</p>
  `;
}

function renderLocalRuntimeStatus(status) {
  if (!localRuntimeSummary) return;
  const readyText = status.reachable ? "Runtime local conectado" : "Runtime local no detectado";
  const activeText = status.hasActiveModel ? "Modelo activo instalado" : "Modelo activo pendiente";
  localRuntimeSummary.innerHTML = `
    <p><strong>${readyText}</strong></p>
    <p>${activeText}: ${status.activeModel}</p>
    <p class="small">${status.commandAvailable ? status.commandVersion : "Comando ollama no disponible en PATH"}</p>
    <p class="small">${status.baseUrl}</p>
  `;

  if (localModelSelect && !localModelSelect.options.length) {
    (status.recommendedModels || []).forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} - ${model.id}`;
      option.selected = model.id === status.activeModel;
      localModelSelect.append(option);
    });
  }

  if (localRuntimeOutput) {
    localRuntimeOutput.textContent = [
      status.reachable ? "Runtime: OK" : `Runtime: ${status.error || "no disponible"}`,
      `Modelos instalados: ${status.models?.length ? status.models.join(", ") : "ninguno detectado"}`,
      `Recomendados: ${(status.recommendedModels || []).map((model) => model.id).join(", ")}`
    ].join("\n");
  }
}

async function loadLocalRuntimeStatus() {
  const status = await api("/api/local-runtime/status");
  renderLocalRuntimeStatus(status);
  return status;
}

function renderLocalModelJob(job) {
  if (!localRuntimeOutput) return;
  localRuntimeOutput.textContent = [
    `Job: ${job.id}`,
    `Modelo: ${job.model}`,
    `Estado: ${job.status}${job.exitCode !== null && job.exitCode !== undefined ? ` (exit ${job.exitCode})` : ""}`,
    job.error ? `\nError:\n${job.error}` : "",
    job.stdout ? `\nstdout:\n${job.stdout}` : "",
    job.stderr ? `\nstderr:\n${job.stderr}` : ""
  ].filter(Boolean).join("\n");
}

function pollLocalModelJob(jobId) {
  if (localModelJobTimer) clearInterval(localModelJobTimer);
  localModelJobTimer = setInterval(async () => {
    try {
      const job = await api(`/api/local-runtime/jobs/${encodeURIComponent(jobId)}`);
      renderLocalModelJob(job);
      if (job.status === "done" || job.status === "error") {
        clearInterval(localModelJobTimer);
        localModelJobTimer = null;
        await Promise.all([loadLocalRuntimeStatus(), refreshStatus(), loadProviders()]);
      }
    } catch (error) {
      clearInterval(localModelJobTimer);
      localModelJobTimer = null;
      if (localRuntimeOutput) localRuntimeOutput.textContent = `No pude consultar la descarga: ${error.message}`;
    }
  }, 1500);
}

async function loadProjectStatus() {
  const project = await api("/api/project/status");
  if (projectFileCount) projectFileCount.textContent = String(project.fileCount);
  if (projectActivity) projectActivity.textContent = formatRelative(project.updatedAt);
  if (mcpStatus) mcpStatus.textContent = "Runtime local";
  if (projectSummary) {
    projectSummary.innerHTML = `
      <p><strong>${project.name}</strong></p>
      <p>${project.fileCount} archivos locales</p>
      <p class="small">${project.root}</p>
    `;
  }
  if (projectFiles) {
    projectFiles.innerHTML = "";
    project.files
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .forEach((file) => {
        const row = document.createElement("div");
        row.className = "file-row";
        row.innerHTML = `<button type="button"><strong></strong><span></span></button>`;
        row.querySelector("strong").textContent = file.path;
        row.querySelector("span").textContent = `${Math.max(1, Math.round(file.size / 1024))} KB - ${formatRelative(file.updatedAt)}`;
        row.querySelector("button").addEventListener("click", () => loadProjectFile(file.path));
        projectFiles.append(row);
      });
  }
}

function renderProjectFile(file) {
  activeProjectFile = file;
  if (filePathInput) filePathInput.value = file?.path || "";
  if (fileEditor) fileEditor.value = file?.content || "";
  if (fileEditorStatus) {
    fileEditorStatus.textContent = file
      ? `${file.path} - ${Math.max(1, Math.round(file.size / 1024))} KB - ${formatRelative(file.updatedAt)}`
      : "Selecciona un archivo del proyecto.";
  }
}

async function loadProjectFile(path = filePathInput?.value?.trim()) {
  if (!path) {
    if (fileEditorStatus) fileEditorStatus.textContent = "Escribe o selecciona una ruta primero.";
    return null;
  }
  try {
    const file = await api(`/api/project/file?path=${encodeURIComponent(path)}`);
    renderProjectFile(file);
    return file;
  } catch (error) {
    if (fileEditorStatus) fileEditorStatus.textContent = `No pude abrir el archivo: ${error.message}`;
    return null;
  }
}

function renderCommandResult(result) {
  commandOutput.textContent = [
    `> ${result.command}`,
    `exit ${result.exitCode ?? "?"}${result.timedOut ? " timeout" : ""}`,
    result.stdout ? `\nstdout:\n${result.stdout}` : "",
    result.stderr ? `\nstderr:\n${result.stderr}` : ""
  ].filter(Boolean).join("\n");
}

function renderCommandHistory(history) {
  if (!commandHistory) return;
  const commands = history?.commands || [];
  commandHistory.innerHTML = "";

  if (!commands.length) {
    commandHistory.innerHTML = `<p class="small">Todavia no hay comandos ejecutados.</p>`;
    return;
  }

  commands.slice(0, 12).forEach((item) => {
    const row = document.createElement("article");
    row.className = `command-history-item ${item.exitCode === 0 ? "success" : "failed"}`;
    row.innerHTML = `
      <div>
        <strong></strong>
        <small></small>
      </div>
      <span></span>
    `;
    row.querySelector("strong").textContent = item.command;
    row.querySelector("small").textContent = `${formatRelative(item.startedAt)} - ${item.durationMs || 0} ms - riesgo ${item.risk || "normal"}`;
    row.querySelector("span").textContent = item.timedOut ? "timeout" : `exit ${item.exitCode ?? "?"}`;
    row.addEventListener("click", () => renderCommandResult(item));
    commandHistory.append(row);
  });
}

async function loadCommandHistory() {
  const history = await api("/api/process/history");
  renderCommandHistory(history);
  return history;
}

async function loadProfile() {
  const profile = await api("/api/profile");
  greetingName.textContent = profile.displayName;
  profileName.textContent = profile.displayName;
  profileSubline.textContent = profile.windowsUser ? `Windows: ${profile.windowsUser}` : "Perfil local";
  profileInitial.textContent = profile.initial;
  userInitial.firstChild.textContent = profile.initial;
}

function formatRelative(dateText) {
  if (!dateText) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(dateText).getTime()) / 60000));
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} dias`;
}

async function loadChats() {
  const store = await api("/api/chats");
  activeChatId = store.activeChatId;
  recentList.innerHTML = "";
  historyList.innerHTML = "";

  if (!store.chats.length) {
    recentList.innerHTML = `<p class="small">Todavia no hay chats guardados.</p>`;
    historyList.innerHTML = `<p class="small">Sin chats aun.</p>`;
    renderChat(null);
    return;
  }

  store.chats.slice(0, 16).forEach((chat) => {
    const row = document.createElement("div");
    row.className = `history-item ${chat.id === activeChatId ? "active" : ""}`;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "history-open";
    openButton.innerHTML = `<span class="chat-title"></span><small>${formatRelative(chat.updatedAt)} - ${chat.messageCount} msg</small>`;
    openButton.querySelector(".chat-title").textContent = chat.title;
    openButton.addEventListener("click", async () => {
      const fullChat = await api(`/api/chats/${encodeURIComponent(chat.id)}`);
      renderChat(fullChat);
      await loadChats();
      showView("chat");
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "history-delete";
    removeButton.title = "Borrar chat";
    removeButton.setAttribute("aria-label", `Borrar ${chat.title}`);
    removeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>`;
    removeButton.addEventListener("click", async () => {
      const confirmed = await askConfirm({
        title: "Borrar chat",
        message: `Se eliminara "${chat.title}" del historial local.`,
        acceptText: "Borrar chat"
      });
      if (!confirmed) return;
      await api(`/api/chats/${encodeURIComponent(chat.id)}`, { method: "DELETE" });
      await loadChats();
    });

    row.append(openButton, removeButton);
    historyList.append(row);
  });

  store.chats.slice(0, 5).forEach((chat) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<span class="chat-title"></span><span>${formatRelative(chat.updatedAt)}</span>`;
    button.querySelector(".chat-title").textContent = chat.title;
    button.addEventListener("click", async () => {
      const fullChat = await api(`/api/chats/${encodeURIComponent(chat.id)}`);
      renderChat(fullChat);
      showView("chat");
    });
    recentList.append(button);
  });

  if (activeChatId) {
    const active = await api(`/api/chats/${encodeURIComponent(activeChatId)}`);
    renderChat(active);
  }
}

async function clearAllChats() {
  const confirmed = await askConfirm({
    title: "Borrar historial",
    message: "Se eliminaran todos los chats guardados en este equipo. Esta accion no se puede deshacer.",
    acceptText: "Borrar todo"
  });
  if (!confirmed) return;
  await api("/api/chats", { method: "DELETE" });
  await loadChats();
  messageInput.focus();
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewButton));
});

toggleInspector?.addEventListener("click", () => {
  setInspectorOpen(!inspector?.classList.contains("open"));
});

closeInspector?.addEventListener("click", () => setInspectorOpen(false));

confirmCancel?.addEventListener("click", () => closeConfirm(false));
confirmAccept?.addEventListener("click", () => closeConfirm(true));
confirmDialog?.addEventListener("click", (event) => {
  if (event.target === confirmDialog) closeConfirm(false);
});
textDialogCancel?.addEventListener("click", () => closeTextDialog(false));
textDialogAccept?.addEventListener("click", () => closeTextDialog(true));
textDialog?.addEventListener("click", (event) => {
  if (event.target === textDialog) closeTextDialog(false);
});
textDialogInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") closeTextDialog(true);
  if (event.key === "Escape") closeTextDialog(false);
});

collapseSidebar?.addEventListener("click", () => {
  shell?.classList.add("sidebar-hidden");
  localStorage.setItem("chaosone.sidebarHidden", "true");
});

openSidebar?.addEventListener("click", () => {
  shell?.classList.remove("sidebar-hidden");
  localStorage.setItem("chaosone.sidebarHidden", "false");
});

quickActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt;
    messageInput.focus();
  });
});

newChatButton?.addEventListener("click", async () => {
  const chat = await api("/api/chats", { method: "POST", body: "{}" });
  renderChat(chat);
  await loadChats();
  messageInput.focus();
});

saveConfig.addEventListener("click", async () => {
  const provider = providerInput.value;
  await api("/api/config", {
    method: "POST",
    body: JSON.stringify({
      provider,
      model: modelInput.value,
      apiKeyEnv: provider === "openai" ? apiKeyEnvInput.value : undefined,
      apiKeyEnvs: provider !== "openai" ? { [provider]: apiKeyEnvInput.value } : undefined
    })
  });
  await refreshStatus();
  await loadSecretStatus();
});

modelSelect?.addEventListener("change", () => {
  modelInput.value = modelSelect.value;
});

applyBrain?.addEventListener("click", async () => {
  const provider = providersRegistry?.providers.find((item) => item.id === selectedProviderId);
  if (!provider) return;

  await setProvider(provider.id, modelSelect.value);
  secretStatus.textContent =
    provider.mode === "local"
      ? "Cerebro local activado. No necesita API key."
      : "Cerebro cloud activado. Revisa la API key antes de chatear.";
  showView("chat");
  messageInput.focus();
});

enableMockMode?.addEventListener("click", async () => {
  await setProvider("mock", "mock-local");
  secretStatus.textContent = "Modo demo activo: puedes chatear sin consumir creditos.";
  messageInput.focus();
  showView("chat");
});

enableLocalMode?.addEventListener("click", async () => {
  await setProvider("ollama", "tinyllama");
  secretStatus.textContent = "Modo local activo: ChaosOne usara Ollama en este equipo.";
  messageInput.focus();
  showView("chat");
});

saveApiKey.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const provider = selectedProviderId || providerInput.value;
  if (!apiKey) {
    secretStatus.textContent = "Pega una API key antes de guardarla.";
    return;
  }

  await api(`/api/secrets/${encodeURIComponent(provider)}-key`, {
    method: "POST",
    body: JSON.stringify({ apiKey })
  });
  apiKeyInput.value = "";
  await Promise.all([refreshStatus(), loadSecretStatus()]);
});

savePermissions?.addEventListener("click", async () => {
  const permissions = await api("/api/permissions", {
    method: "POST",
    body: JSON.stringify(collectPermissions())
  });
  renderPermissions(permissions);
  await refreshStatus();
  permissionsStatus.textContent = "Permisos guardados.";
});

deleteApiKey.addEventListener("click", async () => {
  const provider = selectedProviderId || providerInput.value;
  await api(`/api/secrets/${encodeURIComponent(provider)}-key`, { method: "DELETE" });
  await Promise.all([refreshStatus(), loadSecretStatus()]);
});

deleteAllChats?.addEventListener("click", clearAllChats);
deleteAllChatsSettings?.addEventListener("click", clearAllChats);

importOpenClaw.addEventListener("click", async () => {
  await api("/api/openclaw/import", { method: "POST", body: "{}" });
  await Promise.all([refreshStatus(), loadOpenClawSummary(), loadPersonality()]);
});

checkLocalRuntime?.addEventListener("click", async () => {
  if (localRuntimeOutput) localRuntimeOutput.textContent = "Comprobando runtime local...";
  try {
    await loadLocalRuntimeStatus();
  } catch (error) {
    if (localRuntimeOutput) localRuntimeOutput.textContent = `No pude comprobar el runtime: ${error.message}`;
  }
});

pullLocalModel?.addEventListener("click", async () => {
  const model = localModelSelect?.value;
  if (!model) {
    if (localRuntimeOutput) localRuntimeOutput.textContent = "Elige un modelo primero.";
    return;
  }
  const approved = await askConfirm({
    title: "Descargar modelo local",
    message: `ChaosOne descargara el modelo "${model}". Puede tardar varios minutos y ocupar espacio en disco.`,
    acceptText: "Descargar"
  });
  if (!approved) return;
  if (localRuntimeOutput) localRuntimeOutput.textContent = `Preparando descarga de ${model}...`;
  try {
    const job = await api("/api/local-runtime/pull", {
      method: "POST",
      body: JSON.stringify({ model, approved: true })
    });
    renderLocalModelJob(job);
    pollLocalModelJob(job.id);
  } catch (error) {
    if (localRuntimeOutput) localRuntimeOutput.textContent = `No pude descargar el modelo: ${error.message}`;
  }
});

toggleTheme?.addEventListener("click", () => {
  document.body.classList.toggle("quiet-theme");
  localStorage.setItem("chaosone.quietTheme", document.body.classList.contains("quiet-theme") ? "true" : "false");
});

attachFiles?.addEventListener("click", () => fileInput?.click());

fileInput?.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      contextItems.push({
        kind: "documento",
        title: file.name,
        size: file.size,
        content
      });
    } catch (error) {
      addMessage("assistant", `No pude leer "${file.name}": ${error.message}`);
    }
  }
  fileInput.value = "";
  renderContextTray();
  messageInput.focus();
});

insertMention?.addEventListener("click", () => {
  insertAtCursor(messageInput.value.endsWith(" ") || !messageInput.value ? "@ChaosOne " : " @ChaosOne ");
});

addLinkContext?.addEventListener("click", async () => {
  const targetUrl = await askText({
    title: "Anadir enlace",
    message: "Pega una URL para descargarla y usarla como contexto del chat.",
    placeholder: "https://ejemplo.com",
    acceptText: "Anadir enlace"
  });
  if (!targetUrl) return;

  try {
    const item = await api("/api/context/url", {
      method: "POST",
      body: JSON.stringify({ targetUrl })
    });
    contextItems.push(item);
    renderContextTray();
    messageInput.focus();
  } catch (error) {
    addMessage("assistant", `No pude anadir ese enlace: ${error.message}`);
  }
});

formatCode?.addEventListener("click", () => {
  const start = messageInput.selectionStart ?? 0;
  const end = messageInput.selectionEnd ?? 0;
  const selected = messageInput.value.slice(start, end);
  insertAtCursor(selected ? `\`${selected}\`` : "``");
});

agentSelect?.addEventListener("click", () => showView("agents"));
changeAgent?.addEventListener("click", () => showView("agents"));
changeProject?.addEventListener("click", () => showView("projects"));
openProject?.addEventListener("click", () => showView("projects"));

openFile?.addEventListener("click", () => loadProjectFile());

useFileInChat?.addEventListener("click", async () => {
  const file = activeProjectFile || (await loadProjectFile());
  if (!file) return;
  contextItems.push({
    kind: "archivo",
    title: file.path,
    content: fileEditor?.value || file.content
  });
  renderContextTray();
  showView("chat");
  messageInput.focus();
});

saveFile?.addEventListener("click", async () => {
  const path = filePathInput?.value?.trim();
  if (!path) {
    if (fileEditorStatus) fileEditorStatus.textContent = "No hay ruta de archivo para guardar.";
    return;
  }
  const approved = await askConfirm({
    title: "Guardar archivo",
    message: `ChaosOne guardara cambios en:\n\n${path}`,
    acceptText: "Guardar"
  });
  if (!approved) return;
  try {
    const result = await api("/api/project/file", {
      method: "POST",
      body: JSON.stringify({ path, content: fileEditor?.value || "", approved: true })
    });
    activeProjectFile = { ...(activeProjectFile || {}), ...result, content: fileEditor?.value || "" };
    if (fileEditorStatus) fileEditorStatus.textContent = `Guardado: ${result.path} - ${formatRelative(result.updatedAt)}`;
    await loadProjectStatus();
  } catch (error) {
    if (fileEditorStatus) fileEditorStatus.textContent = `No pude guardar: ${error.message}`;
  }
});

runCommand?.addEventListener("click", async () => {
  const command = commandInput.value.trim();
  if (!command) {
    commandOutput.textContent = "Escribe un comando primero.";
    return;
  }
  const approved = await askConfirm({
    title: "Aprobar ejecucion",
    message: `ChaosOne ejecutara este comando PowerShell dentro del workspace local:\n\n${command}`,
    acceptText: "Ejecutar"
  });
  if (!approved) {
    commandOutput.textContent = "Ejecucion cancelada.";
    return;
  }
  commandOutput.textContent = "Ejecutando...";
  try {
    const result = await api("/api/process/run", {
      method: "POST",
      body: JSON.stringify({ command, approved: true })
    });
    renderCommandResult(result);
    await loadCommandHistory();
  } catch (error) {
    commandOutput.textContent = `No se pudo ejecutar: ${error.message}`;
  }
});

clearCommandHistory?.addEventListener("click", async () => {
  const confirmed = await askConfirm({
    title: "Limpiar historial",
    message: "Se eliminara el historial local de comandos ejecutados. No borra archivos ni resultados del sistema.",
    acceptText: "Limpiar"
  });
  if (!confirmed) return;
  await api("/api/process/history", { method: "DELETE" });
  await loadCommandHistory();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  const sentContext = [...contextItems];
  contextItems = [];
  renderContextTray();
  messageInput.value = "";
  addMessage("user", visibleMessage(message, sentContext));

  try {
    const reply = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, chatId: activeChatId, contextItems: sentContext })
    });
    activeChatId = reply.chatId || activeChatId;
    addMessage("assistant", reply.content);
    await loadChats();
  } catch (error) {
    addMessage("assistant", `Algo fallo: ${error.message}`);
  }
});

await Promise.all([
  refreshStatus(),
  loadProfile(),
  loadPersonality(),
  loadConfig(),
  loadOpenClawSummary(),
  loadLocalRuntimeStatus(),
  loadChats(),
  loadProjectStatus(),
  loadPermissions(),
  loadCommandHistory()
]);

await loadProviders();
await loadSecretStatus();

if (localStorage.getItem("chaosone.sidebarHidden") === "true") {
  shell?.classList.add("sidebar-hidden");
}

if (localStorage.getItem("chaosone.quietTheme") === "true") {
  document.body.classList.add("quiet-theme");
}

