const PATH_MODE = location.pathname.toLowerCase();
const MODE = PATH_MODE.includes("personal") ? "personal" : "shared";
const MODE_LABEL = MODE === "personal" ? "個人用" : "社内共有";
const USE_SHARED = MODE === "shared";
const STORE_KEY = `phrase-stock:v3:${MODE}`;
const LEGACY_KEY = "phrase-stock:v1";
const API_BASE = "/phrase-stock/api";
const API_SESSION = `${API_BASE}/session`;
const API_LOGIN = `${API_BASE}/login`;
const API_LOGOUT = `${API_BASE}/logout`;
const API_TEMPLATES = `${API_BASE}/templates`;

const GENERAL_CATEGORIES = [
  "日程調整",
  "お礼",
  "催促・確認",
  "お断り",
  "お詫び",
  "依頼",
  "案内",
  "見積・請求",
  "社内連絡",
  "SNS・投稿",
  "その他",
];

const SUBSIDY_CATEGORIES = [
  "初回対応",
  "ヒアリング",
  "契約・プラン",
  "月次配信",
  "申請準備",
  "申請書修正",
  "加点・添付書類",
  "交付申請",
  "採択後連絡",
  "実施中フォロー",
  "実績報告",
  "請求・入金",
  "紹介パートナー",
  "ステータス共有",
  "GビズID",
  "その他",
];

const CATEGORIES = [...new Set([...GENERAL_CATEGORIES, ...SUBSIDY_CATEGORIES])];

const TONES = ["やわらかい", "丁寧", "かなり丁寧", "簡潔", "親しみ"];
const RECIPIENTS = ["社外", "社内", "顧客", "取引先", "個人", "SNS"];

const CATEGORY_ICONS = {
  初回対応: "handshake",
  ヒアリング: "clipboard-list",
  日程調整: "calendar-clock",
  お礼: "heart-handshake",
  "催促・確認": "check-check",
  お断り: "circle-slash",
  お詫び: "hand-heart",
  依頼: "send",
  案内: "map",
  "契約・プラン": "file-signature",
  月次配信: "newspaper",
  申請準備: "folder-check",
  申請書修正: "file-pen-line",
  "加点・添付書類": "paperclip",
  交付申請: "stamp",
  採択後連絡: "badge-check",
  実施中フォロー: "list-checks",
  実績報告: "clipboard-check",
  "請求・入金": "circle-dollar-sign",
  紹介パートナー: "share-2",
  ステータス共有: "radio",
  "GビズID": "key-round",
  "見積・請求": "receipt-text",
  社内連絡: "building-2",
  "SNS・投稿": "messages-square",
  その他: "file-text",
};

const HELP_TEXT = {
  action: {
    "export-json": "現在の定型文データをJSON形式で控え保存します。別PCへの移行や復元用に使います。",
    "open-app-switcher": "同じWebサービス内のアプリを切り替えるウインドウを開きます。定型文ストックへ戻りたいときに使います。",
    "switch-to-phrase-stock": "定型文ストック画面を開きます。他のアプリ画面から戻るための切替先です。",
    "copy-claude": "選択中の文面、または作成した文面をClaudeに整えてもらうための依頼文に変換します。",
    "open-help": "操作方法、各ボタンの役割、使い分けを詳しく確認できます。",
    logout: "社内共有データからログアウトします。共有端末で使った後に押してください。",
    "open-writer": "要点だけ入力して、アプリ内で自然な日本語文を作成します。",
    "new-template": "新しい定型文を登録します。用途、温度感、宛先、タグ、本文を保存できます。",
    "print-library": "表示中の定型文を、読みやすい定型文集として別画面に整えます。印刷やPDF保存に使えます。",
    "reset-samples": "登録内容をGreen Partnership向けの練習データに戻します。現在の保存データは置き換わります。",
    "copy-template": "定型文の原文をそのままコピーします。差し込み前の本文を使いたいときに便利です。",
    "copy-finished": "相手名や案件名などを差し込んだプレビュー文面をコピーします。",
    "toggle-favorite": "よく使う定型文をお気に入りに入れたり外したりします。",
    "edit-template": "選択中の定型文を編集します。本文やタグ、分類を変更できます。",
    "delete-template": "編集中の定型文を削除します。削除前に確認が出ます。",
    "close-dialog": "編集画面を閉じます。未保存の入力内容は保存されません。",
    "copy-claude-prompt": "Claude用の改善依頼文をコピーします。ClaudeのWeb画面に貼り付けて使います。",
    "close-claude": "Claude用依頼文の画面を閉じます。",
    "generate-writer": "入力した要点をもとに、用途と温度感に合う文章を作り直します。",
    "copy-writer": "作成モードで生成した文章をコピーします。",
    "save-writer-template": "作成モードで生成した文章を、定型文として保存します。",
    "writer-to-claude": "作成モードの文章をClaudeでさらに自然に整えるための依頼文に変換します。",
    "close-writer": "文章作成画面を閉じます。",
    "close-help": "ヘルプ画面を閉じます。",
    "close-app-switcher": "アプリ切替ウインドウを閉じます。",
  },
  view: {
    all: "登録されている定型文をすべて表示します。",
    favorite: "お気に入りに入れた、よく使う定型文だけを表示します。",
    recent: "最近コピーした定型文を表示します。",
  },
  domain: {
    general: "一般的なビジネス連絡で使う定型文だけを表示します。",
    subsidy: "補助金顧問業務で使う定型文だけを表示します。",
  },
};

