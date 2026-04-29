# PDF編集ツール - ビジュアルエディタ

ブラウザだけで動作する PDF 編集ツールです。2 つの PDF を並べて表示し、ページの並び替え・コピー・削除を直感的に行えます。PDF 本体はサーバに送信されず、すべての編集処理はブラウザ内で完結します。

> 補足: パスワード保護解除と、アップロードログ記録のためのみ、必要に応じてサーバへ通信します（後述）。

🌏 **言語**: [English](README.md) | 日本語（このファイル）

---

## 📋 主な機能

### PDF 編集
- 2 ペイン構成で **2 つの PDF を同時に開いて比較編集**
- ドラッグ＆ドロップによる **ページの並び替え**（同一PDF内での移動）
- ドラッグ＆ドロップによる **別PDFへのページコピー**
- 右クリックメニューによる **ページ削除**
- ページサムネイルクリックでの **拡大プレビュー**
- 編集状態が一目で分かる **「移動」「コピー」マーカー** 表示
- 編集後の PDF を個別に **ダウンロード**
- 大量ページ処理時の **進捗バーとキャンセル機能**

### パスワード保護対応
- **パスワード付き PDF の自動検出**
- パスワード入力プロンプト
- サーバ側 `qpdf` でのパスワード解除（解除後は通常の編集が可能）

### 国際化 / UI
- **日本語 / 英語の切り替え**（ヘッダーのトグルスイッチ）
- 使い方ガイドモーダル
- レスポンシブ対応

### 運用機能
- アップロード履歴を **AWS DynamoDB** に記録（任意・サーバ側で実行）

---

## 🏗 アーキテクチャ

```
┌────────────────────────────────────────────────────┐
│ ブラウザ                                              │
│  ├─ index.php (HTML レンダリング + CSRFトークン発行)    │
│  ├─ PDF-Editor.js (UIロジック・編集処理)              │
│  ├─ pdf.js / pdf-lib (PDFのレンダリングと再構築)       │
│  ├─ dynamodb-integration.js (ログ送信クライアント)      │
│  └─ qpdf-integration.js (復号クライアント)            │
└────────────────────────────────────────────────────┘
                  │ HTTPS + CSRFトークン
                  ▼
┌────────────────────────────────────────────────────┐
│ Webサーバ (Apache + PHP)                              │
│  ├─ save-pdf-log.php  (ログ書き込みAPI)               │
│  ├─ decrypt-pdf.php   (qpdfでパスワード解除API)        │
│  ├─ security-helpers.php (CSRF/CORS/レート制限)       │
│  ├─ aws-config.php / dynamodb-client.php            │
│  └─ qpdf バイナリ (qpdf/bin/qpdf)                     │
└────────────────────────────────────────────────────┘
                  │
                  ▼
       ┌─────────────────────────┐
       │ AWS DynamoDB             │
       │  PDFUploadLogs テーブル   │
       └─────────────────────────┘
```

PDF データそのものはブラウザ内で処理され、サーバには送信されません。サーバとのやり取りは以下の 2 種類のみです:

1. **ファイル名・ページ数等のメタ情報を DynamoDB に記録**（save-pdf-log.php）
2. **パスワード付き PDF の解除リクエスト**（decrypt-pdf.php、必要時のみ）

---

## 🚀 セットアップ

### 必要要件

| 項目 | 要件 |
|---|---|
| PHP | 7.4 以上 |
| Webサーバ | Apache 2.4 推奨（`mod_rewrite`, `mod_headers` 有効） |
| 通信 | HTTPS（HSTS / Secure Cookie 前提） |
| ブラウザ | Chrome / Firefox / Safari / Edge の最新版 |
| qpdf | パスワード付きPDF対応に必要（`qpdf/bin/qpdf` に配置 or システムPATH） |
| AWS | DynamoDB テーブルとIAMユーザのアクセスキー（ログ機能を使う場合） |

### インストール手順

#### 1. ファイルを Web ルートに配置

```bash
sudo cp -r pdf /var/www/html/
```

#### 2. パーミッション設定

