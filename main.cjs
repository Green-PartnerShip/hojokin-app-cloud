/**
 * Electron メインプロセス
 * - 起動時に server.js を子プロセスで spawn（Electron同梱の Node を ELECTRON_RUN_AS_NODE で再利用）
 * - /api/health のヘルスチェックでサーバ立ち上がりを待つ
 * - BrowserWindow で http://localhost:PORT を開く
 * - 終了時に server をクリーンに kill
 */
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

// .env を Electron 側でも読む（PORT の取り回し用）
try { require("dotenv").config({ path: path.join(__dirname, ".env") }); } catch (_) {}

const PORT_PREFERRED = parseInt(process.env.PORT, 10) || 3000;
let chosenPort = PORT_PREFERRED;
let serverProcess = null;
let mainWindow = null;

function logTag(tag, msg) {
  process.stdout.write(`[${tag}] ${msg}\n`);
}

function findFreePort(start, maxTries = 6) {
  return new Promise((resolve) => {
    const tryPort = (p, left) => {
      const tester = require("net").createServer()
        .once("error", () => left > 0 ? tryPort(p + 1, left - 1) : resolve(p))
        .once("listening", () => tester.close(() => resolve(p)))
        .listen(p, "127.0.0.1");
    };
    tryPort(start, maxTries);
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, "server.js");
    if (!fs.existsSync(serverPath)) return reject(new Error(`server.js not found: ${serverPath}`));

    // Electron実行ファイルを Node.js として使う（追加の Node インストール不要）
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: __dirname,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: String(port)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    serverProcess.stdout.on("data", (d) => logTag("server", d.toString().trim()));
    serverProcess.stderr.on("data", (d) => logTag("server-err", d.toString().trim()));

    serverProcess.on("exit", (code) => {
      logTag("server", `exited with code ${code}`);
      serverProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(
          `document.body.innerHTML='<div style="padding:40px;font-family:sans-serif;text-align:center"><h2 style="color:#c53030">サーバーが停止しました</h2><p>ログを確認してください。アプリを再起動するには一度閉じてから start.bat を再実行してください。</p></div>'`
        ).catch(() => {});
      }
    });

    // ヘルスチェック（最大30秒）
    const url = `http://127.0.0.1:${port}/api/health`;
    const startedAt = Date.now();
    const tick = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          logTag("electron", `server healthy on port ${port}`);
          resolve();
        } else {
          setTimeout(tick, 300);
        }
      }).on("error", () => {
        if (Date.now() - startedAt > 30000) reject(new Error("server health check timeout (30s)"));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "ニッチ補助金ファインダー",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // 外部リンクは既定ブラウザで開く（jグランツ詳細ページ等）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${chosenPort}`);

  // 起動時にDevToolsを開きたいときは下行のコメント解除
  // mainWindow.webContents.openDevTools({ mode: "detach" });
}

function setMenu() {
  const template = [
    {
      label: "ファイル",
      submenu: [
        { label: "再読み込み", role: "reload" },
        { label: "強制再読み込み", role: "forceReload" },
        { type: "separator" },
        { label: "終了", role: "quit" }
      ]
    },
    {
      label: "表示",
      submenu: [
        { label: "ズームイン", role: "zoomIn" },
        { label: "ズームアウト", role: "zoomOut" },
        { label: "リセット", role: "resetZoom" },
        { type: "separator" },
        { label: "DevTools", role: "toggleDevTools" },
        { label: "全画面切替", role: "togglefullscreen" }
      ]
    },
    {
      label: "ヘルプ",
      submenu: [
        {
          label: "jグランツ公式（ブラウザ）",
          click: () => shell.openExternal("https://www.jgrants-portal.go.jp/")
        },
        {
          label: "アプリについて",
          click: () => dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "アプリについて",
            message: "ニッチ補助金ファインダー v1.2",
            detail: "niche-hojokin-finder スキルの Electron デスクトップ実装。\n国・都道府県・市区町村の補助金/助成金/奨励金を、jグランツ公開API + 外部AI で検索します。"
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  try {
    // ポート決定（占有時は最大6回まで自動シフト）
    chosenPort = await findFreePort(PORT_PREFERRED);
    if (chosenPort !== PORT_PREFERRED) {
      logTag("electron", `port ${PORT_PREFERRED} busy, using ${chosenPort}`);
    }
    await startServer(chosenPort);
    setMenu();
    createWindow();
  } catch (e) {
    dialog.showErrorBox("起動失敗", `${e.message}\n\nログを確認してください。`);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) { try { serverProcess.kill(); } catch (_) {} }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) { try { serverProcess.kill(); } catch (_) {} }
});
