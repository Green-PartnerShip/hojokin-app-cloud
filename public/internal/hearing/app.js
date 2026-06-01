const APP_VERSION = "1.1.0";

const modes = {
  company: {
    label: "会社用",
    title: "法人・会社向けヒアリングシート",
    entity: "法人・会社",
    storageKey: "gp-hearing-sorter-company",
    filePrefix: "会社用"
  },
  personal: {
    label: "個人用",
    title: "個人事業主向けヒアリングシート",
    entity: "個人事業主",
    storageKey: "gp-hearing-sorter-personal",
    filePrefix: "個人用"
  }
};

const subsidyOptions = [
  "小規模事業者持続化補助金",
  "省力化投資補助金",
  "ものづくり補助金",
  "新事業進出補助金",
  "業務改善助成金",
  "その他・未定"
];

const sections = [
  {
    id: "case",
    title: "相談の基本",
    lead: "どの補助金を、どの段階で、誰が担当しているかを整理します。",
    fields: [
      { id: "staffName", label: "社内担当者", placeholder: "例：山田 太郎", required: true },
      { id: "hearingDate", label: "ヒアリング日", type: "date" },
      { id: "clientPlan", label: "顧問プラン", type: "select", options: ["未契約", "ミニ", "スタンダード", "プレミアム", "スポット", "確認中"] },
      { id: "subsidyType", label: "主に検討する補助金", type: "select", options: subsidyOptions, required: true },
      { id: "applicationRound", label: "申請回・公募回", placeholder: "例：第18回、次回公募、確認中" },
      { id: "targetDeadline", label: "目標の提出時期", placeholder: "例：2026年7月末まで" },
      { id: "supportStage", label: "現在の段階", type: "select", options: ["初回相談", "ヒアリング中", "必要書類待ち", "計画書作成中", "申請前確認", "採択後準備", "確認中"] },
      { id: "priority", label: "対応の急ぎ具合", type: "select", options: ["通常", "やや急ぎ", "急ぎ", "いったん保留", "確認中"] }
    ]
  },
  {
    id: "business",
    title: "事業者の基本情報",
    lead: "申請者の基本情報を、申請書に転記しやすい形で残します。",
    fields: [
      { id: "companyName", label: "会社名・屋号", placeholder: "例：株式会社グリーンパートナーシップ", required: true },
      { id: "companyKana", label: "ふりがな", placeholder: "例：かぶしきがいしゃぐりーんぱーとなーしっぷ" },
      { id: "representativeName", label: "代表者名", placeholder: "例：山田 太郎", required: true },
      { id: "representativeRole", label: "代表者の役職", placeholder: "例：代表取締役、代表" },
      { id: "representativeBirth", label: "代表者の生年月日", placeholder: "例：1980年4月1日" },
      { id: "companyAddress", label: "本店・主たる所在地", placeholder: "都道府県から入力", required: true, wide: true },
      { id: "companyPhone", label: "電話番号", placeholder: "例：06-0000-0000" },
      { id: "companyEmail", label: "メールアドレス", placeholder: "例：info@example.jp" },
      { id: "website", label: "ホームページ", placeholder: "例：https://example.jp" },
      { id: "establishedAt", label: "設立年月日", placeholder: "例：2018年5月", modes: ["company"] },
      { id: "openingDate", label: "開業日", placeholder: "例：2020年4月", modes: ["personal"] },
      { id: "capital", label: "資本金", placeholder: "例：300万円", modes: ["company"] },
      { id: "taxType", label: "消費税の区分", type: "select", options: ["課税", "免税", "簡易課税", "確認中"] },
      { id: "invoiceStatus", label: "インボイス登録", type: "select", options: ["登録済み", "登録予定", "登録なし", "確認中"] },
      { id: "gbizStatus", label: "電子申請の準備", type: "select", options: ["GビズID取得済み", "申請中", "未取得", "確認中"], note: "パスワードは入力しないでください。" }
    ]
  },
  {
    id: "people",
    title: "連絡先と従業員",
    lead: "連絡窓口、従業員数、賃金まわりを確認します。",
    fields: [
      { id: "contactName", label: "主な連絡担当者", placeholder: "例：山田 花子", required: true },
      { id: "contactPhone", label: "担当者の電話番号", placeholder: "例：090-0000-0000" },
      { id: "contactEmail", label: "担当者のメール", placeholder: "例：contact@example.jp" },
      { id: "officerCount", label: "役員数", placeholder: "例：2名", modes: ["company"] },
      { id: "employeeFull", label: "正社員数", placeholder: "例：5名" },
      { id: "employeePart", label: "パート・アルバイト数", placeholder: "例：3名" },
      { id: "payrollClosing", label: "給与の締日", placeholder: "例：月末締め" },
      { id: "payrollPayment", label: "給与の支払日", placeholder: "例：翌月10日払い" },
      { id: "lowestWage", label: "現在の一番低い時給", placeholder: "例：1,150円。月給の場合は月給と記載" },
      { id: "wageIncreasePlan", label: "賃上げの予定", placeholder: "例：採択後に時給を50円上げる予定", wide: true }
    ]
  },
  {
    id: "workplace",
    title: "事業所とサービス内容",
    lead: "実際に補助事業を行う場所と、今の事業内容を整理します。",
    fields: [
      { id: "officeName", label: "事業所名", placeholder: "例：本社工場、〇〇店", required: true },
      { id: "officeAddress", label: "事業所の住所", placeholder: "都道府県から入力", required: true, wide: true },
      { id: "officePhone", label: "事業所の電話番号", placeholder: "例：06-0000-0000" },
      { id: "openingHours", label: "営業時間", placeholder: "例：9:00から18:00" },
      { id: "holidays", label: "定休日", placeholder: "例：日曜、祝日" },
      { id: "businessDescription", label: "現在の主な事業", placeholder: "例：自動車のカーフィルム施工、内装工事、飲食店運営など", required: true, wide: true },
      { id: "mainProducts", label: "主な商品・サービス", placeholder: "例：防水工事、塗装工事、カーフィルム施工", required: true, wide: true },
      { id: "targetCustomers", label: "主なお客様", placeholder: "例：近隣の個人客、法人の工事会社、車販売店など", wide: true },
      { id: "averagePrice", label: "客単価・単価の目安", placeholder: "例：1件あたり3万円前後" },
      { id: "salesTrend", label: "最近の売上の動き", placeholder: "例：昨年より増加、横ばい、原材料高で利益が落ちている", wide: true }
    ]
  },
  {
    id: "current",
    title: "現状の整理",
    lead: "強み、課題、競合、今後の方向性を、計画書に使いやすい言葉で残します。",
    fields: [
      { id: "strengths", label: "強み・選ばれている理由", type: "textarea", placeholder: "例：短納期に対応できる、職人の経験が長い、地域での紹介が多い", required: true, wide: true },
      { id: "issues", label: "いま困っていること", type: "textarea", placeholder: "例：手作業が多く生産量に限界がある、新しい客層に届いていない", required: true, wide: true },
      { id: "weakPoints", label: "弱み・改善したいこと", type: "textarea", placeholder: "例：設備が古い、作業スペースが狭い、発信が弱い", wide: true },
      { id: "competitors", label: "競合・周辺の状況", type: "textarea", placeholder: "例：近隣に同業者が多いが、専門施工までできる会社は少ない", wide: true },
      { id: "opportunities", label: "伸ばせそうな機会", type: "textarea", placeholder: "例：近隣で新しい店舗が増えている、法人からの相談が増えている", wide: true },
      { id: "futurePolicy", label: "今後の方針", type: "textarea", placeholder: "例：既存事業を安定させながら、新しいサービスを育てたい", wide: true },
      { id: "growthGoal", label: "今回の目標", type: "textarea", placeholder: "例：新規顧客を増やし、月商を20%上げたい", required: true, wide: true }
    ]
  },
  {
    id: "project",
    title: "補助事業・投資計画",
    lead: "何に投資し、どんな変化を起こすのかを整理します。",
    fields: [
      { id: "projectName", label: "計画名", placeholder: "例：カーフィルム施工ガレージ整備による新規顧客開拓事業", required: true, wide: true },
      { id: "investmentItem1", label: "投資内容 1", placeholder: "例：作業場の改装工事、設備導入、機械購入", required: true, wide: true },
      { id: "investmentItem2", label: "投資内容 2", placeholder: "必要に応じて入力", wide: true },
      { id: "investmentItem3", label: "投資内容 3", placeholder: "必要に応じて入力", wide: true },
      { id: "investmentTotal", label: "投資額の合計", placeholder: "例：3,004,420円（税抜）", required: true },
      { id: "projectReason", label: "この投資が必要な理由", type: "textarea", placeholder: "例：既存設備では受注増に対応できず、作業時間も長くなっているため", required: true, wide: true },
      { id: "projectDetails", label: "具体的に行う取り組み", type: "textarea", placeholder: "例：作業導線を見直し、専用設備を導入して、受注から納品までを短くする", required: true, wide: true },
      { id: "salesPlan", label: "販路開拓・集客の取り組み", type: "textarea", placeholder: "例：既存顧客への案内、ホームページ更新、近隣企業への営業、紹介依頼", wide: true },
      { id: "laborSavingPlan", label: "省力化・作業時間短縮の内容", type: "textarea", placeholder: "例：手作業を機械化し、1件あたりの作業時間を短縮する", wide: true },
      { id: "newBusinessPlan", label: "新事業・新サービスの内容", type: "textarea", placeholder: "例：既存の内装工事に加え、車両向けフィルム施工を本格展開する", wide: true },
      { id: "productivityPlan", label: "生産性を上げる工夫", type: "textarea", placeholder: "例：作業工程を分け、少人数でも対応できる流れにする", wide: true },
      { id: "expectedEffects", label: "期待できる効果", type: "textarea", placeholder: "例：受注件数の増加、作業時間の短縮、粗利益の改善、新規顧客の獲得", required: true, wide: true }
    ]
  },
  {
    id: "numbers",
    title: "数字の見込み",
    lead: "分かる範囲で、現在と補助事業後の変化を数字で残します。",
    fields: [
      { id: "currentSales", label: "現在の売上", placeholder: "例：月商300万円、年商3,600万円" },
      { id: "targetSales", label: "補助事業後の売上目標", placeholder: "例：月商360万円を目指す" },
      { id: "currentProfit", label: "現在の利益感", placeholder: "例：粗利益率40%前後、利益は横ばい" },
      { id: "targetProfit", label: "補助事業後の利益目標", placeholder: "例：粗利益を月30万円増やす" },
      { id: "currentProductivity", label: "現在の作業量・処理数", placeholder: "例：1日3件、1件あたり2時間" },
      { id: "targetProductivity", label: "導入後の作業量・処理数", placeholder: "例：1日5件、1件あたり1時間半" },
      { id: "targetCustomerCount", label: "新規顧客・取引先の目標", placeholder: "例：月10件の新規問い合わせ" },
      { id: "salesComposition", label: "売上構成の変化", placeholder: "例：新サービスで売上全体の20%を目指す", wide: true }
    ]
  },
  {
    id: "documents",
    title: "過去申請・書類・注意点",
    lead: "過去の補助金、事前着手、写真、書類の準備状況を確認します。",
    fields: [
      { id: "pastSubsidies", label: "過去に使った補助金", type: "textarea", placeholder: "例：持続化給付金、小規模持続化補助金、業務改善助成金など", wide: true },
      { id: "priorStartStatus", label: "すでに着手しているか", type: "select", options: ["未着手", "一部着手済み", "完了済み", "確認中"] },
      { id: "photosStatus", label: "施工前・設置前の写真", type: "select", options: ["撮影済み", "これから撮影", "写真なし", "確認中"] },
      { id: "estimateStatus", label: "見積書の準備", type: "select", options: ["取得済み", "依頼中", "これから依頼", "確認中"] },
      { id: "documentNotes", label: "書類についての補足", type: "textarea", placeholder: "例：見積書の内訳確認が必要、写真はアルバムに保存済み", wide: true },
      { id: "customerPromises", label: "お客様との約束事項", type: "textarea", placeholder: "例：追加資料は金曜日までに送付予定", wide: true }
    ]
  },
  {
    id: "internal",
    title: "社内メモ・申し送り",
    lead: "お客様には見せない社内向けの注意点です。印刷表示では隠れます。",
    internal: true,
    fields: [
      { id: "handoff", label: "申し送り事項", type: "textarea", placeholder: "例：紹介案件、過去のやり取り、次回までに確認したいこと", wide: true },
      { id: "riskNotes", label: "気になる点・リスク", type: "textarea", placeholder: "例：事前着手の可能性あり、対象外経費が混ざっている可能性あり", wide: true },
      { id: "nextAction", label: "次に行うこと", type: "textarea", placeholder: "例：見積書の内訳確認、商工会議所への様式確認、写真の回収", wide: true },
      { id: "internalOwner", label: "次の担当者", placeholder: "例：計画書作成は佐藤、書類回収は田中" }
    ]
  }
];

