const DRAFT_KEY = "gp.amazonResearch.draft.v1";
const apiBase = "/amazon-research/api";

const checklist = [
  ["brand", "ブランド・真贋リスクを確認", "出品制限、知財、商標、相乗りリスクを確認します。"],
  ["regulation", "法規制・表示義務を確認", "PSE、食品衛生法、薬機法、電波法、家庭用品品質表示法などを確認します。"],
  ["fba", "FBA条件を確認", "サイズ、危険物、温度管理、納品制限、保管料を確認します。"],
  ["supplier", "仕入先条件を確認", "MOQ、納期、検品、支払条件、再発注の安定性を確認します。"],
  ["quality", "品質・低評価要因を確認", "競合レビューから破損、耐久性、説明不足などを抽出します。"],
  ["differentiation", "差別化が明確", "写真、仕様、セット内容、保証、説明書などで勝ち筋を定義します。"],
  ["ads", "広告・SEO仮説を確認", "主要キーワード、初期ACOS、レビュー獲得までの広告費を見ます。"],
  ["cashflow", "在庫・資金繰りを確認", "MOQ、リードタイム、販売速度、在庫切れと滞留リスクを見ます。"]
];

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat("ja-JP");
const pctFmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });

const elements = {
  totalScore: document.querySelector("#totalScore"),
  decisionLabel: document.querySelector("#decisionLabel"),
  saveStatus: document.querySelector("#saveStatus"),
  competitorRows: document.querySelector("#competitorRows"),
  keywordRows: document.querySelector("#keywordRows"),
  checkGrid: document.querySelector("#checkGrid"),
  costBreakdown: document.querySelector("#costBreakdown"),
  riskList: document.querySelector("#riskList"),
  summaryBox: document.querySelector("#summaryBox"),
  caseDrawer: document.querySelector("#caseDrawer"),
  caseList: document.querySelector("#caseList"),
  toast: document.querySelector("#toast")
};

let state = loadDraft();
let saveTimer = null;

function emptyCompetitor() {
  return { asin: "", brand: "", price: 0, reviews: 0, rating: 0, monthlyUnits: 0, strengths: "", weaknesses: "" };
}

function emptyKeyword() {
  return { word: "", volume: 0, cvr: 0, adCompetition: "3", difficulty: "3", memo: "" };
}

function defaultState() {
  return {
    id: "",
    activeTab: "product",
    product: {
      name: "",
      category: "",
      asin: "",
      stage: "アイデア",
      price: 2980,
      monthlyUnits: 120,
      cogs: 850,
      inboundCost: 160,
      fbaFee: 520,
      referralRate: 15,
      acos: 12,
      returnRate: 3,
      otherCost: 80,
      conversionRate: 8,
      leadTime: 35,
      moq: 300,
      differentiation: "",
      researchNote: ""
    },
    competitors: [emptyCompetitor(), emptyCompetitor(), emptyCompetitor()],
    keywords: [emptyKeyword(), emptyKeyword(), emptyKeyword()],
    checks: Object.fromEntries(checklist.map(([id]) => [id, false])),
    summary: {},
    updatedAt: ""
  };
}

