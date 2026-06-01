# ニッチ補助金ファインダー

国・都道府県・市区町村の補助金を探し、Claude / ChatGPT のWeb版へ送る調査プロンプトを作るローカルアプリです。

## 現在の方式

- jグランツ公開APIから、公開中の補助金情報を取得します。
- Claude / ChatGPT にはAPI連携しません。
- AI APIキーは不要です。
- Claude / ChatGPT ボタンを押すと、生成したプロンプトをURLに付けてWeb版AIを開きます。
- 自動入力がうまくいかない場合に備え、同じプロンプトをクリップボードにもコピーします。

## 起動方法

通常は `ブラウザ版を起動.bat` をダブルクリックしてください。

安定起動用の `安定起動して開く.bat` も同じURLを開きます。

URL:

```text
http://127.0.0.1:39200/
```

## 自動復旧

`tools/keepalive-loop.ps1` が定期的に起動状態を確認します。サーバーが止まっていた場合は、`tools/ensure-server.ps1` が再起動します。

Windows起動時にも自動で復旧確認を始めるため、次のショートカットが作られています。

```text
C:\Users\dell\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\NicheHojokinFinder-KeepAlive.vbs
```

## 主なファイル

- `server.js`: ローカルサーバーとjグランツ検索API
- `public/index.html`: 画面、検索結果表示、Web版AI用プロンプト生成
- `.env`: ポートなどのローカル設定
- `tools/ensure-server.ps1`: 起動確認と再起動
- `tools/keepalive-loop.ps1`: 定期復旧

## セキュリティ上の方針

- AI APIキーは読み込みません。
- `/api/ask-ai` は無効化済みです。
- URLに付ける内容は、画面の条件から作る補助金調査プロンプトのみです。
- ローカルファイル、環境変数、APIキー、CookieをAIへ送る処理はありません。
- URL方式のため、入力した条件はブラウザ履歴やClaude / ChatGPT側に渡ります。秘密情報や個人情報は入力しないでください。
- 公開される画面はローカルPCまたは許可されたLAN内からの利用を前提にしています。