const programRequired = {
  "小規模事業者持続化補助金": ["salesPlan", "targetCustomers"],
  "省力化投資補助金": ["laborSavingPlan", "productivityPlan", "currentProductivity", "targetProductivity"],
  "ものづくり補助金": ["productivityPlan", "currentProductivity", "targetProductivity"],
  "新事業進出補助金": ["newBusinessPlan", "targetSales", "salesComposition"],
  "業務改善助成金": ["lowestWage", "wageIncreasePlan", "employeeFull"]
};

const recommendedFieldIds = new Set([
  "hearingDate",
  "clientPlan",
  "applicationRound",
  "targetDeadline",
  "supportStage",
  "priority",
  "companyKana",
  "representativeRole",
  "companyPhone",
  "companyEmail",
  "establishedAt",
  "openingDate",
  "capital",
  "taxType",
  "invoiceStatus",
  "gbizStatus",
  "contactPhone",
  "contactEmail",
  "employeeFull",
  "employeePart",
  "payrollClosing",
  "payrollPayment",
  "lowestWage",
  "wageIncreasePlan",
  "officePhone",
  "targetCustomers",
  "averagePrice",
  "salesTrend",
  "weakPoints",
  "competitors",
  "opportunities",
  "futurePolicy",
  "investmentItem2",
  "investmentItem3",
  "salesPlan",
  "laborSavingPlan",
  "newBusinessPlan",
  "productivityPlan",
  "currentSales",
  "targetSales",
  "currentProductivity",
  "targetProductivity",
  "targetCustomerCount",
  "salesComposition",
  "pastSubsidies",
  "priorStartStatus",
  "photosStatus",
  "estimateStatus",
  "handoff",
  "riskNotes",
  "nextAction",
  "internalOwner"
]);

