# クラウド公開手順

このアプリはクラウド公開用にログイン保護と社内共有DB保存を追加済みです。

## 1つのWeb Serviceにまとめる構成

- 補助金検索: `/`
- 社内メニュー: `/internal`
- ヒアリング整理（会社用）: `/internal/hearing/company`
- ヒアリング整理（個人用）: `/internal/hearing/personal`
- 定型文ストック: `/phrase-stock/`
- 業務タスクボード: `/tasks/`
- 説明変換ワークベンチ: `/explanation/`

各画面の右下にある「アプリ切替」から、同じWeb Service内の別アプリへ移動できます。

## 必須の環境変数

クラウド側の環境変数・Secret に設定してください。`.env` やGitへ保存しないでください。

```text
CLOUD_MODE=1
PUBLIC_ACCESS=1
AUTH_REQUIRED=1
APP_PASSWORD=Renderの環境変数にだけ設定
SESSION_SECRET=32文字以上のランダム文字列
HOST=0.0.0.0
DATABASE_URL=Render Postgres の Internal Database URL
DATABASE_SSL=0
```

`PORT` はクラウド事業者が自動指定する場合が多いため、指定不要です。

## Render の例

1. GitHubにこのフォルダをリポジトリとして置く
2. Renderで New Web Service を作成
3. Build Command: `npm ci --omit=dev`
4. Start Command: `node server.js`
5. Render Postgres を作成し、Web Service の `DATABASE_URL` に Internal Database URL を設定
6. 上記の環境変数を設定
7. 発行された `https://...onrender.com` にアクセス

## Docker対応

`Dockerfile` を追加済みです。Docker対応のクラウドならそのまま使えます。

## ローカル版との違い

- ローカル版は `http://127.0.0.1:39200/`
- 社内LAN版は `http://192.168.x.x:39200`
- クラウド版はクラウド事業者が発行する `https://...`

クラウド版では、URLを知っているだけでは入れません。パスワードを知っている人だけが利用できます。
