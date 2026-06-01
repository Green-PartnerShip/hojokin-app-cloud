const elements = {
  memoInput: document.getElementById("memoInput"),
  outputText: document.getElementById("outputText"),
  audienceSelect: document.getElementById("audienceSelect"),
  purposeSelect: document.getElementById("purposeSelect"),
  toneSelect: document.getElementById("toneSelect"),
  formatSelect: document.getElementById("formatSelect"),
  detailSelect: document.getElementById("detailSelect"),
  convertButton: document.getElementById("convertButton"),
  sampleButton: document.getElementById("sampleButton"),
  clearInputButton: document.getElementById("clearInputButton"),
  clearOutputButton: document.getElementById("clearOutputButton"),
  copyButton: document.getElementById("copyButton"),
  shortenButton: document.getElementById("shortenButton"),
  saveDraftButton: document.getElementById("saveDraftButton"),
  openDraftsButton: document.getElementById("openDraftsButton"),
  logoutButton: document.getElementById("logoutButton"),
  helpButton: document.getElementById("helpButton"),
  closeHelpButton: document.getElementById("closeHelpButton"),
  helpDialog: document.getElementById("helpDialog"),
  draftDialog: document.getElementById("draftDialog"),
  closeDraftButton: document.getElementById("closeDraftButton"),
  draftList: document.getElementById("draftList"),
  messageBar: document.getElementById("messageBar"),
  tooltip: document.getElementById("tooltip"),
  serverMode: document.getElementById("serverMode")
};

const draftKey = "explanation-converter-drafts";
const apiBase = "/explanation/api";
const loginPath = "/login";
let tooltipTimer = null;
const tooltipNodes = new WeakSet();

const sampleMemo = `A社の件、API連携でエラー。
原因は認証トークン期限切れの可能性。
トークン再発行で復旧済み。
ただし毎月同じことが起きる可能性あり。
恒久対応として自動更新を入れたい。
工数は半日程度。`;

boot();

function boot() {
  bindEvents();
  setupTooltips();
  checkServer();
}

