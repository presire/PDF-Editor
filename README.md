# PDF Editor - Visual Editor

A browser-based PDF editing tool. Open two PDFs side by side and intuitively reorder, copy, and delete pages. PDF content itself is never sent to the server — all editing is performed entirely in the browser.

> Note: The server is contacted only for password-protected PDF decryption and (optionally) for upload-log recording, as described below.

🌏 **Languages**: English (this file) | [日本語](README_JP.md)

---

## 📋 Features

### PDF Editing
- **Two-pane layout** for editing two PDFs simultaneously
- **Drag & drop reordering** within the same PDF
- **Drag & drop copy** between PDFs
- **Right-click menu** for page deletion
- **Click-to-zoom** preview of any page
- **"Moved" / "Copied" markers** make edit state immediately visible
- **Per-pane download** of edited PDFs
- **Progress bar with cancel** for large jobs

### Password-Protected PDFs
- Automatic detection of password-protected PDFs
- Password input modal
- Server-side decryption via `qpdf` (the rest of the editing flow is unchanged)

### Internationalization / UI
- **Japanese / English toggle** (header switch)
- "How to use" guide modal
- Responsive layout

### Operations
- Optional **upload history logging to AWS DynamoDB** (server-side)

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────┐
│ Browser                                              │
│  ├─ index.php (HTML rendering + CSRF token issue)    │
│  ├─ PDF-Editor.js (UI logic / editing)               │
│  ├─ pdf.js / pdf-lib (PDF rendering & rebuild)       │
│  ├─ dynamodb-integration.js (log-upload client)      │
│  └─ qpdf-integration.js (decryption client)          │
└──────────────────────────────────────────────────────┘
                  │ HTTPS + CSRF token
                  ▼
┌──────────────────────────────────────────────────────┐
│ Web server (Apache + PHP)                            │
│  ├─ save-pdf-log.php  (log-write API)                │
│  ├─ decrypt-pdf.php   (qpdf decryption API)          │
│  ├─ security-helpers.php (CSRF / CORS / rate limit)  │
│  ├─ aws-config.php / dynamodb-client.php             │
│  └─ qpdf binary (qpdf/bin/qpdf)                      │
└──────────────────────────────────────────────────────┘
                  │
                  ▼
       ┌─────────────────────────┐
       │ AWS DynamoDB            │
       │  PDFUploadLogs table    │
       └─────────────────────────┘
```

PDF data itself is processed entirely in the browser and never sent to the server. The only server interactions are:

1. **Recording metadata** (filename, page count, etc.) to DynamoDB (`save-pdf-log.php`)
2. **Decrypting password-protected PDFs** when needed (`decrypt-pdf.php`)

---

## 🚀 Setup

### Requirements

| Item | Requirement |
|---|---|
| PHP | 7.4 or later |
| Web server | Apache 2.4 recommended (`mod_rewrite`, `mod_headers` enabled) |
| Transport | HTTPS (HSTS / Secure cookie assumed) |
| Browser | Latest Chrome / Firefox / Safari / Edge |
| qpdf | Required for password-protected PDFs (`qpdf/bin/qpdf` or system PATH) |
| AWS | DynamoDB table and IAM user access key (only if logging is used) |

### Installation

#### 1. Place files in the web root

```bash
sudo cp -r pdf /var/www/html/
```

#### 2. Set permissions

```bash
find /var/www/html/pdf -type d -exec chmod 755 {} \;
find /var/www/html/pdf -type f -exec chmod 644 {} \;
chmod 755 /var/www/html/pdf/qpdf/bin/qpdf
```

#### 3. Place AWS credentials outside the web root

`aws-config.php` reads AWS CLI–format credential files **two directories above** the web root.

```bash
# Example: web root is /var/www/html/pdf → /var/www/credentials, /var/www/config
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

> ⚠️ Make sure no full-width (Unicode) spaces sneak into the values. AWS Signature V4 will fail if they do.

See [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md) for the full procedure.

#### 4. Create the DynamoDB table and grant IAM permissions