const elements = {
  importFile: document.querySelector("#importFile"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  toneFilter: document.querySelector("#toneFilter"),
  recipientFilter: document.querySelector("#recipientFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  totalCount: document.querySelector("#totalCount"),
  favoriteCount: document.querySelector("#favoriteCount"),
  copyCount: document.querySelector("#copyCount"),
  categoryCount: document.querySelector("#categoryCount"),
  viewKicker: document.querySelector("#viewKicker"),
  viewTitle: document.querySelector("#viewTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  templateList: document.querySelector("#templateList"),
  detailTitle: document.querySelector("#detailTitle"),
  favoriteButton: document.querySelector("#favoriteButton"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  personInput: document.querySelector("#personInput"),
  companyInput: document.querySelector("#companyInput"),
  topicInput: document.querySelector("#topicInput"),
  deadlineInput: document.querySelector("#deadlineInput"),
  senderInput: document.querySelector("#senderInput"),
  previewText: document.querySelector("#previewText"),
  dialog: document.querySelector("#templateDialog"),
  form: document.querySelector("#templateForm"),
  modalMode: document.querySelector("#modalMode"),
  modalTitle: document.querySelector("#modalTitle"),
  titleInput: document.querySelector("#titleInput"),
  categoryInput: document.querySelector("#categoryInput"),
  toneInput: document.querySelector("#toneInput"),
  recipientInput: document.querySelector("#recipientInput"),
  tagsInput: document.querySelector("#tagsInput"),
  bodyInput: document.querySelector("#bodyInput"),
  appSwitcherDialog: document.querySelector("#appSwitcherDialog"),
  claudeDialog: document.querySelector("#claudeDialog"),
  claudePrompt: document.querySelector("#claudePrompt"),
  writerDialog: document.querySelector("#writerDialog"),
  writerCategory: document.querySelector("#writerCategory"),
  writerTone: document.querySelector("#writerTone"),
  writerRecipient: document.querySelector("#writerRecipient"),
  writerPerson: document.querySelector("#writerPerson"),
  writerPoint: document.querySelector("#writerPoint"),
  writerDeadline: document.querySelector("#writerDeadline"),
  writerSender: document.querySelector("#writerSender"),
  writerCare: document.querySelector("#writerCare"),
  writerOutput: document.querySelector("#writerOutput"),
  helpDialog: document.querySelector("#helpDialog"),
  helpContent: document.querySelector("#helpContent"),
  loginDialog: document.querySelector("#loginDialog"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  logoutButton: document.querySelector("#logoutButton"),
  quickHelp: document.querySelector("#quickHelp"),
  toast: document.querySelector("#toast"),
};

const state = {
  templates: [],
  selectedId: null,
  editingId: null,
  view: "all",
  domain: "subsidy",
  query: "",
  category: "all",
  tone: "all",
  recipient: "all",
  sort: "updated",
  sharedReady: false,
  authRequired: false,
  authenticated: !USE_SHARED,
  sharedUser: "",
  sharedRevision: 0,
};

let toastTimer = null;
let quickHelpTimer = null;
let quickHelpTarget = null;
let quickHelpPoint = { x: 0, y: 0 };
let sharedSaveTimer = null;
let sharedSaving = false;
let sharedPollTimer = null;
let pendingSharedSave = { deletedIds: [], replace: false };

async function initialize() {
  document.title = `定型文ストック | ${MODE_LABEL}`;
  document.querySelector(".brand p").textContent = `${MODE_LABEL} | すぐ送れる、自然な日本語`;
  state.templates = loadTemplates();

  populateDomainSelects();
  populateSelect(elements.toneFilter, TONES, "すべて");
  populateSelect(elements.recipientFilter, RECIPIENTS, "すべて");
  populateSelect(elements.toneInput, TONES);
  populateSelect(elements.recipientInput, RECIPIENTS);
  populateSelect(elements.writerTone, TONES);
  populateSelect(elements.writerRecipient, RECIPIENTS);

  bindEvents();
  renderHelp();
  state.selectedId = state.templates[0]?.id || null;
  render();
  generateWriter();

  if (USE_SHARED) {
    await initializeSharedMode();
  }
}

function populateDomainSelects() {
  const categories = getDomainCategories(state.domain);
  populateSelect(elements.categoryFilter, categories, "すべて");
  populateSelect(elements.categoryInput, categories);
  populateSelect(elements.writerCategory, categories);
  state.category = "all";
  elements.categoryFilter.value = "all";
}

function getDomainCategories(domain) {
  return domain === "general" ? GENERAL_CATEGORIES : SUBSIDY_CATEGORIES;
}

function populateSelect(select, values, allLabel = "") {
  select.innerHTML = [
    allLabel ? `<option value="all">${escapeHtml(allLabel)}</option>` : "",
    ...values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`),
  ].join("");
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("pointermove", (event) => {
    quickHelpPoint = { x: event.clientX, y: event.clientY };
  });
  document.addEventListener("pointerover", handleQuickHelpOver);
  document.addEventListener("pointerout", handleQuickHelpOut);
  document.addEventListener("focusin", handleQuickHelpOver);
  document.addEventListener("focusout", hideQuickHelp);

  elements.form.addEventListener("submit", handleSubmit);
  elements.importFile.addEventListener("change", handleImport);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.loginDialog.addEventListener("cancel", (event) => {
    if (USE_SHARED && state.authRequired && !state.authenticated) event.preventDefault();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    render();
  });
  elements.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
  elements.toneFilter.addEventListener("change", (event) => {
    state.tone = event.target.value;
    render();
  });
  elements.recipientFilter.addEventListener("change", (event) => {
    state.recipient = event.target.value;
    render();
  });
  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  [
    elements.personInput,
    elements.companyInput,
    elements.topicInput,
    elements.deadlineInput,
    elements.senderInput,
  ].forEach((input) => input.addEventListener("input", renderDetail));

  [
    elements.writerCategory,
    elements.writerTone,
    elements.writerRecipient,
    elements.writerPerson,
    elements.writerPoint,
    elements.writerDeadline,
    elements.writerSender,
    elements.writerCare,
  ].forEach((input) => input.addEventListener("input", generateWriter));
}

function handleClick(event) {
  const domainTarget = event.target.closest("[data-domain]");
  if (domainTarget) {
    state.domain = domainTarget.dataset.domain;
    populateDomainSelects();
    render();
    return;
  }

  const viewTarget = event.target.closest("[data-view]");
  if (viewTarget) {
    state.view = viewTarget.dataset.view;
    render();
    return;
  }

  const tokenTarget = event.target.closest("[data-token]");
  if (tokenTarget) {
    insertToken(tokenTarget.dataset.token);
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    handleAction(actionTarget);
    return;
  }

  const card = event.target.closest("[data-template-card]");
  if (card) {
    state.selectedId = card.dataset.id;
    render();
  }
}

function handleAction(target) {
  const { action, id } = target.dataset;
  const targetId = id || state.selectedId;

  if (action === "new-template") openTemplateDialog();
  if (action === "edit-template") openTemplateDialog(targetId);
  if (action === "close-dialog") closeTemplateDialog();
  if (action === "delete-template") deleteEditingTemplate();
  if (action === "copy-template") copyTemplate(targetId);
  if (action === "copy-finished") copyFinished();
  if (action === "toggle-favorite") toggleFavorite(targetId);
  if (action === "export-json") exportJson();
  if (action === "logout") logoutSharedMode();
  if (action === "print-library") printLibrary();
  if (action === "reset-samples") resetSamples();
  if (action === "copy-claude") openClaudePrompt();
  if (action === "copy-claude-prompt") copyClaudePrompt();
  if (action === "close-claude") elements.claudeDialog.close();
  if (action === "open-writer") openWriter();
  if (action === "close-writer") elements.writerDialog.close();
  if (action === "generate-writer") generateWriter(true);
  if (action === "copy-writer") copyWriter();
  if (action === "save-writer-template") saveWriterTemplate();
  if (action === "writer-to-claude") openClaudePrompt(elements.writerOutput.textContent);
  if (action === "open-app-switcher") elements.appSwitcherDialog.showModal();
  if (action === "close-app-switcher") elements.appSwitcherDialog.close();
  if (action === "switch-to-phrase-stock") switchToPhraseStock();
  if (action === "open-help") elements.helpDialog.showModal();
  if (action === "close-help") elements.helpDialog.close();
}

function switchToPhraseStock() {
  const targetUrl = "/phrase-stock/";
  if (location.pathname === targetUrl) {
    elements.appSwitcherDialog.close();
    showToast("定型文ストックを表示中です");
    return;
  }
  location.href = targetUrl;
}

function handleSubmit(event) {
  event.preventDefault();

  const existing = state.templates.find((template) => template.id === state.editingId);
  const now = new Date().toISOString();
  const template = {
    id: existing?.id || createId(),
    key: existing?.key || `custom-${createId()}`,
    domain: existing?.domain || state.domain,
    title: elements.titleInput.value.trim(),
    category: elements.categoryInput.value,
    tone: elements.toneInput.value,
    recipient: elements.recipientInput.value,
    tags: parseTags(elements.tagsInput.value),
    body: elements.bodyInput.value.trim(),
    favorite: Boolean(existing?.favorite),
    copyCount: Number(existing?.copyCount || 0),
    lastUsedAt: existing?.lastUsedAt || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (!template.title || !template.body) return;

  if (existing) {
    state.templates = state.templates.map((item) => (item.id === template.id ? template : item));
    showToast("更新しました");
  } else {
    state.templates = [template, ...state.templates];
    showToast("追加しました");
  }

  state.selectedId = template.id;
  saveTemplates();
  closeTemplateDialog();
  render();
}

function render() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === state.view));
  });
  document.querySelectorAll("[data-domain]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.domain === state.domain));
  });

  const filtered = getFilteredTemplates();
  if (!filtered.some((template) => template.id === state.selectedId)) {
    state.selectedId = filtered[0]?.id || state.templates[0]?.id || null;
  }

  renderMetrics();
  renderList(filtered);
  renderDetail();
  setHelpAttributes();
  refreshIcons();
}

function renderMetrics() {
  const domainTemplates = state.templates.filter(matchesDomain);
  elements.totalCount.textContent = String(domainTemplates.length);
  elements.favoriteCount.textContent = String(domainTemplates.filter((template) => template.favorite).length);
  elements.copyCount.textContent = String(domainTemplates.reduce((sum, template) => sum + Number(template.copyCount || 0), 0));
  elements.categoryCount.textContent = String(new Set(domainTemplates.map((template) => template.category)).size);
}

function renderList(templates) {
  const domainLabel = state.domain === "general" ? "通常用" : "補助金用";
  elements.viewKicker.textContent = state.view === "favorite" ? `${domainLabel} / お気に入り` : state.view === "recent" ? `${domainLabel} / 最近使った` : `${domainLabel} / ストック`;
  elements.viewTitle.textContent = `${domainLabel} 定型文一覧`;
  elements.resultSummary.textContent = `${templates.length}件`;

  if (!templates.length) {
    elements.templateList.innerHTML = emptyState("inbox", "表示できる定型文がありません");
    return;
  }

  elements.templateList.innerHTML = templates.map(renderTemplateCard).join("");
}

function renderTemplateCard(template) {
  const selected = template.id === state.selectedId ? "selected" : "";
  const favorite = template.favorite ? "favorite" : "";
  const tags = template.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="template-card ${selected} ${favorite}" data-template-card data-id="${template.id}">
      <div>
        <div class="template-title">
          <span class="brand-mark" aria-hidden="true"><i data-lucide="${CATEGORY_ICONS[template.category] || "file-text"}"></i></span>
          <div>
            <h3>${escapeHtml(template.title)}</h3>
            <p>${escapeHtml(template.category)} / ${escapeHtml(template.tone)} / ${escapeHtml(template.recipient)}</p>
          </div>
        </div>
        <p class="template-body">${escapeHtml(template.body)}</p>
        <div class="template-meta">
          ${template.favorite ? `<span class="pill gold"><i data-lucide="star"></i>お気に入り</span>` : ""}
          <span class="pill blue"><i data-lucide="copy"></i>${template.copyCount || 0}回</span>
          ${tags}
        </div>
      </div>
      <div class="card-actions">
        <button class="icon-button" type="button" data-action="copy-template" data-id="${template.id}" aria-label="原文コピー">
          <i data-lucide="copy"></i>
        </button>
        <button class="icon-button ${template.favorite ? "is-active" : ""}" type="button" data-action="toggle-favorite" data-id="${template.id}" aria-label="お気に入り">
          <i data-lucide="star"></i>
        </button>
        <button class="icon-button" type="button" data-action="edit-template" data-id="${template.id}" aria-label="編集">
          <i data-lucide="pencil"></i>
        </button>
      </div>
    </article>
  `;
}

function renderDetail() {
  const template = getSelectedTemplate();
  const hasTemplate = Boolean(template);

  elements.detailEmpty.hidden = hasTemplate;
  elements.detailContent.hidden = !hasTemplate;
  elements.favoriteButton.hidden = !hasTemplate;

  if (!template) {
    elements.detailTitle.textContent = "文面プレビュー";
    elements.previewText.textContent = "";
    return;
  }

  elements.detailTitle.textContent = template.title;
  elements.favoriteButton.classList.toggle("is-active", template.favorite);
  elements.previewText.textContent = applyFields(template.body);
}

function getSelectedTemplate() {
  return state.templates.find((template) => template.id === state.selectedId) || null;
}

function getFilteredTemplates() {
  const query = state.query.toLowerCase();

  return state.templates
    .filter((template) => {
      const haystack = [template.title, template.body, template.category, template.tone, template.recipient, ...template.tags]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = state.category === "all" || template.category === state.category;
      const matchesTone = state.tone === "all" || template.tone === state.tone;
      const matchesRecipient = state.recipient === "all" || template.recipient === state.recipient;
      const matchesCurrentDomain = matchesDomain(template);
      const matchesView =
        state.view === "all" ||
        (state.view === "favorite" && template.favorite) ||
        (state.view === "recent" && template.lastUsedAt);
      return matchesCurrentDomain && matchesQuery && matchesCategory && matchesTone && matchesRecipient && matchesView;
    })
    .sort(sortTemplates);
}

function matchesDomain(template) {
  return (template.domain || inferDomain(template)) === state.domain;
}

function sortTemplates(a, b) {
  if (state.view === "recent") return String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || ""));
  if (state.sort === "used") return Number(b.copyCount || 0) - Number(a.copyCount || 0);
  if (state.sort === "title") return a.title.localeCompare(b.title, "ja");
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function openTemplateDialog(id = "") {
  const template = state.templates.find((item) => item.id === id);
  state.editingId = template?.id || null;

  elements.modalMode.textContent = template ? "編集" : "新規";
  elements.modalTitle.textContent = template ? "定型文を編集" : "定型文を追加";
  elements.titleInput.value = template?.title || "";
  elements.categoryInput.value = template?.category || getDomainCategories(state.domain)[0];
  elements.toneInput.value = template?.tone || "丁寧";
  elements.recipientInput.value = template?.recipient || "社外";
  elements.tagsInput.value = template?.tags?.join(", ") || "";
  elements.bodyInput.value = template?.body || defaultBody();
  elements.form.querySelector('[data-action="delete-template"]').hidden = !template;

  elements.dialog.showModal();
  requestAnimationFrame(() => elements.titleInput.focus());
  setHelpAttributes();
  refreshIcons();
}

function closeTemplateDialog() {
  elements.dialog.close();
  state.editingId = null;
}

function deleteEditingTemplate() {
  if (!state.editingId) return;
  const deletedId = state.editingId;
  const template = state.templates.find((item) => item.id === state.editingId);
  if (!window.confirm(`「${template?.title || "この定型文"}」を削除しますか？`)) return;

  state.templates = state.templates.filter((item) => item.id !== state.editingId);
  state.selectedId = state.templates[0]?.id || null;
  saveTemplates({ deletedIds: [deletedId] });
  closeTemplateDialog();
  render();
  showToast("削除しました");
}

function insertToken(token) {
  const input = elements.bodyInput;
  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;
  input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
}

async function copyTemplate(id) {
  const template = state.templates.find((item) => item.id === id);
  if (!template) return;
  await copyText(template.body);
  markCopied(template.id);
  showToast("原文をコピーしました");
}

async function copyFinished() {
  const template = getSelectedTemplate();
  if (!template) return;
  await copyText(elements.previewText.textContent);
  markCopied(template.id);
  showToast("差し込み済みの文面をコピーしました");
}

function markCopied(id) {
  const now = new Date().toISOString();
  state.templates = state.templates.map((template) => {
    if (template.id !== id) return template;
    return {
      ...template,
      copyCount: Number(template.copyCount || 0) + 1,
      lastUsedAt: now,
    };
  });
  saveTemplates();
  render();
}

function toggleFavorite(id) {
  if (!id) return;
  state.templates = state.templates.map((template) => {
    if (template.id !== id) return template;
    return { ...template, favorite: !template.favorite, updatedAt: new Date().toISOString() };
  });
  saveTemplates();
  render();
}

function applyFields(body) {
  const replacements = {
    "{相手名}": elements.personInput.value.trim() || "〇〇様",
    "{会社名}": elements.companyInput.value.trim() || "貴社",
    "{案件名}": elements.topicInput.value.trim() || "本件",
    "{期限}": elements.deadlineInput.value.trim() || "ご都合のよいタイミング",
    "{差出人}": elements.senderInput.value.trim() || "",
  };

  return Object.entries(replacements).reduce((text, [token, value]) => text.replaceAll(token, value), body);
}

function openClaudePrompt(sourceText = "") {
  const template = getSelectedTemplate();
  const text = sourceText || (template ? elements.previewText.textContent || template.body : "");
  const category = template?.category || elements.writerCategory.value || "その他";
  const tone = template?.tone || elements.writerTone.value || "丁寧";
  const recipient = template?.recipient || elements.writerRecipient.value || "社外";

  elements.claudePrompt.value = buildClaudePrompt(text, { category, tone, recipient });
  elements.claudeDialog.showModal();
  requestAnimationFrame(() => elements.claudePrompt.focus());
  setHelpAttributes();
  refreshIcons();
}

function buildClaudePrompt(text, meta) {
  return `以下の定型文を、Green Partnershipの補助金顧問サービスでそのまま使える自然な日本語に整えてください。

用途: ${meta.category}
宛先: ${meta.recipient}
希望する温度感: ${meta.tone}

整えるときの方針:
- 補助金業務の文脈に合う、信頼感のある表現にする
- へりくだりすぎず、でも丁寧にする
- 相手に確認・修正・提出をお願いする場合は、負担が軽く感じられる言い方にする
- 必要な行動、期限、次にすることが一読で分かるようにする
- そのままメールやチャットに貼れる本文だけを出す
- 不確かな制度名や金額は断定せず、確認前提の表現にする

元の文面:
${text || "ここに文面を入れてください。"}`;
}

async function copyClaudePrompt() {
  await copyText(elements.claudePrompt.value);
  showToast("Claude用の依頼文をコピーしました");
}

function openWriter() {
  elements.writerDialog.showModal();
  generateWriter();
  requestAnimationFrame(() => elements.writerPoint.focus());
  setHelpAttributes();
  refreshIcons();
}

function generateWriter(showMessage = false) {
  const output = composeNaturalText({
    category: elements.writerCategory.value || "初回対応",
    tone: elements.writerTone.value || "丁寧",
    recipient: elements.writerRecipient.value || "社外",
    person: elements.writerPerson.value.trim(),
    point: elements.writerPoint.value.trim(),
    deadline: elements.writerDeadline.value.trim(),
    sender: elements.writerSender.value.trim(),
    care: elements.writerCare.value.trim(),
  });

  elements.writerOutput.textContent = output;
  if (showMessage) showToast("文章を作りました");
}

function composeNaturalText(input) {
  const point = sentence(input.point || "ご相談したい内容があります");
  const intro = greeting(input.recipient, input.person);
  const close = closing(input.tone, input.recipient);
  const sender = input.sender ? `\n\n${input.sender}` : "";
  const care = input.care ? `\n\n${sentence(input.care)}` : "";
  const deadline = input.deadline ? input.deadline : "";

  if (input.category === "申請書修正") {
    return `${intro}\n\n${point}\n\n申請内容の精度を高めるため、該当箇所をもう少し具体的に整えたいと考えています。\nお手数ですが、${deadline ? `${deadline}までに` : ""}追加情報や修正案をご共有いただけますでしょうか。\nこちらで申請書全体の流れに合わせて整えますので、箇条書きでも問題ありません。${care}\n\n${close}${sender}`;
  }

  if (input.category === "交付申請") {
    return `${intro}\n\n${point}\n\n交付申請は、採択後に正式な補助対象経費を確定する大切な手続きです。\n発注・契約の前に確認が必要な点があるため、${deadline ? `${deadline}までに` : ""}関連資料をご共有いただけますでしょうか。\n内容を確認し、不足や修正があればこちらから整理してご連絡します。${care}\n\n${close}${sender}`;
  }

  if (input.category === "実績報告") {
    return `${intro}\n\n${point}\n\n実績報告では、発注・納品・支払い・事業実施の証拠資料をそろえる必要があります。\nお手数ですが、${deadline ? `${deadline}までに` : ""}お手元の資料をご共有ください。\n不足がある場合は、こちらで確認項目を整理してご案内します。${care}\n\n${close}${sender}`;
  }

  if (input.category === "紹介パートナー") {
    return `${intro}\n\n${point}\n\nご紹介後の初回対応、ヒアリング、申請支援は弊社で進めます。\n進捗があり次第、貴社にも分かりやすく共有いたしますので、まずは分かる範囲で情報をご共有いただけますと幸いです。${care}\n\n${close}${sender}`;
  }

  if (input.category === "採択後連絡") {
    return `${intro}\n\n${point}\n\n採択後は、交付申請、事業実施、実績報告という順番で手続きが進みます。\n発注や契約のタイミングを誤ると補助対象外になる可能性があるため、次の手順を確認しながら進めましょう。${care}\n\n${close}${sender}`;
  }

  if (input.category === "日程調整") {
    return `${intro}\n\n${point}\n\n差し支えなければ、${deadline ? `${deadline}までに` : ""}ご都合のよい日時をいくつかお知らせいただけますでしょうか。\nこちらでも調整いたしますので、ご無理のない範囲でご返信いただけますと幸いです。${care}\n\n${close}${sender}`;
  }

  if (input.category === "お礼") {
    return `${intro}\n\n${point}\n\nお忙しい中ご対応いただき、ありがとうございました。\nいただいた内容を踏まえて、こちらでも次の進め方を整理いたします。${care}\n\n${close}${sender}`;
  }

  if (input.category === "催促・確認") {
    return `${intro}\n\n${point}\n\n念のための確認で恐縮ですが、${deadline ? `${deadline}頃までに` : ""}状況をお知らせいただけますでしょうか。\n行き違いでしたら申し訳ありません。ご確認いただけますと助かります。${care}\n\n${close}${sender}`;
  }

  if (input.category === "お断り") {
    return `${intro}\n\n${point}\n\nせっかくお声がけいただいたところ恐縮ですが、今回は見送らせていただければと思います。\nまた状況が合う機会がありましたら、ぜひ改めてご相談させてください。${care}\n\n${close}${sender}`;
  }

  if (input.category === "お詫び") {
    return `${intro}\n\n${point}\n\nこちらの確認が行き届かず、ご迷惑をおかけして申し訳ありません。\n今後同じことが起きないよう、対応内容を見直したうえで進めてまいります。${care}\n\n${close}${sender}`;
  }

  if (input.category === "依頼") {
    return `${intro}\n\n${point}\n\nお手数をおかけしますが、${deadline ? `${deadline}までに` : ""}ご対応いただくことは可能でしょうか。\n難しい場合は、調整できる範囲で構いませんのでお知らせください。${care}\n\n${close}${sender}`;
  }

  if (input.category === "社内連絡") {
    return `${greeting("社内", input.person)}\n\n${point}\n\n確認が必要な点があれば、このスレッドで教えてください。\n問題なければ、この内容で進めます。${care}${sender}`;
  }

  if (input.category === "SNS・投稿") {
    return `${point}\n\n必要な方に届くよう、要点だけ分かりやすくまとめました。${care}`;
  }

  return `${intro}\n\n${point}\n\nご確認いただき、必要があればお知らせください。${care}\n\n${close}${sender}`;
}

function greeting(recipient, person) {
  const name = person ? `${person}\n\n` : "";
  if (recipient === "社内") return `${name}お疲れさまです。`;
  if (recipient === "SNS") return "";
  return `${name}お世話になっております。`;
}

function closing(tone, recipient) {
  if (recipient === "社内") return "よろしくお願いします。";
  if (tone === "簡潔") return "よろしくお願いいたします。";
  if (tone === "やわらかい") return "どうぞよろしくお願いいたします。";
  if (tone === "かなり丁寧") return "お手数をおかけいたしますが、何卒よろしくお願い申し上げます。";
  if (tone === "親しみ") return "引き続き、よろしくお願いいたします。";
  return "よろしくお願いいたします。";
}

function sentence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return /[。.!?！？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

async function copyWriter() {
  const text = elements.writerOutput.textContent.trim();
  if (!text) return;
  await copyText(text);
  showToast("作成した文章をコピーしました");
}

function saveWriterTemplate() {
  const body = elements.writerOutput.textContent.trim();
  if (!body) return;

  const titleSeed = elements.writerPoint.value.trim().replace(/\s+/g, " ").slice(0, 22);
  const now = new Date().toISOString();
  const template = {
    id: createId(),
    key: `writer-${createId()}`,
    domain: state.domain,
    title: titleSeed ? `${elements.writerCategory.value}：${titleSeed}` : `${elements.writerCategory.value}の定型文`,
    category: elements.writerCategory.value,
    tone: elements.writerTone.value,
    recipient: elements.writerRecipient.value,
    tags: ["作成"],
    body,
    favorite: false,
    copyCount: 0,
    lastUsedAt: "",
    createdAt: now,
    updatedAt: now,
  };

  state.templates = [template, ...state.templates];
  state.selectedId = template.id;
  saveTemplates();
  elements.writerDialog.close();
  render();
  showToast("定型文として保存しました");
}

function renderHelp() {
  const sections = [
    {
      title: "基本の使い方",
      items: [
        ["検索", "左上の検索欄にタイトル、本文、タグの一部を入力すると、該当する定型文だけに絞り込めます。補助金名、工程名、相手先、資料名などを入れて探せます。"],
        ["通常用 / 補助金用", "左側の「種類」で、一般的なビジネス文面と補助金業務専用文面を切り替えます。通常用は日程調整・お礼・催促など、補助金用は交付申請・実績報告・採択後連絡などに絞って表示します。"],
        ["定型文一覧", "中央の一覧から使いたい文面を選びます。カードには用途、温度感、宛先、コピー回数、タグが表示されます。よく使う文面は星でお気に入りにできます。"],
        ["文面プレビュー", "右側のプレビューでは、相手名、会社名、案件名、期限、差出人を差し込んだ文面を確認できます。実際に送る前に、ここで文面の雰囲気を確認してください。"],
        ["クラウド共有", "Render公開版はトップURLだけで開けます。パスワードでログインすると、複数端末・複数社員で同じ定型文データを検索、追加、編集できます。"],
      ],
    },
    {
      title: "上部ボタン",
      items: [
        ["控え保存", "現在の定型文データをJSONファイルとして保存します。別のPCに移すとき、念のためバックアップを残すとき、作業前の状態に戻せるようにしたいときに使います。"],
        ["控え読込", "控え保存で作ったJSONファイルを読み込みます。読み込むと現在の保存内容がそのファイルの内容に置き換わるため、必要なら先に控え保存をしてください。"],
        ["？ ヘルプ", "この画面です。全体の操作方法、各ボタンの意味、補助金業務での使いどころを詳しく確認できます。"],
        ["Claude用", "選択中の文面をClaude Webに貼り付ける改善依頼文に変換します。API連携ではなく、コピーしてClaudeの画面へ貼る方式なので、ログイン状態に左右されにくい運用ができます。"],
        ["作成", "要点を短く入力すると、用途と温度感に合わせてアプリ内で自然な文章を作ります。完全なAI生成ではありませんが、補助金業務で使いやすい丁寧な型に整えます。"],
        ["追加", "新しい定型文を登録します。本文には {相手名} や {案件名} などの差し込み語を入れられます。"],
      ],
    },
    {
      title: "出力",
      items: [
        ["定型文集を印刷", "CSVではなく、表示中の通常用または補助金用の定型文を読みやすい一覧ページに整えます。ブラウザの印刷機能から紙で印刷したり、PDFとして保存したりできます。共有用やお客様説明用の控えとして使いやすい形式です。"],
        ["控え保存", "データの復元や移行が目的の場合は、右上の控え保存を使います。こちらは見た目の資料ではなく、アプリに戻すためのバックアップです。"],
      ],
    },
    {
      title: "定型文カードのボタン",
      items: [
        ["コピー", "カード内の原文をそのままコピーします。差し込み語を残したテンプレートとして別の場所に貼りたい場合に便利です。"],
        ["星", "お気に入り登録です。よく使う文面をお気に入りにしておくと、左側の「お気に入り」表示からすぐ探せます。"],
        ["鉛筆", "定型文を編集します。分類、タグ、本文、温度感を変えたいときに使います。Green Partnershipの運用に合わせて自由に育ててください。"],
      ],
    },
    {
      title: "右側プレビューのボタン",
      items: [
        ["コピー", "相手名、会社名、案件名、期限、差出人を差し込んだ完成文をコピーします。実際にメールやチャットに貼るときは基本的にこのボタンを使います。"],
        ["Claude用", "プレビューに表示されている完成文をClaudeに整えてもらうための依頼文にします。文章をさらに自然にしたい、少し柔らかくしたい、相手に合わせたい場合に使います。"],
        ["編集", "選択中の定型文そのものを編集します。毎回直している言い回しがあれば、ここから元の文面を改善しておくと次回が楽になります。"],
      ],
    },
    {
      title: "補助金業務での使い方",
      items: [
        ["交付申請", "採択後に必要な交付申請の連絡、資料依頼、見積修正依頼、発注前注意などを登録しています。発注・契約のタイミングを誤ると補助対象外になり得るため、文面で注意喚起できるようにしています。"],
        ["実績報告", "納品書、請求書、振込控え、写真、実施内容の確認、修正依頼など、実績報告で頻出する連絡を用意しています。資料不足をやわらかく伝える文面も含めています。"],
        ["紹介パートナー", "紹介受付、初回ヒアリング完了、契約済み、申請中、採択報告、紹介報酬支払い案内など、パートナーへの進捗共有に使う文面を入れています。"],
        ["契約・プラン", "ミニ、スタンダード、プレミアム、プラン変更、解約条件、月次配信、チャット相談など、料金プラン資料の内容に沿った説明文を使えます。"],
      ],
    },
    {
      title: "マウス停止時の説明",
      items: [
        ["簡易ヘルプ", "各ボタンの上でマウスを少し止めると、そのボタンの簡単な説明が表示されます。マウスを外すと自動で消えます。お客様に画面を見せながら説明するときにも使えます。"],
        ["詳しい説明", "より詳しい説明は右上の「？」から確認します。運用担当者への引き継ぎや、初めて使う人への説明に使えるよう、かなり詳しめに書いています。"],
      ],
    },
  ];

  elements.helpContent.innerHTML = `
    <p class="help-intro">
      このアプリは、Green Partnershipの補助金顧問業務で使うメール・チャット文面を整理し、
      お客様や紹介パートナーにそのまま送れる形へ整えるための定型文ストックです。
      API連携を使わず、必要に応じてClaude Webへ貼り付ける依頼文も作れます。
    </p>
    ${sections
      .map(
        (section) => `
          <section class="help-section">
            <h3>${escapeHtml(section.title)}</h3>
            <dl class="help-list">
              ${section.items
                .map(
                  ([term, description]) => `
                    <div class="help-item">
                      <dt>${escapeHtml(term)}</dt>
                      <dd>${escapeHtml(description)}</dd>
                    </div>
                  `,
                )
                .join("")}
            </dl>
          </section>
        `,
      )
      .join("")}
  `;
}

function setHelpAttributes() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    const text = HELP_TEXT.action[button.dataset.action];
    if (text) {
      button.dataset.help = text;
      if (!button.getAttribute("title")) button.setAttribute("title", text);
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    const text = HELP_TEXT.view[button.dataset.view];
    if (text) {
      button.dataset.help = text;
      if (!button.getAttribute("title")) button.setAttribute("title", text);
    }
  });

  document.querySelectorAll("[data-domain]").forEach((button) => {
    const text = HELP_TEXT.domain[button.dataset.domain];
    if (text) {
      button.dataset.help = text;
      if (!button.getAttribute("title")) button.setAttribute("title", text);
    }
  });

  document.querySelectorAll("[data-token]").forEach((button) => {
    const token = button.dataset.token;
    button.dataset.help = `${token} を本文のカーソル位置に挿入します。プレビューで実際の名前や案件名に置き換わります。`;
  });

  document.querySelectorAll(".file-button").forEach((button) => {
    button.dataset.help = "控え保存で作成したJSONファイルを読み込み、定型文データを復元します。";
  });
}

function handleQuickHelpOver(event) {
  const target = event.target.closest?.("[data-help]");
  if (!target) return;
  quickHelpTarget = target;
  window.clearTimeout(quickHelpTimer);
  quickHelpTimer = window.setTimeout(() => showQuickHelp(target), 650);
}

function handleQuickHelpOut(event) {
  if (!quickHelpTarget) return;
  const next = event.relatedTarget;
  if (next && quickHelpTarget.contains(next)) return;
  hideQuickHelp();
}

function showQuickHelp(target) {
  if (!target || !target.dataset.help) return;
  elements.quickHelp.textContent = target.dataset.help;
  const x = Math.min(quickHelpPoint.x + 14, window.innerWidth - 360);
  const y = Math.min(quickHelpPoint.y + 18, window.innerHeight - 110);
  elements.quickHelp.style.left = `${Math.max(12, x)}px`;
  elements.quickHelp.style.top = `${Math.max(12, y)}px`;
  elements.quickHelp.classList.add("visible");
}

function hideQuickHelp() {
  window.clearTimeout(quickHelpTimer);
  quickHelpTarget = null;
  elements.quickHelp.classList.remove("visible");
}

async function initializeSharedMode() {
  try {
    const session = await apiJson(API_SESSION);
    state.authRequired = Boolean(session.authRequired);
    state.authenticated = Boolean(session.authenticated);
    state.sharedUser = session.user || "";
    state.sharedReady = Boolean(session.authenticated);
    updateSharedControls();

    if (session.authenticated) {
      await loadSharedTemplates();
      startSharedPolling();
      return;
    }

    showLoginDialog();
  } catch {
    state.sharedReady = false;
    state.authenticated = false;
    updateSharedControls();
    showToast("社内共有サーバーに接続できませんでした");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginMessage.textContent = "";
  const submitButton = elements.loginForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const result = await apiJson(API_LOGIN, {
      method: "POST",
      body: {
        password: elements.loginPassword.value,
      },
    });

    state.authenticated = true;
    state.sharedReady = true;
    state.sharedUser = result.user || "member";
    elements.loginPassword.value = "";
    elements.loginDialog.close();
    updateSharedControls();
    await loadSharedTemplates();
    startSharedPolling();
    showToast("社内共有データにログインしました");
  } catch {
    elements.loginMessage.textContent = "ログイン情報が正しくありません。";
  } finally {
    submitButton.disabled = false;
  }
}

async function logoutSharedMode() {
  if (!USE_SHARED) return;
  try {
    await apiJson(API_LOGOUT, { method: "POST" });
  } catch {}

  state.authenticated = false;
  state.sharedReady = false;
  state.sharedUser = "";
  stopSharedPolling();
  updateSharedControls();
  showLoginDialog();
  showToast("ログアウトしました");
}

function showLoginDialog() {
  if (!USE_SHARED || !state.authRequired || state.authenticated) return;
  if (!elements.loginDialog.open) elements.loginDialog.showModal();
  window.setTimeout(() => elements.loginPassword.focus(), 50);
}

function updateSharedControls() {
  if (!elements.logoutButton) return;
  elements.logoutButton.hidden = !(USE_SHARED && state.authRequired && state.authenticated);
}

async function loadSharedTemplates() {
  try {
    if (sharedSaving || hasOpenWorkDialog()) return;
    const payload = await apiJson(API_TEMPLATES);
    const remote = Array.isArray(payload.templates) ? payload.templates.map(normalizeTemplate) : [];
    state.sharedRevision = Number(payload.revision || 0);
    state.templates = mergeMissingBuiltIns(remote.length ? remote : state.templates);
    state.selectedId = state.templates[0]?.id || null;
    localStorage.setItem(STORE_KEY, JSON.stringify(state.templates));
    render();

    if (!remote.length) {
      await persistSharedTemplates({ replace: true });
    }
  } catch {
    showLoginDialog();
    showToast("社内共有データを読み込めませんでした");
  }
}

function startSharedPolling() {
  stopSharedPolling();
  if (!USE_SHARED) return;
  sharedPollTimer = window.setInterval(() => {
    if (state.authenticated && state.sharedReady) loadSharedTemplates();
  }, 15000);
}

function stopSharedPolling() {
  window.clearInterval(sharedPollTimer);
  sharedPollTimer = null;
}

function hasOpenWorkDialog() {
  return elements.dialog.open || elements.writerDialog.open || elements.claudeDialog.open || elements.helpDialog.open || elements.appSwitcherDialog.open || elements.loginDialog.open;
}

function queueSharedSave(options = {}) {
  if (!USE_SHARED || !state.sharedReady || !state.authenticated) return;
  if (options.replace) pendingSharedSave.replace = true;
  if (Array.isArray(options.deletedIds)) {
    pendingSharedSave.deletedIds = [...new Set([...pendingSharedSave.deletedIds, ...options.deletedIds.map(String)])];
  }

  window.clearTimeout(sharedSaveTimer);
  sharedSaveTimer = window.setTimeout(() => {
    persistSharedTemplates();
  }, 350);
}

async function persistSharedTemplates(options = {}) {
  if (!USE_SHARED || !state.sharedReady || !state.authenticated) return;
  if (sharedSaving) {
    queueSharedSave(options);
    return;
  }

  sharedSaving = true;
  const saveOptions = {
    deletedIds: [...new Set([...(pendingSharedSave.deletedIds || []), ...(options.deletedIds || []).map(String)])],
    replace: Boolean(pendingSharedSave.replace || options.replace),
  };
  pendingSharedSave = { deletedIds: [], replace: false };

  try {
    const result = await apiJson(API_TEMPLATES, {
      method: "PUT",
      body: {
        templates: state.templates,
        baseRevision: state.sharedRevision,
        deletedIds: saveOptions.deletedIds,
        replace: saveOptions.replace,
      },
    });
    state.sharedRevision = Number(result.revision || state.sharedRevision);
    if (result.merged && Array.isArray(result.templates)) {
      state.templates = mergeMissingBuiltIns(result.templates.map(normalizeTemplate));
      state.selectedId = state.templates[0]?.id || null;
      localStorage.setItem(STORE_KEY, JSON.stringify(state.templates));
      render();
      showToast("他端末の変更と統合しました");
    }
  } catch {
    showToast("社内共有データの保存に失敗しました");
  } finally {
    sharedSaving = false;
  }
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && USE_SHARED) {
      state.authenticated = false;
      state.sharedReady = false;
      updateSharedControls();
      showLoginDialog();
    }
    throw new Error(payload.message || "request failed");
  }
  return payload;
}

function exportJson() {
  const payload = {
    app: "定型文ストック",
    mode: MODE,
    version: 2,
    exportedAt: new Date().toISOString(),
    templates: state.templates,
  };
  downloadFile(`phrase-stock-${MODE}-${toYmd(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
  showToast("控えファイルを保存しました");
}

function printLibrary() {
  const templates = getFilteredTemplates();
  const domainLabel = state.domain === "general" ? "通常用" : "補助金用";
  const opened = window.open("", "_blank");

  if (!opened) {
    showToast("印刷画面を開けませんでした");
    return;
  }

  opened.document.write(`<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <title>定型文集 - ${escapeHtml(domainLabel)}</title>
        <style>
          body { margin: 32px; color: #142225; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Yu Gothic UI", sans-serif; line-height: 1.7; }
          header { border-bottom: 2px solid #19605d; padding-bottom: 14px; margin-bottom: 22px; }
          h1 { margin: 0; font-size: 24px; }
          .meta { color: #5f6f72; margin-top: 4px; }
          article { break-inside: avoid; border: 1px solid #d9e2df; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; }
          h2 { margin: 0 0 4px; font-size: 17px; }
          .tags { color: #19605d; font-size: 12px; margin-bottom: 10px; }
          pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; }
          @media print { body { margin: 18mm; } button { display: none; } }
        </style>
      </head>
      <body>
        <header>
          <h1>定型文集 - ${escapeHtml(domainLabel)}</h1>
          <div class="meta">出力日: ${escapeHtml(toYmd(new Date()))} / 件数: ${templates.length}件</div>
        </header>
        <button onclick="window.print()">印刷 / PDF保存</button>
        ${templates
          .map(
            (template) => `<article>
              <h2>${escapeHtml(template.title)}</h2>
              <div class="tags">${escapeHtml(template.category)} / ${escapeHtml(template.tone)} / ${escapeHtml(template.recipient)} / ${escapeHtml(template.tags.join("、"))}</div>
              <pre>${escapeHtml(template.body)}</pre>
            </article>`,
          )
          .join("")}
      </body>
    </html>`);
  opened.document.close();
  showToast("定型文集を開きました");
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const imported = Array.isArray(parsed) ? parsed : parsed.templates;
      if (!Array.isArray(imported)) throw new Error("invalid");
      state.templates = mergeMissingBuiltIns(imported.map(normalizeTemplate));
      state.selectedId = state.templates[0]?.id || null;
      saveTemplates({ replace: true });
      render();
      showToast("控えファイルを読み込みました");
    } catch {
      showToast("読み込めませんでした");
    } finally {
      elements.importFile.value = "";
    }
  });
  reader.readAsText(file, "utf-8");
}

function resetSamples() {
  if (!window.confirm("現在の保存データをGreen Partnership向けの初期定型文に置き換えますか？")) return;
  state.templates = sampleTemplates();
  state.selectedId = state.templates[0]?.id || null;
  saveTemplates({ replace: true });
  render();
  showToast("初期定型文に戻しました");
}

function loadTemplates() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return mergeMissingBuiltIns(parsed.map(normalizeTemplate));
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return mergeMissingBuiltIns(parsed.map(normalizeTemplate));
    }
  } catch {
    localStorage.removeItem(STORE_KEY);
  }
  return sampleTemplates();
}

function saveTemplates(options = {}) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.templates));
  queueSharedSave(options);
}

function mergeMissingBuiltIns(saved) {
  const seen = new Set(saved.map((template) => template.key || template.title));
  const missing = sampleTemplates().filter((template) => !seen.has(template.key) && !seen.has(template.title));
  return [...saved, ...missing];
}

function normalizeTemplate(template) {
  const now = new Date().toISOString();
  return {
    id: String(template?.id || createId()),
    key: String(template?.key || template?.title || createId()),
    domain: template?.domain === "general" || template?.domain === "subsidy" ? template.domain : inferDomain(template),
    title: String(template?.title || "無題の定型文").slice(0, 80),
    category: CATEGORIES.includes(template?.category) ? template.category : "その他",
    tone: TONES.includes(template?.tone) ? template.tone : "丁寧",
    recipient: RECIPIENTS.includes(template?.recipient) ? template.recipient : "社外",
    tags: Array.isArray(template?.tags) ? template.tags.map(String).slice(0, 10) : parseTags(template?.tags || ""),
    body: String(template?.body || "").slice(0, 3000),
    favorite: Boolean(template?.favorite),
    copyCount: Math.max(0, Number(template?.copyCount || 0)),
    lastUsedAt: String(template?.lastUsedAt || ""),
    createdAt: template?.createdAt || now,
    updatedAt: template?.updatedAt || now,
  };
}

function sampleTemplates() {
  const now = new Date().toISOString();
  return BUILT_IN_TEMPLATES.map((row, index) => ({
    id: createId(),
    key: row.key || `builtin-${index + 1}`,
    domain: row.domain || inferDomain(row),
    copyCount: 0,
    lastUsedAt: "",
    createdAt: now,
    updatedAt: now,
    favorite: false,
    ...row,
  }));
}

function inferDomain(template) {
  const text = [
    template?.title,
    template?.category,
    Array.isArray(template?.tags) ? template.tags.join(" ") : template?.tags,
    template?.body,
  ]
    .filter(Boolean)
    .join(" ");

  if (SUBSIDY_CATEGORIES.includes(template?.category) && !GENERAL_CATEGORIES.includes(template?.category)) {
    return "subsidy";
  }

  if (/(補助金|交付申請|実績報告|採択|Gビズ|申請書|申請|顧問|紹介パートナー|事業計画|証憑|成功報酬|省力化|持続化|ものづくり|新事業|月次配信|交付決定)/.test(text)) {
    return "subsidy";
  }

  return "general";
}

const BUILT_IN_TEMPLATES = [
  tpl("general-schedule-options", "日程候補を送る", "日程調整", "丁寧", "社外", ["候補日", "メール"], true, `{相手名}

お世話になっております。
{案件名}について、打ち合わせ候補日をお送りいたします。

差し支えなければ、{期限}までにご都合のよい日時をお知らせいただけますでしょうか。
もし合う日程がなければ、別日程でも調整いたします。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("general-meeting-thanks", "打ち合わせ後のお礼", "お礼", "やわらかい", "社外", ["商談後", "フォロー"], true, `{相手名}

本日はお時間をいただき、ありがとうございました。
{案件名}について詳しく伺うことができ、こちらでも進め方を具体的に整理できました。

いただいた内容を踏まえて、次のご提案を準備いたします。
引き続き、どうぞよろしくお願いいたします。

{差出人}`),
  tpl("general-soft-reminder", "やわらかい確認催促", "催促・確認", "やわらかい", "取引先", ["確認", "催促しすぎない"], true, `{相手名}

お世話になっております。
{案件名}について、念のため確認のご連絡です。

お忙しいところ恐れ入りますが、{期限}頃までに状況をお知らせいただけますでしょうか。
行き違いでしたら申し訳ありません。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("general-document-request", "資料送付のお願い", "依頼", "丁寧", "社外", ["資料", "お願い"], false, `{相手名}

お世話になっております。
{案件名}を進めるにあたり、確認したい資料がございます。

お手数をおかけしますが、{期限}までにご共有いただくことは可能でしょうか。
難しい場合は、準備できる範囲からで問題ありません。

よろしくお願いいたします。
{差出人}`),
  tpl("general-estimate-send", "見積書の送付", "見積・請求", "丁寧", "取引先", ["見積", "送付"], false, `{相手名}

お世話になっております。
{案件名}のお見積りをお送りいたします。

内容をご確認いただき、気になる点や修正が必要な箇所がございましたらお知らせください。
問題なければ、この内容で進めさせていただきます。

よろしくお願いいたします。
{差出人}`),
  tpl("general-invoice-send", "請求書の送付", "見積・請求", "丁寧", "取引先", ["請求", "送付"], false, `{相手名}

お世話になっております。
{案件名}の請求書をお送りいたします。

内容をご確認いただき、問題がなければ{期限}までにお手続きいただけますと幸いです。
ご不明点や修正が必要な点がございましたら、お知らせください。

よろしくお願いいたします。
{差出人}`),
  tpl("general-payment-thanks", "入金確認のお礼", "見積・請求", "丁寧", "取引先", ["入金", "お礼"], false, `{相手名}

お世話になっております。
ご入金を確認いたしました。
お手続きいただき、ありがとうございます。

引き続き、{案件名}について丁寧に進めてまいります。
ご不明点がありましたら、いつでもお知らせください。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("general-polite-decline", "丁寧なお断り", "お断り", "かなり丁寧", "社外", ["見送り", "失礼なく"], false, `{相手名}

お世話になっております。
このたびは{案件名}についてお声がけいただき、誠にありがとうございます。

せっかくご提案いただいたところ恐縮ですが、今回は見送らせていただければと存じます。
また状況が合う機会がございましたら、ぜひ改めてご相談させてください。

何卒よろしくお願いいたします。
{差出人}`),
  tpl("general-delay-apology", "返信遅れのお詫び", "お詫び", "かなり丁寧", "社外", ["遅延", "お詫び"], false, `{相手名}

お世話になっております。
ご返信が遅くなり、申し訳ありません。

{案件名}について、内容を確認したうえでご連絡いたしました。
お待たせしてしまった分、今後の進め方が分かりやすいよう整理して対応いたします。

引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("general-meeting-minutes", "議事メモの送付", "案内", "丁寧", "社外", ["議事録", "共有"], false, `{相手名}

お世話になっております。
本日の{案件名}について、議事メモをお送りします。

認識違いや補足がありましたら、お知らせください。
問題なければ、この内容をもとに次の対応を進めます。

よろしくお願いいたします。
{差出人}`),
  tpl("general-internal-share", "社内への共有", "社内連絡", "簡潔", "社内", ["共有", "報告"], false, `{相手名}

お疲れさまです。
{案件名}について、現時点の状況を共有します。

確認が必要な点があれば、{期限}までにこのスレッドで教えてください。
問題なければ、この内容で進めます。

{差出人}`),
  tpl("general-review-request", "社内レビュー依頼", "社内連絡", "簡潔", "社内", ["レビュー", "確認"], false, `{相手名}

お疲れさまです。
{案件名}の内容確認をお願いします。

確認してほしい点は以下です。
・相手に伝わりにくい表現がないか
・依頼内容と期限が明確か
・抜け漏れがないか

可能であれば、{期限}までにコメントをお願いします。
{差出人}`),
  tpl("general-event-guide", "イベント・案内文", "案内", "やわらかい", "顧客", ["案内", "参加"], false, `{相手名}

お世話になっております。
{案件名}について、内容が決まりましたのでご案内いたします。

ご都合が合いましたら、ぜひご参加ください。
ご不明な点があれば、遠慮なくお知らせいただければと思います。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("general-sns-short", "SNS告知の短文", "SNS・投稿", "親しみ", "SNS", ["告知", "短文"], false, `{案件名}についてお知らせです。

必要な方に届くよう、要点だけ分かりやすくまとめました。
気になる方はぜひチェックしてみてください。`),
  tpl("initial-inquiry-thanks", "無料相談のお問い合わせ返信", "初回対応", "丁寧", "顧客", ["初回", "無料相談"], true, `{相手名}

お世話になっております。
Green Partnershipの{差出人}です。

このたびは補助金顧問サービスについてお問い合わせいただき、ありがとうございます。
まずは貴社の事業内容、今後予定されている投資、活用できそうな補助金の方向性を確認できればと思います。

差し支えなければ、{期限}頃で30分ほどお時間をいただけますでしょうか。
オンラインで概要を伺い、対象になりそうな制度や進め方を分かりやすくご案内いたします。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("partner-referral-received", "紹介受付のお礼", "紹介パートナー", "丁寧", "取引先", ["紹介", "受付"], true, `{相手名}

お世話になっております。
ご紹介いただき、誠にありがとうございます。

いただいた情報をもとに、弊社からお客様へ初回のご連絡をいたします。
初回ヒアリングでは、設備投資・販路開拓・DX・人手不足対策などの状況を伺い、活用できそうな補助金の方向性を確認します。

進捗があり次第、貴社にも分かりやすく共有いたします。
引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("customer-referred-first-contact", "紹介先のお客様への初回連絡", "初回対応", "丁寧", "顧客", ["紹介", "初回"], true, `{相手名}

突然のご連絡失礼いたします。
Green Partnershipの{差出人}です。

このたび、{会社名}様より補助金活用についてご紹介をいただき、ご連絡いたしました。
弊社では、補助金情報のご案内から事業計画の整理、申請支援、採択後の手続きまで伴走しております。

まずは無料相談として、現在ご検討中の投資内容やお困りごとを伺えればと思います。
差し支えなければ、{期限}頃でご都合のよい日時をいくつかお知らせいただけますでしょうか。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("hearing-sheet-request", "ヒアリング項目の事前依頼", "ヒアリング", "丁寧", "顧客", ["事前確認", "ヒアリング"], false, `{相手名}

お世話になっております。
{案件名}の初回ヒアリングに向けて、事前に確認したい項目をお送りします。

分かる範囲で構いませんので、以下の内容をご準備いただけますと、当日のご相談がスムーズになります。

・現在の事業内容
・今後予定している設備投資、システム導入、販路開拓など
・投資予定額と実施したい時期
・直近の売上規模、従業員数
・補助金で特に確認したいこと

すべて埋まっていなくても問題ありません。
当日お話を伺いながら整理いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("plan-standard-proposal", "スタンダードプラン提案", "契約・プラン", "丁寧", "顧客", ["料金", "スタンダード"], true, `{相手名}

お世話になっております。
ご相談内容を踏まえると、貴社の場合はスタンダードプランが最も使いやすいかと思います。

スタンダードプランでは、月1回の補助金情報配信、チャット相談、必要に応じたZOOM・訪問での深掘り、申請支援のご相談まで対応できます。
スポット申請時の成功報酬も9%で、着手金なしのため、費用対効果を確認しながら進めやすいプランです。

まずは顧問として補助金情報を取りこぼさない体制を作り、具体的な投資案件が出たタイミングで申請可否を一緒に判断していく形がよいと考えています。

ご不明点があれば、遠慮なくお知らせください。
よろしくお願いいたします。
{差出人}`),
  tpl("mini-plan-scope", "ミニプランの範囲説明", "契約・プラン", "丁寧", "顧客", ["料金", "ミニ"], false, `{相手名}

お世話になっております。
ミニプランについて補足いたします。

ミニプランは、月額を抑えて補助金情報を受け取りたい方向けのライト版です。
チャット相談は月10件まで、情報配信は四半期1回の簡易ダイジェストが中心となります。
一方で、ZOOM・訪問での定例相談や申請書作成代行は対象外です。

本格的に申請支援までご希望の場合は、スタンダードプランの方が結果的に使いやすいケースが多いです。
ご希望の関わり方に合わせて、無理のない形をご提案いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("premium-plan-scope", "プレミアムプランの範囲説明", "契約・プラン", "丁寧", "顧客", ["料金", "プレミアム"], false, `{相手名}

お世話になっております。
プレミアムプランについてご説明いたします。

プレミアムプランは、年商1億円超の中規模法人様や、複数の補助金・助成金を継続的に検討される方向けのフル対応プランです。
月1回の定例MTGを前提に、全補助金カテゴリを優先的に確認し、年1件まで申請書作成代行もプラン内に含まれます。

一方で、12か月の最低契約期間があるため、申請予定件数や社内体制を確認したうえで判断するのがおすすめです。
必要であれば、スタンダードプランとの違いも比較してご案内いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("contract-start", "顧問契約開始の案内", "契約・プラン", "丁寧", "顧客", ["契約", "開始"], false, `{相手名}

お世話になっております。
このたびはGreen Partnershipの補助金顧問サービスをご契約いただき、ありがとうございます。

今後は、補助金情報の確認、チャット相談、必要に応じた打ち合わせ、申請候補の整理を継続的にサポートいたします。
初回は、貴社の事業内容、今後の投資予定、補助金活用の優先度を整理するところから始めたいと思います。

まずは{期限}頃で、初回打ち合わせの日程をご調整できますでしょうか。
今後ともどうぞよろしくお願いいたします。
{差出人}`),
  tpl("gbiz-id-guide", "GビズID取得案内", "GビズID", "丁寧", "顧客", ["電子申請", "事前準備"], false, `{相手名}

お世話になっております。
補助金の電子申請に向けて、GビズIDプライムの取得状況をご確認ください。

多くの補助金では、申請時にGビズIDプライムが必要になります。
取得に時間がかかる場合があるため、申請を検討する段階で早めに準備しておくと安心です。

すでに取得済みの場合は、ログインできるかどうかだけご確認ください。
未取得の場合は、取得手続きの流れをご案内いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("monthly-curation-send", "月次補助金情報の配信", "月次配信", "丁寧", "顧客", ["月次", "情報配信"], false, `{相手名}

お世話になっております。
今月の補助金情報をお送りします。

今回は、貴社の事業内容や今後の投資可能性を踏まえ、特に確認しておきたい制度を中心に整理しました。
すぐに申請するものだけでなく、今後の設備投資・販路開拓・DX・省力化の検討材料としてご確認ください。

気になる制度がありましたら、チャットで制度名をお知らせください。
対象になりそうか、申請時期や必要準備も含めて確認いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("application-required-docs", "申請準備の必要資料依頼", "申請準備", "丁寧", "顧客", ["必要資料", "申請前"], true, `{相手名}

お世話になっております。
{案件名}の申請準備にあたり、現時点で必要になりそうな資料を整理しました。

まずは以下をご共有いただけますでしょうか。

・会社概要が分かる資料
・直近の決算書または確定申告書
・導入予定設備やサービスの見積書
・導入内容が分かるカタログ、仕様書、提案書
・今回の投資で実現したいことのメモ

すべて一度にそろわなくても問題ありません。
準備できるものから順にお送りいただければ、こちらで不足分を確認いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("estimate-correction-request", "見積書の修正依頼", "加点・添付書類", "丁寧", "顧客", ["見積書", "修正"], true, `{相手名}

お世話になっております。
ご共有いただいた見積書を確認しました。

申請書類として使用するため、以下の点を修正または追記いただけるか、発行元へご確認いただけますでしょうか。

・宛名が申請事業者名と一致しているか
・見積日、見積番号、有効期限の記載
・税抜、税込、消費税額の内訳
・導入する設備やサービスの型番、数量、単価
・補助対象外になり得る費用が混ざっていないか

形式が整うと、申請時・交付申請時・実績報告時の確認がスムーズになります。
お手数をおかけしますが、よろしくお願いいたします。
{差出人}`),
  tpl("business-plan-detail-request", "事業計画の具体化依頼", "申請書修正", "丁寧", "顧客", ["事業計画", "修正"], true, `{相手名}

お世話になっております。
{案件名}の事業計画について、審査で伝わりやすくするために、もう少し具体化したい箇所があります。

特に、以下の点を分かる範囲で追記いただけますでしょうか。

・現在の課題がどのように発生しているか
・今回の投資で何が変わるか
・売上、利益、生産性、作業時間などへの効果
・顧客や取引先にとってのメリット
・競合と比べた強み

箇条書きやメモの形で問題ありません。
いただいた内容をもとに、こちらで申請書の文章として整えます。

よろしくお願いいたします。
{差出人}`),
  tpl("financial-numbers-request", "数値根拠の確認依頼", "申請書修正", "丁寧", "顧客", ["売上計画", "根拠"], false, `{相手名}

お世話になっております。
申請書内の売上・利益・生産性の見込みについて、根拠を補強したいと考えています。

審査では、単に「売上が上がる」だけでなく、なぜその数字になるのかが分かることが重要です。
差し支えなければ、以下を分かる範囲で教えてください。

・想定する販売数、客数、単価
・既存顧客からの需要見込み
・新規顧客の獲得方法
・投資後に削減できる時間や人件費
・過去実績から見た根拠

概算で構いませんので、まずは考え方を共有いただけますと助かります。
よろしくお願いいたします。
{差出人}`),
  tpl("application-final-check", "電子申請前の最終確認", "申請準備", "かなり丁寧", "顧客", ["最終確認", "提出前"], true, `{相手名}

お世話になっております。
{案件名}の電子申請前の最終確認をお願いいたします。

提出後は修正が難しい場合があるため、以下を中心にご確認ください。

・会社名、代表者名、住所、連絡先
・申請する補助金名、申請枠
・事業計画の内容
・経費明細、見積金額、自己負担額
・添付書類の不足や差し替え漏れ

問題なければ、{期限}までに「この内容で提出OK」とご返信ください。
気になる点があれば、遠慮なくお知らせください。

よろしくお願いいたします。
{差出人}`),
  tpl("application-submitted", "申請完了の報告", "申請準備", "丁寧", "顧客", ["申請完了", "報告"], false, `{相手名}

お世話になっております。
{案件名}の申請手続きが完了しましたので、ご報告いたします。

今後は、事務局側で審査が行われ、採択発表を待つ流れとなります。
審査中に追加確認や差し戻しがあった場合は、すぐに共有いたします。

採択発表時期が近づきましたら、改めてこちらでも確認いたします。
ここまでご協力いただき、ありがとうございました。

引き続き、よろしくお願いいたします。
{差出人}`),
  tpl("adoption-congrats", "採択の報告", "採択後連絡", "丁寧", "顧客", ["採択", "お祝い"], true, `{相手名}

お世話になっております。
{案件名}について、採択が確認できました。
誠におめでとうございます。

今後は、交付申請、交付決定、事業実施、実績報告という流れで進みます。
特に、交付決定前の発注・契約・支払いは補助対象外となる可能性があるため、次の手続きが完了するまで実施タイミングにはご注意ください。

次に必要な資料と進め方を整理して、改めてご案内いたします。
引き続き、しっかりサポートいたします。

よろしくお願いいたします。
{差出人}`),
  tpl("not-adopted-followup", "不採択時のフォロー", "採択後連絡", "かなり丁寧", "顧客", ["不採択", "次回対策"], false, `{相手名}

お世話になっております。
{案件名}について確認したところ、今回は不採択という結果でした。

ご準備にお時間をいただいたにもかかわらず、このような結果となり大変残念です。
ただ、補助金は公募回や審査傾向によって結果が変わることもあり、内容を見直すことで次回以降に可能性を高められる場合があります。

差し支えなければ、今回の申請内容を振り返り、次に改善できる点を整理いたします。
今後の投資計画に合わせて、別制度や次回公募も含めて検討しましょう。

よろしくお願いいたします。
{差出人}`),
  tpl("grant-application-docs-request", "交付申請の資料依頼", "交付申請", "丁寧", "顧客", ["交付申請", "資料依頼"], true, `{相手名}

お世話になっております。
採択後の交付申請に向けて、必要資料の準備をお願いいたします。

交付申請では、補助対象経費の内容や金額を正式に確認するため、見積書や仕様書などの資料が重要になります。
まずは以下をご共有ください。

・最新の見積書
・導入する設備、サービスの仕様書やカタログ
・経費の内訳が分かる資料
・発注予定先の情報
・申請時から変更がある場合はその内容

なお、交付決定前の発注・契約・支払いは補助対象外になる可能性があります。
実施前に必ずこちらへご確認ください。

よろしくお願いいたします。
{差出人}`),
  tpl("grant-application-correction", "交付申請の修正依頼", "交付申請", "丁寧", "顧客", ["交付申請", "修正依頼"], true, `{相手名}

お世話になっております。
交付申請書類を確認したところ、修正または追加確認が必要な箇所がありました。

主に以下の点をご確認いただけますでしょうか。

・見積金額と経費明細の一致
・対象経費と対象外経費の切り分け
・見積書の宛名、日付、有効期限
・設備やサービスの仕様が分かる資料
・申請時から変更がある場合の理由

修正内容が整い次第、こちらで交付申請の形に反映いたします。
お手数をおかけしますが、{期限}までにご共有いただけますと助かります。

よろしくお願いいたします。
{差出人}`),
  tpl("do-not-order-before-approval", "交付決定前の発注注意", "交付申請", "かなり丁寧", "顧客", ["重要", "発注前注意"], true, `{相手名}

お世話になっております。
念のため、交付決定前の発注・契約・支払いについてご注意ください。

補助金では、交付決定前に発注・契約・支払いを行うと、その経費が補助対象外になる場合があります。
そのため、設備やサービスの導入を進める前に、必ず交付決定通知を確認してから実施してください。

発注予定日や支払い予定日が近い場合は、事前にこちらへご共有ください。
対象外にならないよう、進め方を一緒に確認いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("grant-decision-notice", "交付決定後の実施案内", "採択後連絡", "丁寧", "顧客", ["交付決定", "実施開始"], false, `{相手名}

お世話になっております。
{案件名}について、交付決定が確認できました。

これ以降、補助対象となる発注・契約・支払いを進められる段階になります。
ただし、実績報告で確認できるよう、発注書、契約書、納品書、請求書、支払い証憑、写真などの保管が重要です。

実施中に内容変更や金額変更がある場合は、事前確認が必要になることがあります。
変更が出そうな場合は、早めにご相談ください。

よろしくお願いいたします。
{差出人}`),
  tpl("implementation-evidence-guide", "実施中の証憑保管案内", "実施中フォロー", "丁寧", "顧客", ["証憑", "実施中"], true, `{相手名}

お世話になっております。
事業実施中の証憑保管についてご案内します。

実績報告では、補助事業を正しく実施したことを示す資料が必要です。
以下は必ず保管しておいてください。

・発注書、契約書
・納品書、検収書
・請求書
・振込控え、通帳コピー、支払い明細
・導入前後や設置状況が分かる写真
・成果物、チラシ、Web画面、運用実績など

資料が不足すると、実績報告で差し戻しになる可能性があります。
不安な資料があれば、都度ご共有ください。

よろしくお願いいたします。
{差出人}`),
  tpl("change-approval-warning", "内容変更時の事前相談", "実施中フォロー", "丁寧", "顧客", ["変更", "事前相談"], false, `{相手名}

お世話になっております。
補助事業の内容や経費に変更が出そうな場合は、実施前に必ずご相談ください。

たとえば、導入する設備の変更、発注先の変更、金額の増減、実施時期の変更などは、事務局への確認や変更承認が必要になる場合があります。
事前確認をせずに進めると、補助対象外となるリスクがあります。

変更の可能性が出た段階で、分かる範囲の資料や理由をご共有いただければ、こちらで確認いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("performance-report-docs-request", "実績報告の資料依頼", "実績報告", "丁寧", "顧客", ["実績報告", "資料依頼"], true, `{相手名}

お世話になっております。
{案件名}の実績報告に向けて、必要資料のご共有をお願いいたします。

まずは以下の資料を、準備できるものから順にお送りください。

・発注書、契約書
・納品書、検収書
・請求書
・支払いが分かる資料
・導入設備や成果物の写真
・事業実施内容が分かる資料
・補助事業で作成したチラシ、Webページ、広告物など

不足がある場合は、こちらで確認項目を整理してご案内いたします。
実績報告の期限に余裕を持って進めたいので、{期限}までに一度ご共有いただけますと助かります。

よろしくお願いいたします。
{差出人}`),
  tpl("performance-report-correction", "実績報告の修正依頼", "実績報告", "丁寧", "顧客", ["実績報告", "修正依頼"], true, `{相手名}

お世話になっております。
実績報告資料を確認したところ、いくつか修正または追加確認が必要な点がありました。

主に以下をご確認ください。

・請求書と支払い金額の一致
・納品日、支払日、事業実施期間内であるか
・写真で導入内容が確認できるか
・成果物や広告物の提出漏れ
・補助対象外経費が混ざっていないか

差し戻しを防ぐため、{期限}までに修正版または追加資料をご共有いただけますでしょうか。
こちらで再確認し、実績報告書に反映いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("payment-proof-request", "支払い証憑の不足連絡", "実績報告", "丁寧", "顧客", ["支払い証憑", "不足"], false, `{相手名}

お世話になっております。
実績報告に必要な支払い証憑について、不足している資料がありました。

補助金では、請求書だけでなく、実際に支払いが完了したことを示す資料が必要です。
以下のいずれかをご共有いただけますでしょうか。

・銀行振込の控え
・通帳の該当ページ
・インターネットバンキングの支払い完了画面
・クレジットカード明細と引落確認資料

金額、支払先、支払日が確認できる形でお願いいたします。
不明点があれば、資料を一度お送りいただければこちらで確認します。

よろしくお願いいたします。
{差出人}`),
  tpl("performance-report-complete", "実績報告提出完了", "実績報告", "丁寧", "顧客", ["提出完了", "報告"], false, `{相手名}

お世話になっております。
{案件名}の実績報告を提出しましたので、ご報告いたします。

今後は事務局側で内容確認が行われます。
追加確認や差し戻しがあった場合は、すぐに共有いたします。

補助金の確定・入金までもう少し手続きが続きますので、引き続き証憑資料は保管をお願いいたします。
ここまでご協力いただき、ありがとうございました。

よろしくお願いいたします。
{差出人}`),
  tpl("success-fee-invoice", "成功報酬請求の案内", "請求・入金", "丁寧", "顧客", ["成功報酬", "請求"], false, `{相手名}

お世話になっております。
{案件名}について、採択額に基づく成功報酬のご請求についてご案内いたします。

ご契約内容に基づき、成功報酬は採択額をもとに算定しております。
請求書をご確認いただき、内容にご不明点があればお知らせください。

お支払い期日は{期限}となります。
引き続き、交付申請から実績報告までしっかりサポートいたします。

よろしくお願いいたします。
{差出人}`),
  tpl("payment-confirmed", "入金確認のお礼", "請求・入金", "丁寧", "顧客", ["入金", "お礼"], false, `{相手名}

お世話になっております。
ご入金を確認いたしました。
お手続きいただき、ありがとうございます。

引き続き、{案件名}の進行に必要な確認や手続きをサポートいたします。
ご不明点がありましたら、いつでもお知らせください。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("partner-status-hearing-done", "紹介パートナーへ初回面談完了共有", "ステータス共有", "丁寧", "取引先", ["紹介", "進捗"], false, `{相手名}

お世話になっております。
ご紹介いただいたお客様について、初回ヒアリングが完了しましたので共有いたします。

現時点では、補助金活用の可能性がある投資内容を確認できており、今後は対象制度と申請時期を整理してご案内する予定です。
契約や申請に進む場合は、改めてステータスを共有いたします。

引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("partner-contract-shared", "紹介パートナーへ契約済み共有", "ステータス共有", "丁寧", "取引先", ["紹介", "契約済み"], false, `{相手名}

お世話になっております。
ご紹介いただいたお客様が、弊社の補助金顧問サービスをご契約されましたので共有いたします。

今後は、補助金情報の確認、申請候補の整理、必要に応じた申請支援を弊社で進めてまいります。
貴社からのご紹介が、お客様の成長支援につながるよう丁寧に対応いたします。

進捗がありましたら、引き続きご報告いたします。
よろしくお願いいたします。
{差出人}`),
  tpl("partner-adoption-report", "紹介パートナーへ採択報告", "紹介パートナー", "丁寧", "取引先", ["採択", "紹介報酬"], true, `{相手名}

お世話になっております。
ご紹介いただいたお客様の補助金申請について、採択が確認できました。

このたびのご紹介により、お客様の設備投資・事業成長を後押しできる結果となりました。
誠にありがとうございます。

紹介報酬については、契約条件に基づき、採択額を確認のうえご案内いたします。
お支払い時期は、原則として採択確定後の翌月末を予定しております。

引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("partner-fee-bank-request", "紹介報酬の振込先確認", "紹介パートナー", "丁寧", "取引先", ["紹介報酬", "振込先"], false, `{相手名}

お世話になっております。
紹介報酬のお支払いに向けて、振込先情報の確認をお願いいたします。

お手数ですが、以下をご共有いただけますでしょうか。

・金融機関名
・支店名
・口座種別
・口座番号
・口座名義
・請求書の発行有無

確認でき次第、支払い予定日とあわせてご案内いたします。
よろしくお願いいたします。
{差出人}`),
  tpl("partner-study-invite", "パートナー向け勉強会案内", "紹介パートナー", "やわらかい", "取引先", ["勉強会", "案内"], false, `{相手名}

お世話になっております。
紹介パートナー様向けの補助金ミニ勉強会をご案内いたします。

今回は、お客様から設備投資や人手不足、DXの相談を受けたときに、どのように補助金活用の可能性を見つけるかを中心にお話しします。
専門知識がなくても、お客様に「一度確認してみませんか」と自然にお声がけいただける内容です。

ご都合が合いましたら、ぜひご参加ください。
よろしくお願いいたします。
{差出人}`),
  tpl("partner-not-eligible", "紹介案件が対象外の場合", "紹介パートナー", "かなり丁寧", "取引先", ["対象外", "フォロー"], false, `{相手名}

お世話になっております。
ご紹介いただいたお客様について確認したところ、現時点では補助金の対象として進めることが難しい可能性が高い状況です。

主な理由としては、投資内容、実施時期、対象経費、事業者要件のいずれかが制度条件と合いにくいためです。
ただし、今後の投資内容や公募条件によっては、別制度で検討できる場合もあります。

せっかくご紹介いただいた案件ですので、今後可能性が出そうな制度があれば、改めて確認いたします。
引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("zoom-reminder", "打ち合わせ前日のリマインド", "日程調整", "やわらかい", "顧客", ["リマインド", "MTG"], false, `{相手名}

お世話になっております。
明日の{案件名}のお打ち合わせについて、念のためご連絡いたします。

日時：{期限}

当日は、現在の状況や確認したい点を伺いながら、次に進めることを整理できればと思います。
追加で確認したい資料があれば、お手元にご準備ください。

どうぞよろしくお願いいたします。
{差出人}`),
  tpl("chat-over-limit", "ミニプランのチャット超過案内", "契約・プラン", "丁寧", "顧客", ["ミニ", "チャット"], false, `{相手名}

お世話になっております。
ミニプランのチャット相談件数についてご案内です。

今月のご相談件数が、プラン内の月10件に近づいています。
超過分は1件あたり2,200円となりますので、念のため共有いたします。

継続的に相談件数が多くなりそうな場合は、スタンダードプランへの切り替えもご検討いただけます。
必要であれば、費用感やサポート範囲を比較してご案内いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("plan-change-deadline", "プラン変更締切の案内", "契約・プラン", "丁寧", "顧客", ["プラン変更", "20日"], false, `{相手名}

お世話になっております。
プラン変更についてご案内いたします。

プラン変更は、毎月20日までのご申請で翌月から反映となります。
プランダウンについては、契約から6か月以降の対応となりますのでご注意ください。

変更をご希望の場合は、{期限}までにご希望のプランをお知らせください。
サポート範囲や費用の違いも、必要に応じてご説明いたします。

よろしくお願いいたします。
{差出人}`),
  tpl("discount-no-meeting", "ZOOM/訪問未実施月の値引き案内", "契約・プラン", "丁寧", "顧客", ["値引き", "スタンダード"], false, `{相手名}

お世話になっております。
スタンダードプランのZOOM・訪問未実施月の割引についてご案内です。

当月のZOOM・訪問MTGを実施しない場合、月額顧問料は3割引の対象となります。
実施有無は月初までに確認できると、請求処理がスムーズです。

今月のMTG実施をご希望されるか、またはチャット相談中心で進めるか、ご都合をお知らせください。

よろしくお願いいたします。
{差出人}`),
  tpl("internal-deadline-alert", "社内向け締切アラート", "社内連絡", "簡潔", "社内", ["締切", "社内"], false, `{相手名}

お疲れさまです。
{案件名}の期限が近づいています。

期限：{期限}

現時点で確認したい点は以下です。
・お客様への資料依頼が済んでいるか
・不足資料が残っていないか
・申請書または報告書のレビュー担当が決まっているか

対応状況をこのスレッドで共有してください。
{差出人}`),
  tpl("internal-review-request", "社内レビュー依頼", "社内連絡", "簡潔", "社内", ["レビュー", "社内"], false, `{相手名}

お疲れさまです。
{案件名}の文面レビューをお願いします。

確認してほしい点は以下です。
・補助金の要件と矛盾がないか
・お客様に伝わりにくい表現がないか
・期限や依頼内容が明確か

可能であれば、{期限}までにコメントをお願いします。
{差出人}`),
  tpl("apology-delay", "返信遅れのお詫び", "お詫び", "かなり丁寧", "顧客", ["遅延", "お詫び"], false, `{相手名}

お世話になっております。
ご返信が遅くなり、申し訳ありません。

{案件名}について、内容を確認したうえでご連絡いたしました。
お待たせしてしまった分、今後の進め方が分かりやすいよう整理して対応いたします。

引き続き、どうぞよろしくお願いいたします。
{差出人}`),
  tpl("soft-decline-unsupported", "支援対象外のお断り", "お断り", "かなり丁寧", "社外", ["対象外", "お断り"], false, `{相手名}

お世話になっております。
{案件名}について確認いたしました。

大変恐縮ですが、今回の内容は弊社の補助金顧問サービスの支援範囲外となる可能性が高く、現時点では正式なサポートとしてお受けすることが難しい状況です。

ただし、今後の投資内容や制度条件が変われば、改めて確認できる場合もあります。
また補助金活用の可能性が出てきましたら、ぜひご相談ください。

何卒よろしくお願いいたします。
{差出人}`),
  tpl("sns-subsidy-tip", "SNS補助金ミニ知識", "SNS・投稿", "親しみ", "SNS", ["SNS", "投稿"], false, `補助金は「採択されたら終わり」ではありません。

採択後には、交付申請、交付決定、事業実施、実績報告という手続きがあります。
特に交付決定前の発注・契約・支払いは、補助対象外になる可能性があるため注意が必要です。

申請前だけでなく、採択後の進め方まで見据えて準備しておくと安心です。`),
];

function tpl(key, title, category, tone, recipient, tags, favorite, body) {
  return { key, title, category, tone, recipient, tags, favorite, body };
}

function defaultBody() {
  return `{相手名}

お世話になっております。
{案件名}についてご連絡いたしました。

お忙しいところ恐れ入りますが、{期限}までにご確認いただけますと幸いです。

よろしくお願いいたします。
{差出人}`;
}

function parseTags(value) {
  return String(value || "")
    .split(/[,、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

async function copyText(text) {
  const value = String(text || "");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fallback below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function emptyState(icon, text) {
  return `
    <div class="empty">
      <div>
        <i data-lucide="${icon}"></i>
        <p>${escapeHtml(text)}</p>
      </div>
    </div>
  `;
}

function createId() {
  return `phrase-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toYmd(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

void initialize();