```bash
find /var/www/html/pdf -type d -exec chmod 755 {} \;
find /var/www/html/pdf -type f -exec chmod 644 {} \;
chmod 755 /var/www/html/pdf/qpdf/bin/qpdf
```

#### 3. AWS 認証情報を Web ルート外に配置

`aws-config.php` は Web ルートの **2階層上** にある AWS CLI 形式の認証情報ファイルを読み込みます。

```bash
# 例: Webルートが /var/www/html/pdf の場合 → /var/www/credentials, /var/www/config
chmod 600 /var/www/credentials /var/www/config
```

`credentials`:
```ini
[default]
aws_access_key_id = AKIAxxxxxxxxxxxxxxxx
aws_secret_access_key = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`config`:
```ini
[default]
region = us-east-1
output = json
```

> ⚠️ **値の前後に全角スペースが混入しないよう注意**してください。AWS Signature V4 の計算が失敗します。

詳細は [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md) を参照してください。

#### 4. DynamoDB テーブル作成と IAM 権限付与

```bash
aws dynamodb create-table \
  --table-name PDFUploadLogs \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

IAM ユーザに最小権限ポリシー (`dynamodb:PutItem` のみ) を付与します。詳細は `docs/AWS_SETUP.md`。

#### 5. ブラウザでアクセス

```
https://your-domain.example.com/pdf/
```

---

## ⚙️ 設定

主要な設定はすべて [`config.php`](config.php) に集約されています。

### アプリ基本

| 定数 | 用途 |
|---|---|
| `APP_TITLE` | ページタイトル |
| `APP_VERSION` | バージョン番号 |
| `ENABLE_DEBUG` | デバッグモード（本番では必ず `false`） |

### セキュリティ・通信

| 定数 | 用途 | 既定値 |
|---|---|---|
| `MAX_FILE_SIZE` | アップロード可能な最大ファイルサイズ | `50 * 1024 * 1024` (50MB) |
| `ALLOWED_EXTENSIONS` | 許可するファイル拡張子 | `['pdf']` |
| `ALLOWED_MIME_TYPES` | 許可する MIME タイプ | `['application/pdf']` |
| `ALLOWED_ORIGINS` | CORS / Originチェック許可リスト | `[]`（リクエスト時のホストを採用） |
| `MAX_JSON_PAYLOAD` | JSON ペイロードの最大バイト数 | `4096` |

### レート制限

| 定数 | 用途 | 既定値 |
|---|---|---|
| `RATE_LIMIT_LOG_REQUESTS` | ログAPIの許可リクエスト数 | `20` |
| `RATE_LIMIT_LOG_WINDOW` | ログAPIの計測窓（秒） | `60` |
| `RATE_LIMIT_DECRYPT_REQUESTS` | 復号APIの許可リクエスト数 | `10` |
| `RATE_LIMIT_DECRYPT_WINDOW` | 復号APIの計測窓（秒） | `300` |

### AWS DynamoDB

| 定数 | 用途 | 既定値 |
|---|---|---|
| `ENABLE_DYNAMODB_LOG` | DynamoDBへのログ記録を有効にする | `false` |
| `DYNAMODB_TABLE_LOG` | アップロードログ保存先テーブル名 | `'PDFUploadLogs'` |

### Apache 側設定

[`.htaccess`](.htaccess) で以下を制御:
- HTTPS 強制リダイレクト
- HSTS / CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / COOP / CORP
- 機密ファイルへの直接アクセス禁止
- セッションCookie のセキュリティフラグ
- gzip 圧縮 / キャッシュ制御

---

## 📁 ファイル構成