function sampleState() {
  return {
    ...defaultState(),
    product: {
      name: "折りたたみ収納ボックス",
      category: "ホーム&キッチン",
      asin: "B0SAMPLE01",
      stage: "一次調査",
      price: 3480,
      monthlyUnits: 180,
      cogs: 980,
      inboundCost: 190,
      fbaFee: 610,
      referralRate: 15,
      acos: 14,
      returnRate: 3,
      otherCost: 90,
      conversionRate: 9,
      leadTime: 42,
      moq: 500,
      differentiation: "持ち手の補強、半透明ラベル窓、3個セット化、写真で収納後の統一感を訴求。",
      researchNote: "低評価は側面のたわみと説明書不足に集中。サイズ違い展開がありそう。"
    },
    competitors: [
      { asin: "B0AAA111", brand: "A社", price: 3280, reviews: 1420, rating: 4.3, monthlyUnits: 320, strengths: "レビュー量、価格が安い", weaknesses: "耐久性レビューが弱い" },
      { asin: "B0BBB222", brand: "B社", price: 3980, reviews: 540, rating: 4.5, monthlyUnits: 210, strengths: "写真が良い、色展開", weaknesses: "セット内容が少ない" },
      { asin: "B0CCC333", brand: "C社", price: 2980, reviews: 260, rating: 4.1, monthlyUnits: 120, strengths: "小型で軽い", weaknesses: "容量不足の声" }
    ],
    keywords: [
      { word: "収納ボックス 折りたたみ", volume: 8200, cvr: 9, adCompetition: "4", difficulty: "4", memo: "メインKW候補" },
      { word: "クローゼット 収納 ケース", volume: 5400, cvr: 7, adCompetition: "3", difficulty: "3", memo: "用途訴求" },
      { word: "衣類 収納ボックス", volume: 3600, cvr: 8, adCompetition: "3", difficulty: "3", memo: "写真改善で狙う" }
    ],
    checks: { brand: true, regulation: false, fba: true, supplier: true, quality: true, differentiation: true, ads: false, cashflow: false }
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultState();
    return mergeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function mergeState(input) {
  const base = defaultState();
  return {
    ...base,
    ...input,
    product: { ...base.product, ...(input?.product || {}) },
    competitors: Array.isArray(input?.competitors) && input.competitors.length ? input.competitors : base.competitors,
    keywords: Array.isArray(input?.keywords) && input.keywords.length ? input.keywords : base.keywords,
    checks: { ...base.checks, ...(input?.checks || {}) },
    summary: { ...(input?.summary || {}) }
  };
}

function saveDraft() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  updateSaveStatus("下書き保存");
}

function scheduleDraftSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveDraft, 250);
}

