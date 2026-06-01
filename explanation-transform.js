export function transformMemo(payload) {
  const memo = String(payload.memo || "").trim();
  const audience = payload.audience || "boss";
  const purpose = payload.purpose || "report";
  const tone = payload.tone || "polite";
  const format = payload.format || "email";
  const detail = payload.detail || "standard";

  if (!memo) {
    return {
      output: "",
      warnings: ["メモが空です。まず左側の入力欄に変換したい内容を貼り付けてください。"]
    };
  }

  const lines = memo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const classified = classifyLines(lines);
  const summary = makeSummary(classified, lines);
  const sections = makeSections({ audience, purpose, tone, detail, summary, classified });
  const output = renderByFormat({ format, audience, purpose, tone, sections });

  return {
    output,
    warnings: classified.unresolved.length ? ["一部の行は用途を判断できなかったため、補足情報として扱いました。"] : []
  };
}

function classifyLines(lines) {
  const buckets = {
    issue: [],
    cause: [],
    done: [],
    risk: [],
    action: [],
    deadline: [],
    cost: [],
    unresolved: []
  };

  lines.forEach((line) => {
    const normalized = line.replace(/[。\.]$/, "");
    if (/(エラー|障害|不具合|遅延|問題|停止|未対応|できない|失敗|不足)/.test(normalized)) {
      buckets.issue.push(normalized);
    } else if (/(原因|理由|ため|影響|背景|認証|期限切れ|仕様|確認不足)/.test(normalized)) {
      buckets.cause.push(normalized);
    } else if (/(完了|済み|実施|対応した|復旧|確認した|共有した|連絡した)/.test(normalized)) {
      buckets.done.push(normalized);
    } else if (/(リスク|懸念|再発|可能性|注意|課題|ボトルネック)/.test(normalized)) {
      buckets.risk.push(normalized);
    } else if (/(予定|対応|進める|検討|依頼|お願い|追加|修正|改善|実装|確認する)/.test(normalized)) {
      buckets.action.push(normalized);
    } else if (/(期限|納期|本日|明日|今週|来週|月曜|火曜|水曜|木曜|金曜|土曜|日曜|\d+\/\d+|\d+日)/.test(normalized)) {
      buckets.deadline.push(normalized);
    } else if (/(工数|費用|金額|見積|半日|\d+時間|\d+h|\d+日程度)/.test(normalized)) {
      buckets.cost.push(normalized);
    } else {
      buckets.unresolved.push(normalized);
    }
  });

  return buckets;
}

function makeSummary(classified, lines) {
  const firstIssue = classified.issue[0] || lines[0];
  const firstDone = classified.done[0];
  const firstAction = classified.action[0] || classified.risk[0] || "";
  const firstCause = classified.cause[0] || "";

  return {
    topic: firstIssue,
    status: firstDone ? `${firstDone}。` : "現状確認と対応方針の整理が必要です。",
    cause: firstCause,
    next: firstAction
  };
}

function makeSections(context) {
  const { audience, purpose, tone, detail, summary, classified } = context;
  const title = makeTitle(audience, purpose);
  const opening = makeOpening(audience, purpose, tone, summary);
  const core = makeCore(audience, classified, summary, detail);
  const closing = makeClosing(audience, purpose, tone, summary);

  return { title, opening, core, closing };
}

function makeTitle(audience, purpose) {
  const audienceNames = {
    boss: "上司向け報告",
    customer: "お客様向け説明",
    team: "チーム共有",
    executive: "経営層向け要約",
    partner: "協力会社向け連絡"
  };
  const purposeNames = {
    report: "状況報告",
    consult: "相談",
    apology: "お詫びと対応",
    request: "依頼",
    progress: "進捗共有",
    trouble: "トラブル説明"
  };
  return `${audienceNames[audience] || "説明文"}: ${purposeNames[purpose] || "共有"}`;
}

function makeOpening(audience, purpose, tone, summary) {
  if (audience === "customer") {
    if (purpose === "apology" || purpose === "trouble") {
      return "このたびはご不便をおかけし、申し訳ございません。現在の状況と今後の対応について、以下の通りご報告いたします。";
    }
    return "いつもお世話になっております。現在の状況と今後の対応について、以下の通りご案内いたします。";
  }
  if (audience === "executive") {
    return `結論から申し上げると、${summary.topic}件について、現状整理と次の判断が必要です。`;
  }
  if (audience === "team") {
    return `共有です。${summary.topic}件について、現状と次アクションを整理します。`;
  }
  if (audience === "partner") {
    return "お世話になっております。関連事項について、確認内容とお願いしたい点を整理してご連絡します。";
  }
  return tone === "formal"
    ? `以下、${summary.topic}件についてご報告いたします。`
    : `${summary.topic}件について、現在の状況を共有します。`;
}