```
pdf/
├── index.php                 # メインHTMLエントリポイント（CSRFトークン発行）
├── config.php                # アプリ設定（定数）
├── .htaccess                 # Apache設定・セキュリティヘッダー
├── .gitignore
│
├── security-helpers.php      # CSRF / Origin / レート制限 / サニタイズ
├── aws-config.php            # AWS認証情報読み込み（INIパース）
├── dynamodb-client.php       # DynamoDB クライアント (PutItem専用)
├── save-pdf-log.php          # ログ保存API (POST /save-pdf-log.php)
├── decrypt-pdf.php           # PDFパスワード解除API (POST /decrypt-pdf.php)
├── diagnose.php              # CLI専用診断スクリプト（運用後は削除）
│
├── PDF-Editor.html           # PHP化前のオリジナルHTML版（参考用）
│
├── css/
│   ├── PDF-Editor.css        # メインスタイルシート
│   └── tailwind.css
│
├── js/
│   ├── PDF-Editor.js         # メインUIロジック
│   ├── dynamodb-integration.js  # ログ送信
│   ├── qpdf-integration.js   # パスワード解除リクエスト
│   ├── pdf.min.js            # PDF.js（描画）
│   ├── pdf-lib.min.js        # pdf-lib（再構築）
│   └── pdf.worker.min.js
│
├── assets/                   # アイコン・ファビコン等
├── img/
├── qpdf/
│   ├── bin/qpdf              # qpdf 実行ファイル
│   └── lib/                  # qpdf 共有ライブラリ
│
├── docs/
│   └── AWS_SETUP.md          # AWS DynamoDB セットアップ手順
│
├── LICENSE
├── README.md                 # 英語版README
└── README_JP.md              # 日本語版README（このファイル）
```

---

## 🔒 セキュリティ機能

### 通信層
- **HTTPS 強制リダイレクト**（`.htaccess`）
- **HSTS** `max-age=31536000; includeSubDomains`
- **同一オリジン制約**（`ALLOWED_ORIGINS` + `Origin` / `Referer` 検証）
- **CORS** は同一オリジンに限定して動的に発行

### CSRF
- セッションごとに 32 バイトのランダムトークンを発行
- `index.php` の `<meta name="csrf-token">` から JS が読み取り、`X-CSRF-Token` ヘッダーで送信
- 検証は `hash_equals()` による定数時間比較

### セッション
- `Secure` / `HttpOnly` / `SameSite=Strict` を強制
- `session.use_strict_mode = 1`

### 入力検証
- `Content-Type` の検査
- JSON ペイロードのサイズ上限
- ファイル名のサニタイズ（NUL/制御文字除去・パス区切り無効化）
- アップロードの **MIME 検証 + PDFマジックバイト `%PDF` 検証**
- パラメータのホワイトリスト検証（`side` など）
- パスワード長制限（1024B）

### レート制限
- IP ごと・エンドポイントごと
- ファイルロック (`flock`) ベースの計測

