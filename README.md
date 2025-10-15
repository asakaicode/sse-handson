# sse-handson
SSEプロトコルに関するハンズオン資料です。

## アプリの起動方法

以下のどちらかの方法で起動できます。

### 1) Docker Compose（推奨・最短）
- 前提: Docker Desktop など Docker/Compose が使えること。
- ルートディレクトリで実行（Ollama なしでフロントエンド/バックエンドのみ起動）:

```bash
docker compose up --build
```

- このモードでは SSE 応答はサンプルのフォールバック文をストリームします（モデルのダウンロードは不要）。

- ローカルLLM（Ollama）も一緒に動かす場合は、環境変数とプロファイルを付けて起動:

```bash
ENABLE_OLLAMA=true docker compose --profile ollama up --build
```

- アクセス先:
  - フロントエンド: http://localhost:3000
  - バックエンド(API/SSE): http://localhost:3001
  - ローカルLLM(Ollama API): http://localhost:11434

- 終了方法: `Ctrl + C` で停止。不要なら以下で後片付け:

```bash
docker compose down -v
```

メモ: ブラウザからのアクセスはホスト側の `localhost:3001` に向くため、SSE 接続先の環境変数はローカルホストを指す必要があります（コンテナ名 `backend` はブラウザからは解決されません）。

初回のモデル自動ダウンロード（存在チェック）

- `--profile ollama` を付けて起動した場合のみ、Ollama 用のカスタムイメージ（`./ollama/Dockerfile`）がビルドされます。
- コンテナ起動時に `entrypoint.sh` が `OLLAMA_MODEL` の存在をAPIで確認し、未存在なら自動で pull します（既定: llama3.1:8b）。
- 既に存在する場合は pull をスキップします（永続ボリュームに格納）。
- モデルを変更したい場合は `docker-compose.yml` の `OLLAMA_MODEL` を編集してください。

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

## ローカルLLM（Ollama）との連携

バックエンドは、固定テキストではなくローカルLLM（Ollama）からのストリームをSSEで中継できます。

- 前提: Ollama をインストールし、モデルを用意
  - https://ollama.com/download
  - 例: `ollama pull llama3.1:8b`
  - デフォルトのAPIエンドポイントは `http://localhost:11434`

- 環境変数（backend）
  - `OLLAMA_BASE_URL`（省略時は `http://localhost:11434`）
  - `OLLAMA_MODEL`（省略時は `llama3.1:8b`）
  - `ENABLE_OLLAMA` を `true` にすると、Ollama を利用したストリームを実行（Docker Compose では `ENABLE_OLLAMA=true docker compose --profile ollama up --build` のように指定）
  - `FALLBACK` を `true` にすると、Ollama に繋がらない場合は固定文を返す簡易フォールバックが有効
  - `OLLAMA_MAX_TOKENS`（省略時は 256）: 推論の最大出力トークン上限（ETA計算に使用）
  - `ETA_CHARS_PER_TOKEN`（省略時は 3）: 文字→トークン換算の概算係数（言語により調整可）

- Docker Compose でOllamaも同一composeで動かす場合（本リポの compose 既定）
  - `OLLAMA_BASE_URL=http://ollama:11434` を backend に設定済みです。
  - ポート `11434` をホストに公開しているので、REST API は `http://localhost:11434` で確認できます。

- Docker Compose でバックエンドを動かし、Ollama をホストで単独起動する場合は、バックエンドからホストへ到達できるよう `OLLAMA_BASE_URL` を以下のように指定してください（Docker Desktopの場合）:

```yaml
services:
  backend:
    environment:
      - PORT=3001
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - OLLAMA_MODEL=llama3.1:8b
```

- ローカル起動（非コンテナ）の場合はそのまま `http://localhost:11434` を使えます。

フロントエンド側の `/app/gpt-like` は、`/api/conversations` でIDを発行し、`/api/conversations/:id/stream` でSSEを受け取りつつ、チャンクごとに吹き出しを更新する構成です。バックエンドはOllamaの `/api/chat` のNDJSONストリームを読み取り、SSEの `data:` と `done` イベントへ変換しています。