const priorityMeta = {
  1: { label: "必須", className: "required" },
  2: { label: "あると良い", className: "recommended" },
  3: { label: "補足", className: "optional" }
};

const baseDocuments = {
  company: [
    "直近の決算書一式（損益計算書、貸借対照表、法人税申告書の主なページ）",
    "履歴事項全部証明書",
    "見積書、カタログ、仕様が分かる資料",
    "事業を行う場所の写真（工事前・設置前）",
    "従業員がいる場合は賃金台帳と労働条件通知書",
    "電子申請に使うGビズIDの準備状況"
  ],
  personal: [
    "直近の確定申告書",
    "青色申告決算書、または収支内訳書",
    "本人確認書類や開業日が分かる資料",
    "見積書、カタログ、仕様が分かる資料",
    "事業を行う場所の写真（工事前・設置前）",
    "従業員がいる場合は賃金台帳と労働条件通知書"
  ]
};

const programDocuments = {
  "小規模事業者持続化補助金": [
    "商工会議所または商工会で確認が必要な書類",
    "販路開拓の内容が分かる資料",
    "賃上げ特例やインボイス特例を使う場合の確認資料"
  ],
  "省力化投資補助金": [
    "導入する製品・設備の資料",
    "省力化できる作業内容と作業時間の見込み",
    "販売事業者、設置場所、導入後の運用体制が分かる資料"
  ],
  "ものづくり補助金": [
    "新しい製品・サービス・生産方法の説明資料",
    "3年から5年の売上、利益、賃金の見込み",
    "設備導入により変わる工程や作業時間の資料"
  ],
  "新事業進出補助金": [
    "新しく取り組む事業の市場や顧客が分かる資料",
    "既存事業との違いが分かる説明",
    "投資後の売上構成、販売方法、実施体制の資料"
  ],
  "業務改善助成金": [
    "賃金台帳、労働条件通知書、就業規則が分かる資料",
    "引き上げ前後の時給や月給が分かる資料",
    "設備導入で業務改善される内容が分かる資料"
  ]
};

const helpItems = [
  {
    name: "会社用・個人用",
    body: "入口を分けるための切り替えです。会社用は法人・会社向けに、決算書や登記情報を前提にした項目が出ます。個人用は個人事業主向けに、確定申告書や開業情報を前提にした項目が出ます。URL自体も分かれているので、ブックマークして使い分けできます。"
  },
  {
    name: "Excelを読み込む",
    body: "既存のヒアリングシートや、このアプリから出力したExcelを読み込みます。このアプリで出したExcelには読み込み用のデータも入るため、次回読み込むと入力内容をかなり正確に復元できます。古い形式のExcelも、会社名、住所、計画名、投資額、申し送りなどをできる範囲で読み取ります。"
  },
  {
    name: "目次",
    body: "入力項目の一覧を横から開きます。大項目を開くと、その中の入力項目が表示されます。確認したい項目を押すと該当する入力欄まで移動します。画面を広く使えるよう、目次は必要な時だけ表示されます。"
  },
  {
    name: "入力を整理",
    body: "入力された内容から、事業者の概要、現在の課題、補助事業の内容、期待できる効果、次に確認すべきことを右側にまとめます。申請書の下書きそのものではなく、申請書を作る前の材料整理として使う想定です。"
  },
  {
    name: "入力項目の並び",
    body: "各大項目の中は、まず入力必須と思われる項目、次にあったほうが良い項目、最後に補足として使う項目の順で並んでいます。選んだ補助金によって必須になる項目は、自動的に上側へ寄ります。"
  },
  {
    name: "Excel出力",
    body: "入力内容、整理結果、不足している確認事項、必要書類の目安をExcelに出力します。必須項目が未入力でも出力できます。不足している内容は「不足確認」シートにまとまるので、途中保存や社内共有にも使えます。何も入力していない状態でも、万能ヒアリングシートのひな形として出力できます。出力したExcelは、あとからこのアプリに読み込めます。"
  },
  {
    name: "印刷表示",
    body: "お客様に画面共有したり、PDFとして保存したりするための表示です。社内メモや申し送りは印刷時に隠れるようにしています。お客様に見せる前に、右側の整理結果に社内向けの内容が混ざっていないかだけ確認してください。"
  },
  {
    name: "新規作成",
    body: "別の顧問先を新しく入力するためのボタンです。今画面に出ている内容を空にして、新しい共有データとして保存できる状態にします。すでに共有保存済みのデータは消えません。"
  },
  {
    name: "共有保存",
    body: "現在の入力内容を社内共有データとして保存します。初回保存時は新しい顧問先データが作られ、2回目以降は同じ顧問先データを更新します。他の方が先に更新していた場合は、上書きする前に警告します。"
  },
  {
    name: "共有一覧",
    body: "社内共有データの一覧を開きます。会社名・屋号、補助金、担当者名で検索できます。一覧から開くと、他の方が保存した続きから入力できます。"
  },
  {
    name: "入力クリア",
    body: "画面上の入力欄を空にします。ブラウザに保存した内容までは消しません。別の顧問先の入力を始める前に使います。"
  },
  {
    name: "コピー",
    body: "右側の整理結果だけを文章としてコピーします。社内チャット、月次レポート、計画書作成担当への申し送りに貼り付けるときに便利です。"
  }
];

const fieldMap = new Map(sections.flatMap((section) => section.fields.map((field) => [field.id, field])));
const MIN_INVESTMENT_ITEMS = 3;

let mode = window.location.pathname.toLowerCase().includes("personal") ? "personal" : "company";
let state = {};
let currentCaseId = "";
let currentCaseRevision = 0;
let currentCaseUpdatedAt = "";
let sharedCaseSummaries = [];
let caseSearchTimer = null;
let sharedEvents = null;
let clientId = "";

const formContainer = document.getElementById("formContainer");
const scoreValue = document.getElementById("scoreValue");
const scoreRing = document.querySelector(".score-ring");
const scoreLabel = document.getElementById("scoreLabel");
const missingList = document.getElementById("missingList");
const missingCount = document.getElementById("missingCount");
const summaryOutput = document.getElementById("summaryOutput");
const documentList = document.getElementById("documentList");
const toast = document.getElementById("toast");
const caseOverlay = document.getElementById("caseOverlay");
const caseList = document.getElementById("caseList");
const caseDrawerStatus = document.getElementById("caseDrawerStatus");
let tooltipElement = null;
let tooltipTimer = null;
let tooltipTarget = null;

document.addEventListener("DOMContentLoaded", () => {
  clientId = getClientId();
  setupMode();
  renderForm();
  renderToc();
  renderHelp();
  bindEvents();
  updateOutputs();
  updateSharedStatus();
  startSharedEvents();
  refreshIcons();
});

function setupMode() {
  document.getElementById("modeTitle").textContent = modes[mode].title;
  document.getElementById("modeBadge").textContent = modes[mode].label;
  document.getElementById("entityChip").textContent = modes[mode].label;
  document.getElementById("documentModeLabel").textContent = modes[mode].label;
  const companyLink = document.getElementById("companyLink");
  const personalLink = document.getElementById("personalLink");
  if (companyLink) companyLink.classList.toggle("active", mode === "company");
  if (personalLink) personalLink.classList.toggle("active", mode === "personal");
}