function makeCore(audience, classified, summary, detail) {
  const core = [];
  const add = (heading, items, fallback) => {
    const cleanedItems = uniqueItems(items.filter(Boolean));
    if (cleanedItems.length) core.push({ heading, items: cleanedItems });
    else if (fallback && detail !== "brief") core.push({ heading, items: [fallback] });
  };

  if (audience === "customer") {
    add("現在の状況", [...classified.done, summary.status].filter(Boolean), "必要な確認を進めています。");
    add("発生していた内容", classified.issue, "");
    add("原因・背景", classified.cause, "詳細は確認中です。確定した内容から順次ご案内します。");
    add("今後の対応", [...classified.action, ...classified.risk], "再発防止に向けた確認と改善を進めます。");
    return core;
  }

  if (audience === "executive") {
    add("要点", [summary.topic, summary.status].filter(Boolean), "");
    add("影響・懸念", [...classified.issue, ...classified.risk], "現時点で大きな追加影響は確認されていません。");
    add("判断が必要な点", [...classified.action, ...classified.cost, ...classified.deadline], "追加判断が必要な場合は、選択肢と影響を整理して提示します。");
    return core;
  }

  if (audience === "team") {
    add("状況", [...classified.issue, ...classified.done], "状況確認中です。");
    add("背景", classified.cause, "");
    add("TODO", [...classified.action, ...classified.deadline, ...classified.cost], "担当と期限を決めて進めます。");
    add("注意点", classified.risk, "");
    return core;
  }

  if (audience === "partner") {
    add("共有内容", [...classified.issue, ...classified.done], "関連事項を共有します。");
    add("確認したい点", [...classified.cause, ...classified.unresolved], "必要に応じて詳細をご確認ください。");
    add("お願いしたい対応", [...classified.action, ...classified.deadline], "ご確認のうえ、対応可否をご連絡ください。");
    return core;
  }

  add("現状", [...classified.issue, ...classified.done], summary.status);
  add("原因・背景", classified.cause, "");
  add("リスク・懸念", classified.risk, "同様の事象が再発する可能性があるため、予防策の検討が必要です。");
  add("次の対応", [...classified.action, ...classified.deadline, ...classified.cost], summary.next || "対応方針を整理して進めます。");
  if (classified.unresolved.length && detail === "detailed") {
    add("補足", classified.unresolved, "");
  }
  return core;
}

function makeClosing(audience, purpose, tone, summary) {
  if (audience === "customer") {
    if (purpose === "request") return "お手数をおかけしますが、ご確認のほどよろしくお願いいたします。";
    return "引き続き状況を確認し、必要な対応が進み次第あらためてご報告いたします。";
  }
  if (audience === "executive") {
    return "必要な判断材料を追加で整理し、次回報告時に対応状況を更新します。";
  }
  if (audience === "team") {
    return "不明点があればこのスレッドで確認し、対応内容を更新していきます。";
  }
  if (audience === "partner") {
    return "ご確認いただき、対応可否と想定スケジュールをご連絡いただけますと幸いです。";
  }
  if (purpose === "consult") {
    return "上記の方針で進めてよいか、ご確認をお願いいたします。";
  }
  return summary.next ? "上記方針で進め、進捗があり次第共有します。" : "以上、ご確認をお願いいたします。";
}

function renderByFormat({ format, audience, purpose, tone, sections }) {
  if (format === "bullets") {
    const lines = [`【${sections.title}】`, sections.opening, ""];
    sections.core.forEach((section) => {
      lines.push(`■ ${section.heading}`);
      section.items.forEach((item) => lines.push(`- ${punctuate(item)}`));
      lines.push("");
    });
    lines.push(sections.closing);
    return lines.join("\n").trim();
  }

  if (format === "chat") {
    const lines = [sections.opening];
    sections.core.forEach((section) => {
      const joined = section.items.map(punctuate).join(" ");
      lines.push(`・${section.heading}: ${joined}`);
    });
    lines.push(sections.closing);
    return lines.join("\n");
  }

  if (format === "report") {
    const lines = [`# ${sections.title}`, "", "## 概要", sections.opening, ""];
    sections.core.forEach((section) => {
      lines.push(`## ${section.heading}`);
      section.items.forEach((item) => lines.push(`- ${punctuate(item)}`));
      lines.push("");
    });
    lines.push("## 今後");
    lines.push(sections.closing);
    return lines.join("\n").trim();
  }

  const greeting = audience === "customer" || audience === "partner"
    ? "お世話になっております。"
    : "";
  const subject = `件名: ${sections.title}`;
  const lines = [subject, ""];
  if (greeting) lines.push(greeting, "");
  lines.push(sections.opening, "");
  sections.core.forEach((section) => {
    lines.push(`【${section.heading}】`);
    section.items.forEach((item) => lines.push(`・${punctuate(item)}`));
    lines.push("");
  });
  lines.push(sections.closing);
  if (tone === "formal" && (audience === "customer" || audience === "partner")) {
    lines.push("", "何卒よろしくお願いいたします。");
  }
  return lines.join("\n").trim();
}

function punctuate(text) {
  const value = String(text || "").trim();
  if (!value) return value;
  return /[。！？!?]$/.test(value) ? value : `${value}。`;
}

function uniqueItems(items) {
  const seen = new Set();
  const results = [];
  items.forEach((item) => {
    const key = String(item).replace(/[。！？!?\s]/g, "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(item);
  });
  return results;
}