function bindEvents() {
  elements.convertButton.addEventListener("click", convertMemo);
  elements.sampleButton.addEventListener("click", () => {
    elements.memoInput.value = sampleMemo;
    showMessage("サンプル文を入力しました。条件を選んで変換できます。", "success");
    elements.memoInput.focus();
  });
  elements.clearInputButton.addEventListener("click", () => {
    elements.memoInput.value = "";
    showMessage("入力欄を空にしました。", "success");
    elements.memoInput.focus();
  });
  elements.clearOutputButton.addEventListener("click", () => {
    elements.outputText.value = "";
    showMessage("出力欄を空にしました。", "success");
  });
  elements.copyButton.addEventListener("click", copyOutput);
  elements.shortenButton.addEventListener("click", shortenOutput);
  elements.saveDraftButton.addEventListener("click", saveDraft);
  elements.openDraftsButton.addEventListener("click", openDrafts);
  elements.logoutButton.addEventListener("click", logout);
  elements.helpButton.addEventListener("click", () => {
    hideTooltip();
    elements.helpDialog.showModal();
  });
  elements.closeHelpButton.addEventListener("click", () => {
    hideTooltip();
    elements.helpDialog.close();
  });
  elements.closeDraftButton.addEventListener("click", () => elements.draftDialog.close());

  [elements.helpDialog, elements.draftDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function setupTooltips() {
  document.querySelectorAll("[data-tooltip]").forEach((node) => {
    if (tooltipNodes.has(node)) return;
    tooltipNodes.add(node);
    node.addEventListener("pointerenter", () => scheduleTooltip(node));
    node.addEventListener("pointerleave", hideTooltip);
    node.addEventListener("click", hideTooltip);
  });
}

function scheduleTooltip(node) {
  window.clearTimeout(tooltipTimer);
  tooltipTimer = window.setTimeout(() => showTooltip(node), 520);
}

function showTooltip(node) {
  const text = node.getAttribute("data-tooltip");
  if (!text) return;

  elements.tooltip.textContent = text;
  elements.tooltip.hidden = false;

  const rect = node.getBoundingClientRect();
  const tooltipRect = elements.tooltip.getBoundingClientRect();
  let top = rect.bottom + 10;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

  if (left < 12) left = 12;
  if (left + tooltipRect.width > window.innerWidth - 12) {
    left = window.innerWidth - tooltipRect.width - 12;
  }
  if (top + tooltipRect.height > window.innerHeight - 12) {
    top = rect.top - tooltipRect.height - 10;
  }

  elements.tooltip.style.left = `${left}px`;
  elements.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  window.clearTimeout(tooltipTimer);
  elements.tooltip.hidden = true;
}

async function checkServer() {
  try {
    const response = await fetch(`${apiBase}/health`);
    const data = await response.json();
    if (data.authRequired && !data.authenticated) {
      window.location.href = loginPath;
      return;
    }
    elements.logoutButton.hidden = !data.authRequired;
    elements.serverMode.textContent = data.mode === "cloud"
      ? "クラウド用で起動中"
      : data.mode === "lan"
        ? "社内LAN用で起動中"
        : "ローカル用で起動中";
  } catch {
    elements.serverMode.textContent = "オフライン表示";
  }
}

async function logout() {
  try {
    await fetch("/logout", { method: "POST" });
  } finally {
    window.location.href = loginPath;
  }
}

async function convertMemo() {
  const memo = elements.memoInput.value.trim();
  if (!memo) {
    showMessage("まず元メモを入力してください。", "warning");
    elements.memoInput.focus();
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`${apiBase}/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readForm())
    });
    if (!response.ok) throw new Error("変換に失敗しました。");
    const data = await response.json();
    elements.outputText.value = data.output || "";
    showMessage(data.warnings?.[0] || "変換しました。必要に応じてコピーしてください。", data.warnings?.length ? "warning" : "success");
  } catch (error) {
    showMessage(error.message || "変換できませんでした。", "error");
  } finally {
    setLoading(false);
  }
}

function readForm() {
  return {
    memo: elements.memoInput.value,
    audience: elements.audienceSelect.value,
    purpose: elements.purposeSelect.value,
    tone: elements.toneSelect.value,
    format: elements.formatSelect.value,
    detail: elements.detailSelect.value
  };
}

function writeForm(data) {
  elements.memoInput.value = data.memo || "";
  elements.outputText.value = data.output || "";
  elements.audienceSelect.value = data.audience || "boss";
  elements.purposeSelect.value = data.purpose || "report";
  elements.toneSelect.value = data.tone || "polite";
  elements.formatSelect.value = data.format || "email";
  elements.detailSelect.value = data.detail || "standard";
}

function setLoading(isLoading) {
  elements.convertButton.disabled = isLoading;
  elements.convertButton.textContent = isLoading ? "作成中..." : "変換する";
}

async function copyOutput() {
  const text = elements.outputText.value.trim();
  if (!text) {
    showMessage("コピーする変換結果がありません。", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showMessage("変換結果をコピーしました。", "success");
  } catch {
    elements.outputText.select();
    document.execCommand("copy");
    showMessage("変換結果をコピーしました。", "success");
  }
}

function shortenOutput() {
  const text = elements.outputText.value.trim();
  if (!text) {
    showMessage("短くする変換結果がありません。", "warning");
    return;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const keepers = lines.filter((line) => {
    return /件名|概要|現状|状況|今後|対応|TODO|要点|結論|確認|お願い|・|-/.test(line);
  });
  const compact = (keepers.length ? keepers : lines).slice(0, 10).join("\n");
  elements.outputText.value = compact;
  showMessage("要点を残して短く整えました。", "success");
}

async function saveDraft() {
  const form = readForm();
  const output = elements.outputText.value;
  if (!form.memo.trim() && !output.trim()) {
    showMessage("保存する内容がありません。", "warning");
    return;
  }

  const now = new Date();
  const draft = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    title: makeDraftTitle(form.memo, output),
    ...form,
    output
  };

  if (await saveDraftToServer(draft)) {
    showMessage("下書きを保存しました。", "success");
    return;
  }

  const drafts = loadLocalDrafts();
  drafts.unshift(draft);
  localStorage.setItem(draftKey, JSON.stringify(drafts.slice(0, 12)));
  showMessage("下書きを保存しました。", "success");
}

async function openDrafts() {
  await renderDrafts();
  elements.draftDialog.showModal();
}

async function renderDrafts() {
  const drafts = await loadDrafts();
  elements.draftList.innerHTML = "";

  if (!drafts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "保存済みの下書きはまだありません。";
    elements.draftList.appendChild(empty);
    return;
  }

  drafts.forEach((draft) => {
    const item = document.createElement("article");
    item.className = "draft-item";

    const title = document.createElement("div");
    title.className = "draft-title";
    title.textContent = draft.title;

    const meta = document.createElement("div");
    meta.className = "draft-meta";
    meta.textContent = `${formatDate(draft.createdAt)} / ${labelOf("audience", draft.audience)} / ${labelOf("purpose", draft.purpose)}`;

    const preview = document.createElement("div");
    preview.className = "draft-preview";
    preview.textContent = (draft.memo || draft.output || "").replace(/\s+/g, " ").slice(0, 140);

    const actions = document.createElement("div");
    actions.className = "draft-actions";

    const restoreButton = document.createElement("button");
    restoreButton.className = "secondary-button";
    restoreButton.type = "button";
    restoreButton.textContent = "復元";
    restoreButton.setAttribute("data-tooltip", "この下書きを入力画面へ戻します。");
    restoreButton.addEventListener("click", () => {
      writeForm(draft);
      elements.draftDialog.close();
      showMessage("下書きを復元しました。", "success");
      setupTooltips();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("data-tooltip", "この下書きを一覧から削除します。");
    deleteButton.addEventListener("click", async () => {
      await deleteDraft(draft.id);
      await renderDrafts();
    });

    actions.append(restoreButton, deleteButton);
    item.append(title, meta, preview, actions);
    elements.draftList.appendChild(item);
  });

  setupTooltips();
}

async function loadDrafts() {
  try {
    const response = await fetch(`${apiBase}/drafts`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.drafts)) return data.drafts;
    }
  } catch {}
  return loadLocalDrafts();
}

async function saveDraftToServer(draft) {
  try {
    const response = await fetch(`${apiBase}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function deleteDraft(id) {
  try {
    const response = await fetch(`${apiBase}/drafts/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (response.ok) return;
  } catch {}

  const next = loadLocalDrafts().filter((itemDraft) => itemDraft.id !== id);
  localStorage.setItem(draftKey, JSON.stringify(next));
}

function loadLocalDrafts() {
  try {
    return JSON.parse(localStorage.getItem(draftKey) || "[]");
  } catch {
    return [];
  }
}

function makeDraftTitle(memo, output) {
  const source = (memo || output || "下書き").split(/\r?\n/).find(Boolean) || "下書き";
  return source.replace(/\s+/g, " ").slice(0, 42);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function labelOf(type, value) {
  const labels = {
    audience: {
      boss: "上司",
      customer: "お客様",
      team: "チーム",
      executive: "経営層",
      partner: "協力会社"
    },
    purpose: {
      report: "状況報告",
      consult: "相談",
      apology: "お詫び",
      request: "依頼",
      progress: "進捗共有",
      trouble: "トラブル説明"
    }
  };
  return labels[type]?.[value] || value || "";
}

function showMessage(message, type = "") {
  elements.messageBar.textContent = message;
  elements.messageBar.className = `message-bar ${type}`.trim();
}