function bindEvents() {
  document.getElementById("excelInput").addEventListener("change", handleExcelInput);
  document.getElementById("tocButton").addEventListener("click", openToc);
  document.getElementById("organizeButton").addEventListener("click", () => {
    updateOutputs();
    showToast("入力内容を整理しました。");
  });
  document.getElementById("exportButton").addEventListener("click", exportWorkbook);
  document.getElementById("printButton").addEventListener("click", printCustomerView);
  document.getElementById("newCaseButton").addEventListener("click", startNewSharedCase);
  document.getElementById("saveButton").addEventListener("click", saveSharedCase);
  document.getElementById("loadButton").addEventListener("click", openCases);
  document.getElementById("clearButton").addEventListener("click", clearForm);
  document.getElementById("copySummaryButton").addEventListener("click", copySummary);
  document.getElementById("helpButton").addEventListener("click", openHelp);
  document.getElementById("closeHelpButton").addEventListener("click", closeHelp);
  document.getElementById("closeTocButton").addEventListener("click", closeToc);
  document.getElementById("closeCasesButton").addEventListener("click", closeCases);
  document.getElementById("refreshCasesButton").addEventListener("click", loadSharedCaseSummaries);
  document.getElementById("caseSearchInput").addEventListener("input", () => {
    window.clearTimeout(caseSearchTimer);
    caseSearchTimer = window.setTimeout(loadSharedCaseSummaries, 220);
  });
  document.getElementById("helpOverlay").addEventListener("click", (event) => {
    if (event.target.id === "helpOverlay") closeHelp();
  });
  document.getElementById("tocOverlay").addEventListener("click", (event) => {
    if (event.target.id === "tocOverlay") closeToc();
  });
  document.getElementById("caseOverlay").addEventListener("click", (event) => {
    if (event.target.id === "caseOverlay") closeCases();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHelp();
      closeToc();
      closeCases();
    }
  });
}

function setupTooltips() {
  tooltipElement = document.createElement("div");
  tooltipElement.className = "smart-tooltip";
  tooltipElement.setAttribute("role", "tooltip");
  document.body.appendChild(tooltipElement);

  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-tip]");
    if (!target) return;
    scheduleTooltip(target);
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target.closest?.("[data-tip]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideTooltip();
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest?.("[data-tip]");
    if (target) scheduleTooltip(target, 0);
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target.closest?.("[data-tip]");
    if (target) hideTooltip();
  });

  window.addEventListener("scroll", () => {
    if (tooltipTarget) positionTooltip(tooltipTarget);
  }, true);
  window.addEventListener("resize", hideTooltip);
}

function scheduleTooltip(target, delay = 420) {
  const text = target.getAttribute("data-tip");
  if (!text) return;
  window.clearTimeout(tooltipTimer);
  tooltipTarget = target;
  tooltipTimer = window.setTimeout(() => showTooltip(target, text), delay);
}

function showTooltip(target, text) {
  if (!tooltipElement || tooltipTarget !== target) return;
  tooltipElement.textContent = text;
  tooltipElement.style.visibility = "hidden";
  tooltipElement.style.left = "12px";
  tooltipElement.style.top = "12px";
  tooltipElement.classList.add("show");
  positionTooltip(target);
  tooltipElement.style.visibility = "visible";
}

function positionTooltip(target) {
  if (!tooltipElement || !target?.isConnected) {
    hideTooltip();
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tipRect = tooltipElement.getBoundingClientRect();
  const gap = 10;
  const edge = 12;
  let top = targetRect.top - tipRect.height - gap;

  if (top < edge) {
    top = targetRect.bottom + gap;
  }
  if (top + tipRect.height > window.innerHeight - edge) {
    top = Math.max(edge, window.innerHeight - tipRect.height - edge);
  }

  let left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
  left = Math.min(Math.max(edge, left), window.innerWidth - tipRect.width - edge);

  tooltipElement.style.left = `${Math.round(left)}px`;
  tooltipElement.style.top = `${Math.round(top)}px`;
}

function hideTooltip() {
  window.clearTimeout(tooltipTimer);
  tooltipTarget = null;
  if (tooltipElement) {
    tooltipElement.classList.remove("show");
    tooltipElement.style.visibility = "hidden";
  }
}

function renderForm() {
  formContainer.innerHTML = sections.map((section, index) => {
    const fields = getSectionVisibleFields(section)
      .map((field) => field.type === "investmentControl" ? renderInvestmentControls() : renderField(field))
      .join("");

    return `
      <section id="section-${section.id}" class="form-section ${section.internal ? "internal-section" : ""}">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.lead)}</p>
          </div>
          <span class="section-number">${index + 1}</span>
        </div>
        <div class="fields-grid">${fields}</div>
      </section>
    `;
  }).join("");

  formContainer.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", handleFieldChange);
    input.addEventListener("change", handleFieldChange);
  });

  formContainer.querySelectorAll("[data-add-investment]").forEach((button) => {
    button.addEventListener("click", addInvestmentItem);
  });
}

function getSectionVisibleFields(section) {
  const baseFields = section.fields.filter((field) => !field.modes || field.modes.includes(mode));
  if (section.id !== "project") return sortFieldsByPriority(baseFields);

  const count = getInvestmentItemCount();
  const extraFields = [];
  for (let index = 4; index <= count; index += 1) {
    extraFields.push({
      id: `investmentItem${index}`,
      label: `投資内容 ${index}`,
      placeholder: "必要に応じて入力",
      wide: true
    });
  }

  const insertIndex = baseFields.findIndex((field) => field.id === "investmentItem3");
  const controlField = { id: "investmentControl", type: "investmentControl" };
  const projectFields = insertIndex === -1
    ? baseFields.concat(extraFields, controlField)
    : baseFields.slice(0, insertIndex + 1).concat(extraFields, controlField, baseFields.slice(insertIndex + 1));
  return sortFieldsByPriority(projectFields);
}

function sortFieldsByPriority(fields) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((left, right) => {
      const priorityDiff = getFieldPriority(left.field) - getFieldPriority(right.field);
      return priorityDiff || left.index - right.index;
    })
    .map((entry) => entry.field);
}

function getFieldPriority(field) {
  if (!field || field.type === "investmentControl") return 2;
  if (isRequired(field.id)) return 1;
  if (/^investmentItem\d+$/.test(field.id) || recommendedFieldIds.has(field.id)) return 2;
  return 3;
}

function getFieldPriorityMeta(field) {
  return priorityMeta[getFieldPriority(field)] || priorityMeta[3];
}