### CSP（Content-Security-Policy）
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
worker-src 'self' blob:;
object-src 'none';
frame-ancestors 'self';
form-action 'self';
```

### エラー漏洩防止
- 例外メッセージは `error_log()` にのみ出力、クライアントには汎用メッセージ
- パスワードや実行コマンドはログに記録しない
- デバッグ情報をクライアントレスポンスに含めない

### 機密ファイル保護
- `aws-config.php` `dynamodb-client.php` `security-helpers.php` `config.php` `diagnose.php` `credentials` `.env` 等は `.htaccess` で直接アクセス拒否
- AWS 認証情報は **Web ルート外** に配置

---

## 🔌 API エンドポイント

### `POST /save-pdf-log.php`

PDF アップロード時のメタ情報を DynamoDB に記録します。

**ヘッダー**:
- `Content-Type: application/json`
- `X-CSRF-Token: <session token>`

**リクエストボディ**:
```json
{
  "filename": "example.pdf",
  "side": "left",
  "num_pages": 12
}
```

**レスポンス（成功）**:
```json
{
  "success": true,
  "message": "PDF upload log saved successfully",
  "data": {
    "id": "1740000000-abcdef0123456789",
    "filename": "example.pdf",
    "upload_time": "2026-04-29 10:00:00",
    "side": "left",
    "num_pages": 12
  }
}
```

**HTTP ステータス**:
| コード | 意味 |
|---|---|
| 200 | 成功 |
| 400 | 入力不正 |
| 403 | Origin 不正 / CSRF 不正 |
| 405 | メソッド不正 |
| 413 | ペイロード過大 |
| 415 | Content-Type 不正 |
| 429 | レート制限超過 |
| 500 | サーバ内部エラー（AWS設定不備など） |

### `POST /decrypt-pdf.php`

パスワード付き PDF を qpdf で解除して返します。

**フィールド (`multipart/form-data`)**:
- `pdf`: PDFファイル
- `password`: 解除パスワード（空文字も可）

**ヘッダー**: `X-CSRF-Token: <session token>`

**レスポンス（成功）**:
```json
{
  "success": true,
  "message": "PDF decrypted successfully",
  "data": {
    "pdf_data": "<base64>",
    "size": 12345
  }
}
```

---

## 🎮 使い方

### PDF を読み込む
- 「ファイルを選択」ボタンか、エリアに **ドラッグ＆ドロップ**
- 左右どちらのペインにも別の PDF を読み込めます
- パスワード付き PDF はモーダルが表示されます

### ページを操作する

| 操作 | 方法 |
|---|---|
| 並び替え（同一PDF内） | サムネイルをドラッグして同じペイン内にドロップ |
| 別PDFへコピー | サムネイルを反対側のペインにドラッグ＆ドロップ |
| 削除 | サムネイルを **右クリック** →「🗑️ ページを削除」 |
| 拡大プレビュー | サムネイルをクリック |
| キャンセル | `ESC` キー（モーダルや進捗バーを閉じる） |

### マーカー表示
- **「移動」**（青）: ドラッグで元の位置から動かしたページ。元の位置に戻すと自動で消えます。
- **「コピー」**（緑）: 別PDFからコピーされたページ。常時表示。

### ダウンロード
- 各ペイン下部の「💾 PDFをダウンロード」をクリック
- 進捗バーで生成状況を確認できます。`ESC` か「✕ キャンセル」で中断可能

---

## 🔧 トラブルシューティング

### `save-pdf-log.php 500 (Internal Server Error)`

サーバ側の `error_log()` に詳細が残ります。`docs/AWS_SETUP.md` のトラブルシューティング章も参照してください。

切り分けには CLI 診断スクリプトが便利です:

```bash
php diagnose.php
```

代表的な原因:
- AWS 認証情報の不備（全角スペース混入、ファイル不在、権限不足）
- IAM の `dynamodb:PutItem` 権限欠如
- DynamoDB テーブル未作成 / リージョン違い

### `decrypt-pdf.php` のエラー
- `qpdf` が見つからない: `qpdf/bin/qpdf` の実行権限を確認、または `which qpdf` で PATH を確認
- パスワードが違う: クライアント側でリトライ可能
- ファイルが大きすぎる: `config.php` の `MAX_FILE_SIZE`、`.htaccess` の `upload_max_filesize` / `post_max_size` を確認

### `403 (Forbidden)` がブラウザで返る
- セッションが切れた → ページをリロード（CSRFトークンが再発行される）
- `ALLOWED_ORIGINS` が実ホストと一致していない

### `429 (Too Many Requests)`
- レート制限に到達。`Retry-After` ヘッダー秒数の経過を待つ
- 必要なら `config.php` の `RATE_LIMIT_*` を調整

### CSP違反でリソースが読めない
- ブラウザコンソールで「Refused to load…」を確認
- 外部CDN等を使う場合は `.htaccess` の `Content-Security-Policy` の対応ディレクティブに追加

---

## 🧪 開発者向け

### CLI 診断

```bash
php diagnose.php
```

credentials の存在・読み込み可否、access/secret の長さ、不可視文字、DynamoDB への PutItem までを 1 コマンドで検証できます。

> ⚠️ 動作確認後は `diagnose.php` を **削除** してください。`.htaccess` で Web からの直接アクセスは拒否済みですが、ファイル自体を本番サーバに残さないことを推奨します。

### デバッグモード
`config.php` で `ENABLE_DEBUG = true` にすると、PHP のエラー表示が有効になります。本番では必ず `false` に戻してください。

### 構文チェック

```bash
php -l <ファイル.php>
node -c <ファイル.js>
```

---

## 📜 ライセンス

このプロジェクトは **MIT ライセンス** の下で公開されています。詳細は [`LICENSE`](LICENSE) を参照してください。

---

## 🤝 貢献

バグ報告・機能リクエストは GitHub Issues でお願いします。
