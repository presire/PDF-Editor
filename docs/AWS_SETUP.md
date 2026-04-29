# AWS DynamoDB セットアップ手順

PDF編集ツールのアップロードログ機能で使用する AWS DynamoDB / IAM の設定手順をまとめたドキュメントです。

---

## 前提

- AWS アカウントを保有していること
- IAM ユーザを作成済みで、長期アクセスキー（`AKIA...`）を発行済みであること
- サーバ上に AWS 認証情報ファイル（`credentials` / `config`）を配置済みであること

> ⚠️ **Root アカウントのアクセスキーは絶対に使用しないでください。**
> 必ず IAM ユーザを作成し、最小権限を付与した上で使用します。

---

## 1. 認証情報ファイルの配置

`aws-config.php` は Webルート外のファイルを参照します。

| ファイル | 配置パス（プロジェクトルートからの相対） |
|---|---|
| `credentials` | `../../credentials` |
| `config` | `../../config` |

例: プロジェクトが `/var/www/html/pdf/` にある場合、`/var/www/credentials` と `/var/www/config` に配置。

### `credentials` の内容（INI形式）

```ini
[default]
aws_access_key_id = AKIAxxxxxxxxxxxxxxxx
aws_secret_access_key = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `config` の内容

```ini
[default]
region = us-east-1
output = json
```

### パーミッション

```bash
chmod 600 /path/to/credentials
chmod 600 /path/to/config
```

> ⚠️ ファイル内に **全角スペース** や **タブ** が混入すると署名計算に失敗します。半角スペースのみ使用してください。

---

## 2. DynamoDB テーブルの作成

### 既存確認

```bash
aws dynamodb describe-table \
  --table-name PDFUploadLogs \
  --region us-east-1
```

`ResourceNotFoundException` が返る場合は未作成。

### 新規作成

```bash
aws dynamodb create-table \
  --table-name PDFUploadLogs \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

| 項目 | 値 |
|---|---|
| テーブル名 | `PDFUploadLogs`（`config.php` の `DYNAMODB_TABLE_LOG` で変更可能） |
| パーティションキー | `id`（String） |
| 課金モード | オンデマンド（PAY_PER_REQUEST） |
| リージョン | `us-east-1`（`config` ファイルの `region` と合わせる） |

---

## 3. IAM ポリシーの付与（最小権限）

### 手順

1. AWS マネジメントコンソール → **IAM** → **ユーザー** → 該当 IAM ユーザを選択
2. **「許可を追加」** → **「インラインポリシーを作成」**
3. **JSON** タブを開き、以下を貼り付け

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "dynamodb:PutItem",
            "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/PDFUploadLogs"
        }
    ]
}
```

4. `YOUR_ACCOUNT_ID` を実際の 12 桁 AWS アカウント ID に置換
5. ポリシー名（例: `PDFEditorPutItemPolicy`）を入力して保存

### アカウント ID の確認方法

```bash
aws sts get-caller-identity
```

```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

`Account` の値（12桁の数字）を使用します。

---

## 4. 動作確認（診断スクリプト）

サーバ上で CLI から実行:

```bash
cd /var/www/html/pdf
php diagnose.php
```

### 期待される出力

```
[1] credentialsファイルパス: ...
    存在: YES
    読込可: YES
    permissions: 0600

[2] configファイルパス: ...
    存在: YES
    読込可: YES

[3] パース結果:
    access_key先頭4: AKIA
    access_key長  : 20 文字
    secret_key長  : 40 文字
    region        : us-east-1
    secret_keyに不可視文字: NO
    access_keyに不可視文字: NO

[4] validateAWSCredentials(): OK

[5] DynamoDB PutItem テスト...
    結果: ✅ 成功（テストアイテムを書き込みました）
```

`[5]` が成功すれば、ブラウザから PDF をアップロードした際に DynamoDB へログが記録されます。

> ⚠️ **動作確認後は `diagnose.php` を必ずサーバから削除してください。**

---

## 5. トラブルシューティング

### `AccessDeniedException`

IAM ユーザに `dynamodb:PutItem` 権限が無い → **第3章** のポリシーをアタッチ。

### `ResourceNotFoundException`

- テーブルが指定リージョンに存在しない
- → **第2章** でテーブル作成、または `config` ファイルの `region` を実テーブルのリージョンに合わせる

### `InvalidSignatureException`

- 認証情報に不可視文字（全角スペース、タブ、改行など）が混入
- → `credentials` ファイルを再確認、または `php diagnose.php` で `[3]` の不可視文字検出を確認

### `cURL Error`

- ネットワーク到達不可、SSL 証明書検証失敗
- → サーバから `https://dynamodb.us-east-1.amazonaws.com/` への HTTPS 接続可否を確認

### `validateAWSCredentials(): NG`

- credentials ファイルが配置されていない、または読み込み不可
- → ファイルパスとパーミッションを再確認

### Apache / PHP エラーログの確認

```bash
sudo tail -100 /var/log/apache2/error.log
# または
sudo tail -100 /var/log/httpd/error_log
```

`save-pdf-log error: ...` の行に AWS から返された詳細メッセージが記録されます。

---

## 6. 認証情報のローテーション手順

定期的にアクセスキーを入れ替えることを推奨します。

1. IAM コンソールで新しいアクセスキーを発行
2. サーバの `credentials` ファイルを新キーで上書き
3. `php diagnose.php` で動作確認
4. IAM コンソールで旧アクセスキーを「無効化」
5. 数日〜1週間問題が無ければ「削除」

---

## 7. テーブル名・リージョンの変更

| 変更箇所 | 編集ファイル |
|---|---|
| テーブル名 | `config.php` の `DYNAMODB_TABLE_LOG` |
| リージョン | サーバ上の `config` ファイルの `[default]` セクション `region` |
| 使用プロファイル | 環境変数 `AWS_PROFILE`（既定: `default`） |

リージョンを変更する場合は IAM ポリシーの `Resource` ARN も対応するリージョンに更新してください。

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `config.php` | テーブル名・許可オリジン等のアプリ設定 |
| `aws-config.php` | 認証情報読み込み（Webからアクセス不可） |
| `dynamodb-client.php` | DynamoDB クライアント本体（Webからアクセス不可） |
| `save-pdf-log.php` | フロントから呼ばれるログ保存エンドポイント |
| `diagnose.php` | CLI専用の診断スクリプト（**運用安定後は削除**） |