function num(value) {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function sum(values) {
  return values.reduce((total, value) => total + num(value), 0);
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length ? sum(filtered) / filtered.length : 0;
}

function getCalc() {
  const p = state.product;
  const price = num(p.price);
  const units = num(p.monthlyUnits);
  const referralFee = price * num(p.referralRate) / 100;
  const adCost = price * num(p.acos) / 100;
  const returnCost = price * num(p.returnRate) / 100;
  const landedCost = num(p.cogs) + num(p.inboundCost) + num(p.otherCost);
  const variableCost = landedCost + num(p.fbaFee) + referralFee + adCost + returnCost;
  const profitUnit = price - variableCost;
  const monthlyRevenue = price * units;
  const monthlyProfit = profitUnit * units;
  const margin = price > 0 ? profitUnit / price * 100 : 0;
  const roi = landedCost > 0 ? profitUnit / landedCost * 100 : 0;
  const rateSum = (num(p.referralRate) + num(p.acos) + num(p.returnRate)) / 100;
  const breakEvenPrice = rateSum < .95 ? (landedCost + num(p.fbaFee)) / (1 - rateSum) : 0;
  const profitBeforeAds = price - (landedCost + num(p.fbaFee) + referralFee + returnCost);
  const maxCpc = Math.max(0, profitBeforeAds * num(p.conversionRate) / 100);
  return { price, units, referralFee, adCost, returnCost, landedCost, variableCost, profitUnit, monthlyRevenue, monthlyProfit, margin, roi, breakEvenPrice, maxCpc };
}

function getAverages() {
  const competitors = state.competitors.filter((row) => Object.values(row).some((value) => String(value || "").trim()));
  const keywords = state.keywords.filter((row) => Object.values(row).some((value) => String(value || "").trim()));
  return {
    competitors,
    keywords,
    avgReviews: average(competitors.map((row) => num(row.reviews))),
    avgRating: average(competitors.map((row) => num(row.rating)).filter(Boolean)),
    competitorUnits: sum(competitors.map((row) => num(row.monthlyUnits))),
    keywordVolume: sum(keywords.map((row) => num(row.volume))),
    adCompetition: average(keywords.map((row) => num(row.adCompetition)).filter(Boolean)),
    difficulty: average(keywords.map((row) => num(row.difficulty)).filter(Boolean)),
    keywordCvr: average(keywords.map((row) => num(row.cvr)).filter(Boolean))
  };
}

function getScores() {
  const calc = getCalc();
  const avg = getAverages();
  const checkRatio = checklist.length ? Object.values(state.checks).filter(Boolean).length / checklist.length : 0;
  const demandScore = clamp(calc.units / 300 * 50 + avg.keywordVolume / 18000 * 35 + avg.competitorUnits / 1200 * 15);
  const profitScore = clamp(calc.margin * 1.8 + calc.roi * .45 + Math.min(25, calc.monthlyProfit / 200000 * 25));
  const competitionPenalty = Math.min(100, avg.avgReviews / 1200 * 45 + avg.adCompetition * 9 + avg.difficulty * 8 + avg.competitors.length * 3);
  const competitionScore = clamp(100 - competitionPenalty);
  const riskPenalty = (num(state.product.leadTime) > 45 ? 12 : 0) + (num(state.product.moq) > 800 ? 10 : 0) + (num(state.product.returnRate) > 6 ? 10 : 0);
  const riskScore = clamp(checkRatio * 100 - riskPenalty);
  const total = clamp(demandScore * .32 + profitScore * .33 + competitionScore * .2 + riskScore * .15);
  return { demandScore, profitScore, competitionScore, riskScore, total };
}

function decisionFor(total) {
  if (total >= 75) return ["Go候補", "good"];
  if (total >= 60) return ["小さくテスト", "watch"];
  if (total >= 45) return ["要追加調査", "watch"];
  if (total > 0) return ["見送り寄り", "bad"];
  return ["入力待ち", ""];
}

function renderAll() {
  renderFields();
  renderCompetitors();
  renderKeywords();
  renderChecks();
  setActiveTab(state.activeTab || "product", false);
  updateOutputs();
  window.lucide?.createIcons?.();
}

function renderFields() {
  document.querySelectorAll("[data-bind]").forEach((field) => {
    field.value = state.product[field.dataset.bind] ?? "";
  });
}

function renderCompetitors() {
  elements.competitorRows.innerHTML = state.competitors.map((row, index) => `
    <tr>
      <td><input data-table="competitors" data-index="${index}" data-field="asin" value="${escapeHtml(row.asin)}" aria-label="ASINまたは商品名"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="brand" value="${escapeHtml(row.brand)}" aria-label="ブランド"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="price" type="number" min="0" step="10" value="${escapeHtml(row.price)}" aria-label="価格"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="reviews" type="number" min="0" step="1" value="${escapeHtml(row.reviews)}" aria-label="レビュー数"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="rating" type="number" min="0" max="5" step="0.1" value="${escapeHtml(row.rating)}" aria-label="評価"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="monthlyUnits" type="number" min="0" step="1" value="${escapeHtml(row.monthlyUnits)}" aria-label="月販推定"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="strengths" value="${escapeHtml(row.strengths)}" aria-label="強み"></td>
      <td><input data-table="competitors" data-index="${index}" data-field="weaknesses" value="${escapeHtml(row.weaknesses)}" aria-label="弱み"></td>
      <td><button class="tool-button danger" type="button" data-remove="competitors" data-index="${index}" data-tip="この競合行を確認後に削除します。">削除</button></td>
    </tr>
  `).join("");
}

function renderKeywords() {
  elements.keywordRows.innerHTML = state.keywords.map((row, index) => `
    <tr>
      <td><input data-table="keywords" data-index="${index}" data-field="word" value="${escapeHtml(row.word)}" aria-label="キーワード"></td>
      <td><input data-table="keywords" data-index="${index}" data-field="volume" type="number" min="0" step="10" value="${escapeHtml(row.volume)}" aria-label="月間検索数"></td>
      <td><input data-table="keywords" data-index="${index}" data-field="cvr" type="number" min="0" max="100" step="0.1" value="${escapeHtml(row.cvr)}" aria-label="想定CVR"></td>
      <td><select data-table="keywords" data-index="${index}" data-field="adCompetition" aria-label="広告競争">${scaleOptions(row.adCompetition)}</select></td>
      <td><select data-table="keywords" data-index="${index}" data-field="difficulty" aria-label="順位難易度">${scaleOptions(row.difficulty)}</select></td>
      <td><input data-table="keywords" data-index="${index}" data-field="memo" value="${escapeHtml(row.memo)}" aria-label="メモ"></td>
      <td><button class="tool-button danger" type="button" data-remove="keywords" data-index="${index}" data-tip="このキーワード行を確認後に削除します。">削除</button></td>
    </tr>
  `).join("");
}

function scaleOptions(current) {
  return [1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${String(current) === String(value) ? "selected" : ""}>${value}</option>`).join("");
}

function renderChecks() {
  elements.checkGrid.innerHTML = checklist.map(([id, title, detail]) => `
    <label class="check-item" data-tip="${escapeHtml(detail)}">
      <input type="checkbox" data-check="${id}" ${state.checks[id] ? "checked" : ""}>
      <span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></span>
    </label>
  `).join("");
}

function updateOutputs() {
  const calc = getCalc();
  const scores = getScores();
  const avg = getAverages();
  const [decision, className] = decisionFor(scores.total);
  state.summary = {
    totalScore: Math.round(scores.total),
    decision,
    profitUnit: Math.round(calc.profitUnit),
    margin: round(calc.margin),
    roi: round(calc.roi),
    monthlyProfit: Math.round(calc.monthlyProfit)
  };
  elements.totalScore.textContent = Math.round(scores.total);
  elements.decisionLabel.textContent = decision;
  elements.decisionLabel.className = `decision ${className}`.trim();
  setText("demandScoreText", Math.round(scores.demandScore));
  setText("profitScoreText", Math.round(scores.profitScore));
  setText("competitionScoreText", Math.round(scores.competitionScore));
  setText("riskScoreText", Math.round(scores.riskScore));
  setBar("demandBar", scores.demandScore);
  setBar("profitBar", scores.profitScore);
  setBar("competitionBar", scores.competitionScore);
  setBar("riskBar", scores.riskScore);
  setText("profitUnit", yen.format(calc.profitUnit));
  setText("profitUnitDetail", yen.format(calc.profitUnit));
  setText("marginPct", `${pctFmt.format(calc.margin)}%`);
  setText("roiPct", `${pctFmt.format(calc.roi)}%`);
  setText("monthlyProfit", yen.format(calc.monthlyProfit));
  setText("monthlyRevenue", yen.format(calc.monthlyRevenue));
  setText("breakEvenPrice", yen.format(calc.breakEvenPrice));
  setText("maxCpc", yen.format(calc.maxCpc));
  renderCostBreakdown(calc);
  renderRisks(calc, scores, avg);
  elements.summaryBox.textContent = buildSummary(calc, scores, avg);
}

function renderCostBreakdown(calc) {
  const p = state.product;
  const items = [
    `販売価格: ${yen.format(calc.price)}`,
    `仕入関連原価: ${yen.format(calc.landedCost)} (仕入 ${yen.format(num(p.cogs))} / 送料 ${yen.format(num(p.inboundCost))} / その他 ${yen.format(num(p.otherCost))})`,
    `Amazon販売手数料: ${yen.format(calc.referralFee)} (${pctFmt.format(num(p.referralRate))}%)`,
    `FBA/配送費: ${yen.format(num(p.fbaFee))}`,
    `広告費: ${yen.format(calc.adCost)} (ACOS ${pctFmt.format(num(p.acos))}%)`,
    `返品・値引想定: ${yen.format(calc.returnCost)} (${pctFmt.format(num(p.returnRate))}%)`
  ];
  elements.costBreakdown.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderRisks(calc, scores, avg) {
  const risks = [];
  if (calc.margin < 18) risks.push(["bad", "利益率が18%未満です。広告費や返品が少し増えるだけで赤字化しやすいです。"]);
  if (calc.roi < 40) risks.push(["warn", "ROIが40%未満です。資金回収の遅れに注意してください。"]);
  if (avg.avgReviews > 900) risks.push(["warn", `競合平均レビューが${numberFmt.format(Math.round(avg.avgReviews))}件です。新規参入時は差別化と広告費の根拠が必要です。`]);
  if (avg.adCompetition >= 4) risks.push(["warn", "広告競争が強めです。ロングテール語句や商品ページ改善の仮説を増やしてください。"]);
  if (num(state.product.leadTime) > 45) risks.push(["warn", "調達リードタイムが45日を超えています。在庫切れと滞留の両方を見積もってください。"]);
  if (num(state.product.moq) > 800) risks.push(["warn", "MOQが大きめです。テスト販売前に小ロット交渉や国内試作を検討してください。"]);
  if (!state.checks.regulation) risks.push(["bad", "法規制・表示義務が未確認です。カテゴリによっては販売前に必ず確認が必要です。"]);
  if (!state.product.differentiation.trim()) risks.push(["warn", "差別化案が未入力です。価格勝負だけにならない勝ち筋を記録してください。"]);
  if (!risks.length) risks.push(["good", "大きな赤信号はありません。次は小ロット検証と広告仮説の精度を上げる段階です。"]);
  if (scores.total >= 75) risks.unshift(["good", "総合スコアは高めです。規制確認と仕入先条件が固まればGo候補です。"]);
  elements.riskList.innerHTML = risks.map(([type, text]) => `<li class="${type}">${escapeHtml(text)}</li>`).join("");
}

function buildSummary(calc, scores, avg) {
  const p = state.product;
  const [decision] = decisionFor(scores.total);
  return [
    `商品候補: ${p.name || "未設定の商品候補"}`,
    `カテゴリ: ${p.category || "未設定"} / 調査段階: ${p.stage || "未設定"}`,
    `判定: ${decision} (総合 ${Math.round(scores.total)}点、需要 ${Math.round(scores.demandScore)}、利益性 ${Math.round(scores.profitScore)}、競合余地 ${Math.round(scores.competitionScore)}、リスク確認 ${Math.round(scores.riskScore)})`,
    `損益: 販売価格 ${yen.format(calc.price)}、1個利益 ${yen.format(calc.profitUnit)}、利益率 ${pctFmt.format(calc.margin)}%、ROI ${pctFmt.format(calc.roi)}%、月間利益 ${yen.format(calc.monthlyProfit)}`,
    `市場: 想定月販 ${numberFmt.format(calc.units)}個、登録キーワード検索数 ${numberFmt.format(avg.keywordVolume)}、競合平均レビュー ${numberFmt.format(Math.round(avg.avgReviews))}件`,
    `差別化案: ${p.differentiation || "未入力"}`,
    `次アクション: 規制確認、FBA料金確認、仕入先条件、広告語句、低評価要因を埋めて小ロット可否を判断する。`
  ].join("\n");
}

function setActiveTab(tabName, shouldSave = true) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  document.querySelectorAll(".pane").forEach((pane) => pane.classList.toggle("active", pane.id === `pane-${tabName}`));
  if (shouldSave) scheduleDraftSave();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("Login required");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.message || "通信に失敗しました。");
  return data;
}

async function saveSharedCase() {
  updateOutputs();
  const body = {
    id: state.id || undefined,
    title: state.product.name,
    category: state.product.category,
    stage: state.product.stage,
    score: state.summary.totalScore,
    decision: state.summary.decision,
    state
  };
  const data = await apiRequest("/cases", { method: "POST", body });
  state = mergeState(data.case.state || state);
  state.id = data.case.id;
  state.updatedAt = data.case.updatedAt;
  saveDraft();
  updateSaveStatus("共有保存済み");
  showToast("共有保存しました。");
}

async function openCases() {
  elements.caseDrawer.hidden = false;
  elements.caseList.innerHTML = '<p class="case-card">読み込み中です。</p>';
  const data = await apiRequest("/cases");
  renderCaseList(data.cases || []);
  document.querySelector("#closeCasesButton")?.focus();
  window.lucide?.createIcons?.();
}

function renderCaseList(cases) {
  if (!cases.length) {
    elements.caseList.innerHTML = '<p class="case-card">保存済みのAmazonリサーチ案件はまだありません。</p>';
    return;
  }
  elements.caseList.innerHTML = cases.map((item) => `
    <article class="case-card">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.category || "カテゴリ未設定")} / ${escapeHtml(item.stage || "段階未設定")} / ${escapeHtml(item.decision || "判定未設定")} / ${escapeHtml(String(item.score || 0))}点</p>
      <p>更新: ${formatDate(item.updatedAt)} / Rev.${escapeHtml(String(item.revision || 1))}</p>
      <div class="case-actions">
        <button class="tool-button primary" type="button" data-load-case="${escapeHtml(item.id)}" data-tip="このリサーチ案件を開きます。">開く</button>
        <button class="tool-button danger" type="button" data-delete-case="${escapeHtml(item.id)}" data-tip="確認後、この共有案件を削除します。">削除</button>
      </div>
    </article>
  `).join("");
}

async function loadSharedCase(id) {
  const data = await apiRequest("/cases");
  const item = (data.cases || []).find((caseItem) => caseItem.id === id);
  if (!item) {
    showToast("案件が見つかりませんでした。");
    return;
  }
  state = mergeState(item.state || {});
  state.id = item.id;
  state.updatedAt = item.updatedAt;
  elements.caseDrawer.hidden = true;
  saveDraft();
  renderAll();
  updateSaveStatus("共有データ読込");
  showToast("共有案件を開きました。");
}

async function deleteSharedCase(id) {
  if (!window.confirm("この共有リサーチ案件を削除します。よろしいですか？")) return;
  await apiRequest(`/cases/${encodeURIComponent(id)}`, { method: "DELETE" });
  showToast("共有案件を削除しました。");
  await openCases();
}

function exportCsv() {
  updateOutputs();
  const calc = getCalc();
  const scores = getScores();
  const rows = [["section", "key", "value"]];
  Object.entries(state.product).forEach(([key, value]) => rows.push(["product", key, value]));
  rows.push(["calculation", "profitUnit", Math.round(calc.profitUnit)]);
  rows.push(["calculation", "marginPct", round(calc.margin)]);
  rows.push(["calculation", "roiPct", round(calc.roi)]);
  rows.push(["calculation", "monthlyProfit", Math.round(calc.monthlyProfit)]);
  rows.push(["score", "total", Math.round(scores.total)]);
  state.competitors.forEach((row, index) => Object.entries(row).forEach(([key, value]) => rows.push([`competitor_${index + 1}`, key, value])));
  state.keywords.forEach((row, index) => Object.entries(row).forEach(([key, value]) => rows.push([`keyword_${index + 1}`, key, value])));
  checklist.forEach(([id, title]) => rows.push(["check", title, state.checks[id] ? "done" : "open"]));
  rows.push(["summary", "text", elements.summaryBox.textContent]);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amazon-research-${safeFilename(state.product.name || "case")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("CSVを出力しました。");
}

function handleProductInput(event) {
  const field = event.target.closest("[data-bind]");
  if (!field) return;
  state.product[field.dataset.bind] = field.type === "number" ? num(field.value) : field.value;
  updateOutputs();
  scheduleDraftSave();
}

function handleTableInput(event) {
  const field = event.target.closest("[data-table]");
  if (!field) return;
  const table = field.dataset.table;
  const index = Number(field.dataset.index);
  const key = field.dataset.field;
  if (!state[table]?.[index]) return;
  state[table][index][key] = field.type === "number" ? num(field.value) : field.value;
  updateOutputs();
  scheduleDraftSave();
}

function removeRow(type, index) {
  const row = state[type][index];
  const hasValue = Object.values(row || {}).some((value) => String(value || "").trim() && Number(value) !== 0);
  if (hasValue && !window.confirm("入力済みの行を削除します。よろしいですか？")) return;
  state[type].splice(index, 1);
  if (!state[type].length) state[type].push(type === "competitors" ? emptyCompetitor() : emptyKeyword());
  type === "competitors" ? renderCompetitors() : renderKeywords();
  updateOutputs();
  scheduleDraftSave();
  showToast("行を削除しました。");
}

function updateSaveStatus(prefix) {
  const date = state.updatedAt ? new Date(state.updatedAt) : new Date();
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  elements.saveStatus.textContent = `${prefix} ${time}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function setText(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function setBar(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.style.width = `${clamp(value)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 48);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "未保存";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

document.addEventListener("input", (event) => {
  handleProductInput(event);
  handleTableInput(event);
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-check]");
  if (checkbox) {
    state.checks[checkbox.dataset.check] = checkbox.checked;
    updateOutputs();
    scheduleDraftSave();
  }
  handleProductInput(event);
  handleTableInput(event);
});

document.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    removeRow(removeButton.dataset.remove, Number(removeButton.dataset.index));
    return;
  }
  const loadCaseButton = event.target.closest("[data-load-case]");
  if (loadCaseButton) {
    await loadSharedCase(loadCaseButton.dataset.loadCase);
    return;
  }
  const deleteCaseButton = event.target.closest("[data-delete-case]");
  if (deleteCaseButton) {
    await deleteSharedCase(deleteCaseButton.dataset.deleteCase);
  }
});

document.querySelector("#addCompetitorButton").addEventListener("click", () => {
  state.competitors.push(emptyCompetitor());
  renderCompetitors();
  scheduleDraftSave();
  showToast("競合行を追加しました。");
});

document.querySelector("#addKeywordButton").addEventListener("click", () => {
  state.keywords.push(emptyKeyword());
  renderKeywords();
  scheduleDraftSave();
  showToast("キーワード行を追加しました。");
});

document.querySelector("#newButton").addEventListener("click", () => {
  if (!window.confirm("現在の入力内容を新規案件で置き換えます。共有保存済みデータは消えません。よろしいですか？")) return;
  state = defaultState();
  saveDraft();
  renderAll();
  showToast("新規案件を開始しました。");
});

document.querySelector("#sampleButton").addEventListener("click", () => {
  if (!window.confirm("サンプル値で現在の入力内容を置き換えます。共有保存済みデータは消えません。よろしいですか？")) return;
  state = sampleState();
  saveDraft();
  renderAll();
  showToast("サンプルを読み込みました。");
});

document.querySelector("#saveButton").addEventListener("click", async () => {
  try {
    await saveSharedCase();
  } catch (error) {
    showToast(error.message || "共有保存できませんでした。");
  }
});

document.querySelector("#loadButton").addEventListener("click", async () => {
  try {
    await openCases();
  } catch (error) {
    showToast(error.message || "共有一覧を開けませんでした。");
  }
});

document.querySelector("#closeCasesButton").addEventListener("click", () => {
  elements.caseDrawer.hidden = true;
});

elements.caseDrawer.addEventListener("click", (event) => {
  if (event.target === elements.caseDrawer) elements.caseDrawer.hidden = true;
});

document.querySelector("#copyButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.summaryBox.textContent);
    showToast("判定サマリーをコピーしました。");
  } catch {
    showToast("コピーできませんでした。サマリー欄を選択してコピーしてください。");
  }
});

document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelector("#printButton").addEventListener("click", () => window.print());

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.caseDrawer.hidden) elements.caseDrawer.hidden = true;
});

renderAll();
updateSaveStatus(state.updatedAt ? "下書き読込" : "未保存");