```bash
aws dynamodb create-table \
  --table-name PDFUploadLogs \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Attach a least-privilege policy (only `dynamodb:PutItem`) to the IAM user. See `docs/AWS_SETUP.md`.

#### 5. Open in a browser

```
https://your-domain.example.com/pdf/
```

---

## ⚙️ Configuration

All key settings live in [`config.php`](config.php).

### Application

| Constant | Purpose |
|---|---|
| `APP_TITLE` | Page title |
| `APP_VERSION` | Version string |
| `ENABLE_DEBUG` | Debug mode (must be `false` in production) |

### Security / transport

| Constant | Purpose | Default |
|---|---|---|
| `MAX_FILE_SIZE` | Maximum upload size | `50 * 1024 * 1024` (50 MB) |
| `ALLOWED_EXTENSIONS` | Allowed file extensions | `['pdf']` |
| `ALLOWED_MIME_TYPES` | Allowed MIME types | `['application/pdf']` |
| `ALLOWED_ORIGINS` | Allowed origins for CORS / Origin checks | `[]` (defaults to request host) |
| `MAX_JSON_PAYLOAD` | Maximum JSON payload size in bytes | `4096` |

### Rate limiting

| Constant | Purpose | Default |
|---|---|---|
| `RATE_LIMIT_LOG_REQUESTS` | Allowed requests for the log API | `20` |
| `RATE_LIMIT_LOG_WINDOW` | Window for the log API (seconds) | `60` |
| `RATE_LIMIT_DECRYPT_REQUESTS` | Allowed requests for the decrypt API | `10` |
| `RATE_LIMIT_DECRYPT_WINDOW` | Window for the decrypt API (seconds) | `300` |

### AWS DynamoDB

| Constant | Purpose | Default |
|---|---|---|
| `DYNAMODB_TABLE_LOG` | Table name for upload logs | `'PDFUploadLogs'` |

### Apache settings

[`.htaccess`](.htaccess) controls:
- HTTPS forced redirect
- HSTS / CSP / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / COOP / CORP
- Direct-access denial for sensitive files
- Session cookie security flags
- gzip compression / cache control

---

## 📁 File Layout

```
pdf/
├── index.php                 # Main HTML entry point (issues CSRF token)
├── config.php                # Application configuration (constants)
├── .htaccess                 # Apache config / security headers
├── .gitignore
│
├── security-helpers.php      # CSRF / Origin / rate limit / sanitization
├── aws-config.php            # AWS credentials loader (INI parser)
├── dynamodb-client.php       # DynamoDB client (PutItem only)
├── save-pdf-log.php          # Log-save API (POST /save-pdf-log.php)
├── decrypt-pdf.php           # PDF password-removal API (POST /decrypt-pdf.php)
├── diagnose.php              # CLI-only diagnostic script (delete after rollout)
│
├── PDF-Editor.html           # Pre-PHP original HTML version (kept for reference)
│
├── css/
│   ├── PDF-Editor.css        # Main stylesheet
│   └── tailwind.css
│
├── js/
│   ├── PDF-Editor.js         # Main UI logic
│   ├── dynamodb-integration.js  # Log uploader
│   ├── qpdf-integration.js   # Decryption requester
│   ├── pdf.min.js            # PDF.js (rendering)
│   ├── pdf-lib.min.js        # pdf-lib (rebuild)
│   └── pdf.worker.min.js
│
├── assets/                   # Icons, favicon, etc.
├── img/
├── qpdf/
│   ├── bin/qpdf              # qpdf executable
│   └── lib/                  # qpdf shared libraries
│
├── docs/
│   └── AWS_SETUP.md          # AWS DynamoDB setup guide
│
├── LICENSE
├── README.md                 # This file (English)
└── README_JP.md              # Japanese README
```

---

## 🔒 Security

### Transport
- **Forced HTTPS redirect** (`.htaccess`)
- **HSTS**: `max-age=31536000; includeSubDomains`
- **Same-origin enforcement** (`ALLOWED_ORIGINS` + `Origin` / `Referer` validation)
- **CORS** is emitted dynamically and only for the same origin

### CSRF
- 32-byte random token per session
- `index.php` exposes the token via `<meta name="csrf-token">`; JavaScript reads it and sends it as `X-CSRF-Token`
- Validation uses `hash_equals()` (constant-time)

### Sessions
- `Secure` / `HttpOnly` / `SameSite=Strict` enforced
- `session.use_strict_mode = 1`

### Input validation
- `Content-Type` enforcement
- JSON payload size limit
- Filename sanitization (NUL/control character stripping, path-separator neutralization)
- Upload **MIME check + PDF magic bytes (`%PDF`)** check
- Whitelist validation for parameters such as `side`
- Password length cap (1024 B)

### Rate limiting
- Per IP, per endpoint
- File-lock (`flock`) based counters

### CSP (Content-Security-Policy)
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

### Error leakage prevention
- Exception messages go only to `error_log()`; clients receive generic messages
- Passwords and executed commands are never logged
- No debug information is included in client responses

### Sensitive-file protection
- `aws-config.php`, `dynamodb-client.php`, `security-helpers.php`, `config.php`, `diagnose.php`, `credentials`, `.env`, etc. are denied direct access via `.htaccess`
- AWS credentials are stored **outside the web root**

---

## 🔌 API Endpoints

### `POST /save-pdf-log.php`

Records upload metadata to DynamoDB.

**Headers**:
- `Content-Type: application/json`
- `X-CSRF-Token: <session token>`

**Request body**:
```json
{
  "filename": "example.pdf",
  "side": "left",
  "num_pages": 12
}
```

**Response (success)**:
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

**HTTP status codes**:
| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Invalid input |
| 403 | Origin / CSRF rejected |
| 405 | Method not allowed |
| 413 | Payload too large |
| 415 | Unsupported `Content-Type` |
| 429 | Rate limit exceeded |
| 500 | Server-side error (e.g. AWS misconfiguration) |

### `POST /decrypt-pdf.php`

Removes password protection using qpdf and returns the result.

**Form fields (`multipart/form-data`)**:
- `pdf`: PDF file
- `password`: Password (empty string allowed)

**Headers**: `X-CSRF-Token: <session token>`

**Response (success)**:
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

## 🎮 Usage

### Loading PDFs
- Click **"Choose file"** or **drag & drop** onto the upload area
- Each pane can hold a different PDF
- Password-protected PDFs trigger a password modal

### Page operations

| Action | How |
|---|---|
| Reorder (within a PDF) | Drag a thumbnail and drop within the same pane |
| Copy to the other PDF | Drag a thumbnail and drop on the opposite pane |
| Delete | **Right-click** a thumbnail → "🗑️ Delete page" |
| Zoom preview | Click a thumbnail |
| Cancel | `ESC` (closes modals / progress bar) |

### Markers
- **"Moved"** (blue): Pages moved away from their original loaded position. The marker is removed automatically when the page returns to its original slot.
- **"Copied"** (green): Pages copied from another PDF. Shown permanently.

### Download
- Click **"💾 Download PDF"** under each pane
- A progress bar tracks the export. `ESC` or "✕ Cancel" aborts the operation.

---

## 🔧 Troubleshooting

### `save-pdf-log.php 500 (Internal Server Error)`

Details are written to the server's `error_log()`. Also see the troubleshooting section in `docs/AWS_SETUP.md`.

A CLI diagnostic script is available:

```bash
php diagnose.php
```

Common causes:
- AWS credential issues (full-width spaces, missing files, wrong permissions)
- IAM user lacks `dynamodb:PutItem`
- DynamoDB table missing or in a different region

### `decrypt-pdf.php` errors
- `qpdf` not found: Verify execute permissions on `qpdf/bin/qpdf`, or check `which qpdf`
- Wrong password: User can retry from the client modal
- File too large: Check `MAX_FILE_SIZE` in `config.php` and `upload_max_filesize` / `post_max_size` in `.htaccess`

### `403 (Forbidden)` in the browser
- Session expired → reload the page (a new CSRF token is issued)
- `ALLOWED_ORIGINS` does not match the actual host

### `429 (Too Many Requests)`
- Rate limit hit. Wait the duration in the `Retry-After` header
- Adjust `RATE_LIMIT_*` in `config.php` if needed

### CSP violation blocks resources
- Check the browser console for "Refused to load…"
- For external CDNs, add the appropriate directive in `.htaccess`'s `Content-Security-Policy`

---

## 🧪 For Developers

### CLI diagnostics

```bash
php diagnose.php
```

Reports credential file presence and readability, key lengths, hidden-character detection, and an end-to-end DynamoDB `PutItem` test in a single command.

> ⚠️ **Delete `diagnose.php` after verification.** `.htaccess` already blocks web access, but the file should not be left on a production server.

### Debug mode
Setting `ENABLE_DEBUG = true` in `config.php` enables PHP error display. Always revert to `false` in production.

### Syntax checks

```bash
php -l <file.php>
node -c <file.js>
```

---

## 📜 License

This project is released under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## 🤝 Contributing

Please report bugs and request features via GitHub Issues.