function getInvestmentItemCount() {
  const savedCount = Number(state.investmentItemCount || MIN_INVESTMENT_ITEMS);
  const highestFilled = Object.keys(state)
    .map((key) => key.match(/^investmentItem(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .reduce((max, next) => Math.max(max, next), MIN_INVESTMENT_ITEMS);
  return Math.max(MIN_INVESTMENT_ITEMS, savedCount, highestFilled);
}

function renderInvestmentControls() {
  return `
    <div class="field wide investment-actions">
      <button class="mini-button add-investment-button" type="button" data-add-investment data-tip="投資内容が4つ以上ある場合に、入力欄を1つ追加します。">
        <i data-lucide="plus" aria-hidden="true"></i>
        <span>投資内容を追加</span>
      </button>
      <p class="field-note">設備、工事、システム、広告など、投資内容が複数ある場合は必要な分だけ増やせます。</p>
    </div>
  `;
}

function addInvestmentItem() {
  const nextCount = getInvestmentItemCount() + 1;
  state.investmentItemCount = String(nextCount);
  document.getElementById("savedStatus").textContent = currentCaseId ? "共有未保存" : "新規未保存";
  renderForm();
  renderToc();
  updateOutputs();
  refreshIcons();
  window.setTimeout(() => {
    document.getElementById(`investmentItem${nextCount}`)?.focus();
  }, 0);
  showToast(`投資内容 ${nextCount} を追加しました。`);
}

function renderToc() {
  const tocList = document.getElementById("tocList");
  tocList.innerHTML = sections.map((section, index) => {
    const fields = getSectionVisibleFields(section)
      .filter((field) => field.type !== "investmentControl")
      .map((field) => `
        <button class="toc-link" type="button" data-scroll-target="${field.id}">
          <span>${escapeHtml(field.label)}</span>
        </button>
      `)
      .join("");

    return `
      <details class="toc-group" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="toc-number">${index + 1}</span>
          <span>${escapeHtml(section.title)}</span>
        </summary>
        <div class="toc-children">
          <button class="toc-link toc-section-link" type="button" data-scroll-target="section-${section.id}">
            <span>この大項目の先頭へ</span>
          </button>
          ${fields}
        </div>
      </details>
    `;
  }).join("");

  tocList.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollToTarget(button.dataset.scrollTarget);
    });
  });
}

