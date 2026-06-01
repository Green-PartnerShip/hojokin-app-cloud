(() => {
  const apps = [
    {
      title: "統合メニュー",
      short: "Menu",
      path: "/internal",
      description: "このWebサービス内の各アプリを一覧から選べます。"
    },
    {
      title: "補助金ファインダー",
      short: "Find",
      path: "/",
      description: "国・都道府県・市区町村の補助金を検索します。"
    },
    {
      title: "ヒアリング整理（会社）",
      short: "Hear",
      path: "/internal/hearing/company",
      description: "法人・会社向けの整理画面です。"
    },
    {
      title: "ヒアリング整理（個人）",
      short: "Indv",
      path: "/internal/hearing/personal",
      description: "個人事業主向けの整理画面です。"
    },
    {
      title: "説明変換ワークベンチ",
      short: "Text",
      path: "/explanation/",
      description: "業務メモを説明文へ整えます。"
    },
    {
      title: "業務タスクボード",
      short: "Task",
      path: "/tasks/",
      description: "1日・1週間・1か月のタスクを共有管理します。"
    }
  ];

  if (document.getElementById("sharedAppSwitcher")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "sharedAppSwitcherButton";
  button.className = "gp-app-switcher-button";
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "sharedAppSwitcher");
  button.innerHTML = `
    <span class="gp-app-switcher-icon" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
    <span>アプリ切替</span>
  `;

  const overlay = document.createElement("div");
  overlay.id = "sharedAppSwitcher";
  overlay.className = "gp-app-switcher-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sharedAppSwitcherTitle");
  overlay.innerHTML = `
    <section class="gp-app-switcher-window">
      <div class="gp-app-switcher-head">
        <div>
          <p class="gp-app-switcher-kicker">同じWebサービス内で切り替え</p>
          <h2 class="gp-app-switcher-title" id="sharedAppSwitcherTitle">アプリ切替</h2>
        </div>
        <button class="gp-app-switcher-close" type="button" aria-label="閉じる">×</button>
      </div>
      <div class="gp-app-switcher-grid">
        ${apps.map((app) => {
          const current = isCurrent(app.path);
          return `
            <a class="gp-app-switcher-card" href="${app.path}" ${current ? 'aria-current="page"' : ""}>
              <span class="gp-app-switcher-badge" aria-hidden="true">${app.short}</span>
              <span class="gp-app-switcher-copy">
                <strong>${app.title}</strong>
                <span>${app.description}</span>
                ${current ? '<em>現在表示中</em>' : ""}
              </span>
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `;

  const openSwitcher = () => {
    overlay.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const closeButton = overlay.querySelector(".gp-app-switcher-close");
    closeButton?.focus();
  };

  const closeSwitcher = () => {
    overlay.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.focus();
  };

  button.addEventListener("click", openSwitcher);

  overlay.querySelector(".gp-app-switcher-close").addEventListener("click", closeSwitcher);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeSwitcher();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeSwitcher();
    }
  });

  document.body.append(overlay, button);

  function isCurrent(path) {
    if (path === "/") {
      return location.pathname === "/";
    }
    if (path === "/internal") {
      return location.pathname === "/internal" || location.pathname === "/internal/";
    }
    return location.pathname.startsWith(path);
  }
})();
