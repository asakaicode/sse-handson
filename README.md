# sse-handson
SSEプロトコルに関するハンズオン資料です。

## アプリの起動方法

以下のどちらかの方法で起動できます。

### 1) Docker Compose（推奨・最短）
- 前提: Docker Desktop など Docker/Compose が使えること。
- ルートディレクトリで実行:

```bash
docker compose up --build
```

- アクセス先:
  - フロントエンド: http://localhost:3000
  - バックエンド(API/SSE): http://localhost:3001

- 終了方法: `Ctrl + C` で停止。不要なら以下で後片付け:

```bash
docker compose down -v
```

メモ: ブラウザからのアクセスはホスト側の `localhost:3001` に向くため、SSE 接続先の環境変数はローカルホストを指す必要があります（コンテナ名 `backend` はブラウザからは解決されません）。

### 2) ローカル実行（コンテナなし・開発向け）
- 前提: Node.js 18+（推奨 20+）/ Corepack（pnpm）

1. バックエンド起動（ポート: 3001）

```bash
cd backend
corepack enable
pnpm install
pnpm dev
```

2. フロントエンド起動（ポート: 3000）

```bash
cd frontend
corepack enable
pnpm install
# macOS/Linux
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 \
NEXT_PUBLIC_API_BASE=http://localhost:3001 \
pnpm dev

# Windows PowerShell の例
$env:NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3001'
$env:NEXT_PUBLIC_API_BASE = 'http://localhost:3001'
pnpm dev
```

- アクセス先: http://localhost:3000

## 補足
- ポート衝突がある場合は、使用中のプロセスを停止するか別ポートに変更してください。
- 動作確認用エンドポイント: `GET http://localhost:3001/stream`（SSE の生出力）。