function renderField(field) {
  const value = state[field.id] || "";
  const required = isRequired(field.id);
  const priority = getFieldPriorityMeta(field);
  const classes = ["field"];
  if (field.wide || field.type === "textarea") classes.push("wide");

  const label = `
    <label for="${field.id}">
      ${required ? "<span class=\"required-dot\" aria-hidden=\"true\"></span>" : ""}
      <span>${escapeHtml(field.label)}</span>
      <span class="priority-badge ${priority.className}">${priority.label}</span>
    </label>
  `;

  let control = "";
  if (field.type === "textarea") {
    control = `<textarea id="${field.id}" data-field="${field.id}" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea>`;
  } else if (field.type === "select") {
    const options = [`<option value="">選択してください</option>`]
      .concat(field.options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`))
      .join("");
    control = `<select id="${field.id}" data-field="${field.id}">${options}</select>`;
  } else {
    control = `<input id="${field.id}" data-field="${field.id}" type="${field.type || "text"}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || "")}">`;
  }

  const note = field.note ? `<p class="field-note">${escapeHtml(field.note)}</p>` : "";
  return `<div class="${classes.join(" ")}">${label}${control}${note}</div>`;
}

function handleFieldChange(event) {
  const id = event.currentTarget.dataset.field;
  state[id] = normalizeFieldValue(id, event.currentTarget.value.trim());
  document.getElementById("savedStatus").textContent = currentCaseId ? "共有未保存" : "新規未保存";
  document.getElementById("updatedStatus").textContent = "入力中";
  if (id === "subsidyType") {
    renderForm();
    renderToc();
    refreshIcons();
  }
  updateOutputs();
}

function normalizeFieldValue(id, nextValue) {
  if (id === "clientPlan" && nextValue === "ノーマル") return "ミニ";
  return nextValue;
}

function normalizeLoadedState(nextState = {}) {
  const normalized = { ...nextState };
  if (normalized.clientPlan === "ノーマル") normalized.clientPlan = "ミニ";
  return normalized;
}

function isRequired(fieldId) {
  const field = fieldMap.get(fieldId);
  if (!field) return false;
  if (field.required === true) return true;
  if (Array.isArray(field.required)) return field.required.includes(mode);
  const subsidy = state.subsidyType;
  return Boolean(subsidy && programRequired[subsidy]?.includes(fieldId));
}

function getVisibleFieldIds() {
  return sections.flatMap((section) => getSectionVisibleFields(section))
    .filter((field) => field.type !== "investmentControl")
    .map((field) => field.id);
}

function getRequiredFieldIds() {
  const base = getVisibleFieldIds().filter(isRequired);
  const extra = programRequired[state.subsidyType] || [];
  return Array.from(new Set(base.concat(extra))).filter((id) => {
    const field = fieldMap.get(id);
    return field && (!field.modes || field.modes.includes(mode));
  });
}

function updateOutputs() {
  const required = getRequiredFieldIds();
  const missing = required.filter((id) => !value(id));
  const score = required.length ? Math.round(((required.length - missing.length) / required.length) * 100) : 0;
  scoreValue.textContent = `${score}%`;
  scoreRing.style.background = `conic-gradient(var(--green) ${score * 3.6}deg, var(--soft-2) 0deg)`;
  scoreLabel.textContent = score >= 90 ? "かなり整理済み" : score >= 60 ? "あと少し" : "確認が必要";
  missingCount.textContent = `${missing.length}件`;
  missingList.innerHTML = missing.length
    ? missing.map((id) => `<li>${escapeHtml(fieldMap.get(id)?.label || id)}</li>`).join("")
    : `<li>必須の確認事項はそろっています。</li>`;

  const subsidy = value("subsidyType") || "補助金種類 未選択";
  document.getElementById("subsidyChip").textContent = subsidy;
  document.getElementById("updatedStatus").textContent = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const parts = buildSummaryParts(missing);
  summaryOutput.innerHTML = parts.map((part) => `
    <div class="summary-part">
      <h4>${escapeHtml(part.title)}</h4>
      <p>${escapeHtml(part.body)}</p>
    </div>
  `).join("");

  const docs = getDocumentList();
  documentList.innerHTML = docs.map((doc) => `<li>${escapeHtml(doc)}</li>`).join("");
}

function buildSummaryParts(missing) {
  const company = value("companyName") || "会社名・屋号未入力";
  const business = value("businessDescription") || "現在の事業内容は未入力です。";
  const project = value("projectName") || "計画名は未入力です。";
  const investmentItems = getInvestmentItems().join("、") || "投資内容は未入力です。";
  const docs = getDocumentList().slice(0, 5).join("\n・");
  const nextChecks = missing.length
    ? missing.map((id) => `・${fieldMap.get(id)?.label || id}`).join("\n")
    : "・現時点で大きな不足はありません。金額、見積書、写真、提出期限の最終確認を進めてください。";

  return [
    {
      title: "事業者・事業概要",
      body: `${company}は、${business}\n主な商品・サービス：${value("mainProducts") || "未入力"}\n主なお客様：${value("targetCustomers") || "未入力"}`
    },
    {
      title: "現在の課題と強み",
      body: `強み：${value("strengths") || "未入力"}\n課題：${value("issues") || "未入力"}\n今後の方針：${value("futurePolicy") || "未入力"}`
    },
    {
      title: "補助事業の内容",
      body: `計画名：${project}\n投資内容：${investmentItems}\n投資額：${value("investmentTotal") || "未入力"}\n必要な理由：${value("projectReason") || "未入力"}\n具体的な取り組み：${value("projectDetails") || "未入力"}`
    },
    {
      title: "期待できる効果",
      body: `期待できる効果：${value("expectedEffects") || "未入力"}\n販路開拓：${value("salesPlan") || "未入力"}\n省力化：${value("laborSavingPlan") || "未入力"}\n新事業：${value("newBusinessPlan") || "未入力"}\n生産性向上：${value("productivityPlan") || "未入力"}`
    },
    {
      title: "数字の見込み",
      body: `現在の売上：${value("currentSales") || "未入力"}\n売上目標：${value("targetSales") || "未入力"}\n現在の作業量：${value("currentProductivity") || "未入力"}\n導入後の作業量：${value("targetProductivity") || "未入力"}\n売上構成の変化：${value("salesComposition") || "未入力"}`
    },
    {
      title: "次に確認したいこと",
      body: nextChecks
    },
    {
      title: "必要書類の目安",
      body: `・${docs}`
    }
  ];
}

function getInvestmentItems() {
  const count = getInvestmentItemCount();
  const items = [];
  for (let index = 1; index <= count; index += 1) {
    const item = value(`investmentItem${index}`);
    if (item) items.push(item);
  }
  return items;
}

function getDocumentList() {
  const subsidy = state.subsidyType;
  const docs = [
    ...baseDocuments[mode],
    ...(programDocuments[subsidy] || []),
    "見積書の金額、税抜・税込、対象外になりそうな費用の確認",
    "申請前に、事前着手の有無と写真の有無を確認"
  ];
  return Array.from(new Set(docs));
}

async function saveSharedCase() {
  const payload = {
    mode,
    title: buildSharedCaseTitle(),
    state,
    revision: currentCaseRevision,
    updatedBy: getEditorName(),
    clientId
  };

  try {
    const result = currentCaseId
      ? await apiJson(`/internal/hearing/api/cases/${encodeURIComponent(currentCaseId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      })
      : await apiJson("/internal/hearing/api/cases", {
        method: "POST",
        body: JSON.stringify(payload)
      });

    applySharedCaseMeta(result.case);
    updateSharedStatus();
    showToast("社内共有データに保存しました。");
    if (!caseOverlay.hidden) loadSharedCaseSummaries();
  } catch (error) {
    if (error.status === 409 && error.data?.case) {
      handleSharedConflict(error.data.case);
      return;
    }
    showToast(error.message || "共有保存できませんでした。");
  }
}

function handleSharedConflict(remoteCase) {
  const shouldLoad = confirm("他の方が先にこの顧問先データを保存しています。最新の内容を読み込みますか？\n\n「キャンセル」を選ぶと、今の画面は残ります。必要な内容を控えてから再度保存してください。");
  if (!shouldLoad) {
    document.getElementById("savedStatus").textContent = "他の更新あり";
    return;
  }
  applySharedCase(remoteCase);
  showToast("最新の共有データを読み込みました。");
}

function startNewSharedCase() {
  if (hasInput() && !confirm("現在の入力画面を新規状態にします。共有保存済みデータは消えません。よろしいですか？")) {
    return;
  }
  currentCaseId = "";
  currentCaseRevision = 0;
  currentCaseUpdatedAt = "";
  state = {};
  renderForm();
  renderToc();
  updateOutputs();
  updateSharedStatus();
  refreshIcons();
  showToast("新しい顧問先データを入力できる状態にしました。");
}

async function openCases() {
  closeHelp();
  closeToc();
  caseOverlay.hidden = false;
  refreshIcons();
  await loadSharedCaseSummaries();
}

function closeCases() {
  caseOverlay.hidden = true;
}

async function loadSharedCaseSummaries() {
  const query = document.getElementById("caseSearchInput").value.trim();
  caseDrawerStatus.textContent = "共有データを読み込み中です。";
  try {
    const result = await apiJson(`/internal/hearing/api/cases?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(query)}`);
    sharedCaseSummaries = result.cases || [];
    renderSharedCaseList();
  } catch (error) {
    caseDrawerStatus.textContent = error.message || "共有データを読み込めませんでした。";
    caseList.innerHTML = "";
  }
}

function renderSharedCaseList() {
  caseDrawerStatus.textContent = sharedCaseSummaries.length
    ? `${sharedCaseSummaries.length}件の共有データがあります。`
    : "まだ共有保存されたデータがありません。";

  caseList.innerHTML = sharedCaseSummaries.map((item) => `
    <article class="case-item ${item.id === currentCaseId ? "active" : ""}">
      <div>
        <strong>${escapeHtml(item.title || "名称未入力")}</strong>
        <span>${escapeHtml(item.subsidyType || "補助金未選択")}</span>
        <small>${escapeHtml(formatDateTime(item.updatedAt))} 更新 / ${escapeHtml(item.updatedBy || "利用者")}</small>
      </div>
      <button class="mini-button" type="button" data-load-case="${escapeHtml(item.id)}" data-tip="この共有データを画面に読み込みます。">
        <i data-lucide="folder-open" aria-hidden="true"></i>
        <span>開く</span>
      </button>
    </article>
  `).join("");

  caseList.querySelectorAll("[data-load-case]").forEach((button) => {
    button.addEventListener("click", () => loadSharedCase(button.dataset.loadCase));
  });
  refreshIcons();
}

async function loadSharedCase(id) {
  if (!id) return;
  if (hasInput() && currentCaseId !== id && !confirm("現在の入力画面を、選んだ共有データに切り替えます。よろしいですか？")) {
    return;
  }
  try {
    const result = await apiJson(`/internal/hearing/api/cases/${encodeURIComponent(id)}`);
    applySharedCase(result.case);
    closeCases();
    showToast("共有データを読み込みました。");
  } catch (error) {
    showToast(error.message || "共有データを読み込めませんでした。");
  }
}

function applySharedCase(nextCase) {
  if (!nextCase) return;
if (nextCase.mode && nextCase.mode !== mode) {
    mode = nextCase.mode === "personal" ? "personal" : "company";
    history.replaceState(null, "", mode === "personal" ? "/internal/hearing/personal" : "/internal/hearing/company");
    setupMode();
  }
  state = normalizeLoadedState(nextCase.state || {});
  applySharedCaseMeta(nextCase);
  renderForm();
  renderToc();
  updateOutputs();
  updateSharedStatus();
  refreshIcons();
}

function applySharedCaseMeta(nextCase) {
  currentCaseId = nextCase.id || "";
  currentCaseRevision = Number(nextCase.revision || 0);
  currentCaseUpdatedAt = nextCase.updatedAt || "";
}

function buildSharedCaseTitle() {
  return value("companyName") || value("projectName") || value("contactName") || "名称未入力";
}

function updateSharedStatus() {
  const status = document.getElementById("savedStatus");
  if (!status) return;
  status.textContent = currentCaseId ? `共有保存済み v${currentCaseRevision}` : "新規未保存";
}

function hasInput() {
  return Object.entries(state).some(([key, nextValue]) => key !== "investmentItemCount" && String(nextValue || "").trim());
}

function getEditorName() {
  const key = "gp-hearing-editor-name";
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const candidate = value("staffName") || window.prompt("共有保存する担当者名を入力してください。", "") || "利用者";
  localStorage.setItem(key, candidate);
  return candidate;
}

function getClientId() {
  const key = "gp-hearing-client-id";
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const error = new Error(data.message || "共有データの通信に失敗しました。");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function startSharedEvents() {
  if (!window.EventSource) return;
  sharedEvents = new EventSource("/internal/hearing/api/events");
  sharedEvents.addEventListener("cases-changed", (event) => {
    const payload = JSON.parse(event.data || "{}");
    const changedCase = payload.case || {};
    if (!caseOverlay.hidden) {
      loadSharedCaseSummaries();
    }
    if (changedCase.lastClientId && changedCase.lastClientId === clientId) {
      return;
    }
    if (currentCaseId && changedCase.id === currentCaseId && Number(changedCase.revision || 0) > currentCaseRevision) {
      document.getElementById("savedStatus").textContent = "他の更新あり";
      showToast("この顧問先データが他の方により更新されました。共有一覧から開き直すと最新になります。");
    }
  });
}

function formatDateTime(input) {
  if (!input) return "日時不明";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function clearForm() {
  if (!confirm("入力欄を空にします。よろしいですか？")) return;
  currentCaseId = "";
  currentCaseRevision = 0;
  currentCaseUpdatedAt = "";
  state = {};
  renderForm();
  renderToc();
  updateOutputs();
  updateSharedStatus();
  refreshIcons();
  showToast("入力欄を空にしました。");
}

function printCustomerView() {
  document.body.classList.add("customer-print");
  window.print();
  window.setTimeout(() => document.body.classList.remove("customer-print"), 600);
}

async function copySummary() {
  const text = buildSummaryParts(getRequiredFieldIds().filter((id) => !value(id)))
    .map((part) => `【${part.title}】\n${part.body}`)
    .join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast("整理結果をコピーしました。");
  } catch {
    showToast("コピーできませんでした。画面上の文章を選択してコピーしてください。");
  }
}

function openHelp() {
  closeToc();
  document.getElementById("helpOverlay").hidden = false;
  refreshIcons();
}

function closeHelp() {
  document.getElementById("helpOverlay").hidden = true;
}

function openToc() {
  closeHelp();
  document.getElementById("tocOverlay").hidden = false;
  refreshIcons();
}

function closeToc() {
  document.getElementById("tocOverlay").hidden = true;
}

function scrollToTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  closeToc();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  if (target.matches("input, textarea, select")) {
    window.setTimeout(() => target.focus({ preventScroll: true }), 320);
  }
}

function renderHelp() {
  document.getElementById("buttonHelpList").innerHTML = helpItems.map((item) => `
    <div class="help-item">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.body)}</span>
    </div>
  `).join("");
}

async function handleExcelInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.XLSX) {
    showToast("Excel読み込みの部品を読み込めませんでした。インターネット接続を確認してください。");
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const parsed = parseWorkbook(workbook);
if (parsed.mode && parsed.mode !== mode) {
      mode = parsed.mode;
      history.replaceState(null, "", mode === "personal" ? "/internal/hearing/personal" : "/internal/hearing/company");
      setupMode();
    }
    state = normalizeLoadedState({ ...state, ...parsed.state });
    renderForm();
    renderToc();
    updateOutputs();
    refreshIcons();
    document.getElementById("savedStatus").textContent = currentCaseId ? "共有未保存" : "読込済み";
    showToast("Excelを読み込みました。パスワード欄は安全のため読み込みません。");
  } catch (error) {
    console.error(error);
    showToast("Excelを読み込めませんでした。ファイル形式を確認してください。");
  } finally {
    event.target.value = "";
  }
}

function parseWorkbook(workbook) {
  const appSheet = workbook.Sheets["アプリ読込用データ"];
  if (appSheet) {
    const rows = XLSX.utils.sheet_to_json(appSheet, { header: 1, defval: "" });
    const jsonText = rows.flat().find((cell) => typeof cell === "string" && cell.trim().startsWith("{"));
    if (jsonText) {
      const payload = JSON.parse(jsonText);
      if (payload.app === "GP_HEARING_SORTER") {
        return { mode: payload.mode || mode, state: payload.state || {} };
      }
    }
  }

  const parsedState = {};
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    parseLegacyRows(rows, parsedState);
    parseLooseRows(rows, parsedState);
  });
  return { mode, state: parsedState };
}

function parseLegacyRows(rows, target) {
  let major = "";
  let middle = "";
  rows.forEach((rawRow) => {
    const row = rawRow.map(cleanCell);
    if (row[1]) major = row[1];
    if (row[2]) middle = row[2];
    const small = row[3] || "";
    const answer = firstUseful([row[4], row[5]]);
    const rightMemo = firstUseful([row[7], row[8], row[9]]);

    if (major.includes("企業") && small.includes("フリガナ")) setIfEmpty(target, "companyKana", answer);
    if (major.includes("企業") && /^名/.test(small)) setIfEmpty(target, "companyName", answer);
    if (major.includes("企業") && small.includes("住所")) setIfEmpty(target, "companyAddress", answer);
    if (major.includes("企業") && /TEL|電話/.test(small)) setIfEmpty(target, "companyPhone", answer);
    if (major.includes("企業") && /HP|ホームページ/.test(small)) setIfEmpty(target, "website", answer);
    if (major.includes("企業") && small.includes("設立")) setIfEmpty(target, "establishedAt", answer);
    if (major.includes("企業") && small.includes("資本金")) setIfEmpty(target, "capital", answer);
    if (major.includes("企業") && middle.includes("税") && small.includes("区分")) setIfEmpty(target, "taxType", matchOption(answer, fieldMap.get("taxType")?.options));
    if (major.includes("企業") && middle.includes("事業") && small.includes("主")) setIfEmpty(target, "businessDescription", answer);
    if (middle.includes("Gビズ") && answer) setIfEmpty(target, "gbizStatus", "GビズID取得済み");

    if (major.includes("代表") && small.includes("フリガナ")) setIfEmpty(target, "representativeKana", answer);
    if (major.includes("代表") && /^名/.test(small)) setIfEmpty(target, "representativeName", answer);
    if (major.includes("代表") && small.includes("役職")) setIfEmpty(target, "representativeRole", answer);
    if (major.includes("代表") && small.includes("生年月日")) setIfEmpty(target, "representativeBirth", answer);

    if (major.includes("担当") && /^名/.test(small)) setIfEmpty(target, "contactName", answer);
    if (major.includes("担当") && /TEL|電話/.test(small)) setIfEmpty(target, "contactPhone", answer);
    if (major.includes("担当") && /アドレス|メール/.test(small)) setIfEmpty(target, "contactEmail", answer);

    if (major.includes("申請") && small.includes("事業所名")) setIfEmpty(target, "officeName", answer);
    if (major.includes("申請") && small.includes("住所")) setIfEmpty(target, "officeAddress", answer);
    if (major.includes("申請") && /TEL|電話/.test(small)) setIfEmpty(target, "officePhone", answer);
    if (major.includes("申請") && small.includes("従業員")) setIfEmpty(target, "employeeFull", answer);
    if (major.includes("申請") && small.includes("営業時間")) setIfEmpty(target, "openingHours", answer);
    if (major.includes("申請") && small.includes("休み")) setIfEmpty(target, "holidays", answer);
    if (major.includes("申請") && middle.includes("サービス") && small.includes("主商品")) setIfEmpty(target, "mainProducts", answer);
    if (major.includes("申請") && middle.includes("顧客") && small.includes("客層")) setIfEmpty(target, "targetCustomers", answer);
    if (major.includes("申請") && small.includes("客単価")) setIfEmpty(target, "averagePrice", answer);
    if (major.includes("申請") && small.includes("売り上げ")) setIfEmpty(target, "salesTrend", answer);

    if (major.includes("計画書") && small.includes("投資内容")) setIfEmpty(target, "projectName", answer);
    if (major.includes("計画書") && middle.includes("投資額")) setIfEmpty(target, "investmentTotal", answer);
    if (major.includes("計画書") && middle.includes("プラス") && small.includes("強み")) setIfEmpty(target, "strengths", answer);
    if (major.includes("計画書") && middle.includes("マイナス") && small.includes("課題")) setIfEmpty(target, "issues", answer);
    if (major.includes("計画書") && small.includes("競合")) setIfEmpty(target, "competitors", answer);
    if (major.includes("計画書") && small.includes("方針")) setIfEmpty(target, "futurePolicy", answer);
    if (major.includes("計画書") && small.includes("プラン")) setIfEmpty(target, "growthGoal", answer);
    if (major.includes("計画書") && small.includes("概要")) setIfEmpty(target, "projectDetails", answer);
    if (major.includes("計画書") && small.includes("経緯")) setIfEmpty(target, "projectReason", answer);
    if (major.includes("計画書") && small.includes("売上")) setIfEmpty(target, "targetSales", answer);
    if (major.includes("計画書") && small.includes("販路")) setIfEmpty(target, "salesPlan", answer);
    if (major.includes("計画書") && small.includes("業務効率化")) setIfEmpty(target, "laborSavingPlan", answer);
    if (major.includes("計画書") && small.includes("生産性")) setIfEmpty(target, "productivityPlan", answer);

    if (rightMemo && rightMemo.length > 24) {
      if (rightMemo.includes("申し送り") || rightMemo.includes("紹介") || rightMemo.includes("事前")) {
        setIfEmpty(target, "handoff", rightMemo);
      } else {
        setIfEmpty(target, "projectReason", rightMemo);
      }
    }
  });
}

function parseLooseRows(rows, target) {
  const joinedRows = rows.map((rawRow) => rawRow.map(cleanCell));
  const picks = [
    ["openingDate", /創業日|開業日/],
    ["projectReason", /開業の経緯|経緯・背景/],
    ["pastSubsidies", /過去の補助金|過去補助金/],
    ["employeeFull", /従業員.*社員|社員/],
    ["employeePart", /アルバイト|パート/],
    ["payrollClosing", /締日/],
    ["payrollPayment", /支払日/],
    ["lowestWage", /最低賃金/],
    ["openingHours", /営業時間/],
    ["holidays", /定休日/],
    ["strengths", /強み/],
    ["weakPoints", /弱み/],
    ["issues", /今後の課題|課題/],
    ["futurePolicy", /経営方針|今後の方針/],
    ["growthGoal", /今後の目標|目標/],
    ["salesPlan", /販路拡大|販路開拓/]
  ];

  picks.forEach(([id, pattern]) => {
    if (target[id]) return;
    const found = findAfterLabel(joinedRows, pattern);
    if (found) target[id] = found;
  });
}

function exportWorkbook() {
  if (!window.XLSX) {
    showToast("Excel出力の部品を読み込めませんでした。インターネット接続を確認してください。");
    return;
  }

  updateOutputs();
  const workbook = XLSX.utils.book_new();
  const inputRows = [
    ["GREEN PARTNERSHIP 万能ヒアリングシート"],
    ["区分", modes[mode].label],
    ["出力日時", new Date().toLocaleString("ja-JP")],
    ["主に検討する補助金", value("subsidyType") || "未選択"],
    ["出力ルール", "必須項目が未入力でも出力できます。不足している確認事項は「不足確認」シートに表示されます。"],
    [],
    ["大項目", "確認すること", "入力内容", "補足"]
  ];

  sections.forEach((section) => {
    inputRows.push([section.title, "", "", section.internal ? "社内用" : ""]);
    getSectionVisibleFields(section)
      .filter((field) => field.type !== "investmentControl")
      .forEach((field) => {
        inputRows.push(["", field.label, state[field.id] || "", field.note || ""]);
      });
    inputRows.push([]);
  });

  const inputSheet = XLSX.utils.aoa_to_sheet(inputRows);
  inputSheet["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 62 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(workbook, inputSheet, "ヒアリングシート");

  const missing = getRequiredFieldIds().filter((id) => !value(id));
  const summaryRows = [["項目", "内容"]].concat(buildSummaryParts(missing).map((part) => [part.title, part.body]));
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "整理結果");

  const missingRows = [
    ["不足している確認事項"],
    ["必須項目が未入力でも、このExcelは出力されています。あとから確認する項目として使ってください。"],
    []
  ].concat(missing.length ? missing.map((id) => [fieldMap.get(id)?.label || id]) : [["不足している必須項目はありません。"]]);
  const missingSheet = XLSX.utils.aoa_to_sheet(missingRows);
  missingSheet["!cols"] = [{ wch: 46 }];
  XLSX.utils.book_append_sheet(workbook, missingSheet, "不足確認");

  const documentRows = [["必要書類の目安"]].concat(getDocumentList().map((doc) => [doc]));
  const documentSheet = XLSX.utils.aoa_to_sheet(documentRows);
  documentSheet["!cols"] = [{ wch: 86 }];
  XLSX.utils.book_append_sheet(workbook, documentSheet, "必要書類");

  const payload = { app: "GP_HEARING_SORTER", version: APP_VERSION, mode, state, savedAt: new Date().toISOString() };
  const dataSheet = XLSX.utils.aoa_to_sheet([["アプリ読込用データ"], [JSON.stringify(payload)]]);
  XLSX.utils.book_append_sheet(workbook, dataSheet, "アプリ読込用データ");
  workbook.Workbook = {
    Sheets: workbook.SheetNames.map((name) => ({ name, Hidden: name === "アプリ読込用データ" ? 1 : 0 }))
  };

  const name = sanitizeFileName(value("companyName") || "未入力");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `GP_${modes[mode].filePrefix}_万能ヒアリングシート_${name}_${date}.xlsx`);
  showToast(missing.length ? `Excelを出力しました。未入力の必須項目は${missing.length}件あります。` : "Excelを出力しました。必須項目はそろっています。");
}

function value(id) {
  return (state[id] || "").trim();
}

function setIfEmpty(target, id, nextValue) {
  const cleaned = cleanCell(nextValue);
  if (!cleaned || target[id]) return;
  const normalized = normalizeFieldValue(id, cleaned);
  const field = fieldMap.get(id);
  if (field?.type === "select") {
    target[id] = matchOption(normalized, field.options);
  } else {
    target[id] = normalized;
  }
}

function firstUseful(values) {
  return values.map(cleanCell).find((item) => item && item !== "System.Xml.XmlElement") || "";
}

function findAfterLabel(rows, pattern) {
  for (const row of rows) {
    const index = row.findIndex((cell) => pattern.test(cell));
    if (index === -1) continue;
    const after = row.slice(index + 1).find((cell) => cell && !pattern.test(cell));
    if (after) return after;
  }
  return "";
}

function matchOption(input, options = []) {
  if (!input) return "";
  const normalized = input.replace(/\s/g, "");
  const exact = options.find((option) => option.replace(/\s/g, "") === normalized);
  if (exact) return exact;
  const partial = options.find((option) => normalized.includes(option.replace(/\s/g, "")) || option.replace(/\s/g, "").includes(normalized));
  return partial || "";
}

function cleanCell(cell) {
  if (cell === null || cell === undefined) return "";
  return String(cell)
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 48);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
