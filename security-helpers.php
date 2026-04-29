<?php
/**
 * セキュリティ共通ヘルパー
 *
 * CSRFトークン、レート制限、Origin検証、入力サニタイズなどを提供します。
 * このファイルへの直接アクセスは .htaccess で禁止されています。
 */

if (!defined('APP_TITLE')) {
    http_response_code(403);
    exit('Direct access forbidden');
}

// ============================================
// セッション初期化
// ============================================

/**
 * セキュアなセッションを開始する
 * Cookie属性は HTTPS 専用 + HttpOnly + SameSite=Strict
 */
function startSecureSession() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_start();
}

// ============================================
// CSRF トークン
// ============================================

/**
 * CSRFトークンを取得（無ければ生成）
 *
 * @return string トークン
 */
function getCsrfToken() {
    startSecureSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * リクエストヘッダー X-CSRF-Token を検証
 * 失敗した場合は 403 を返して終了する
 */
function requireValidCsrfToken() {
    startSecureSession();

    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $headerToken  = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if (!is_string($sessionToken) || $sessionToken === '' ||
        !is_string($headerToken)  || $headerToken  === '' ||
        !hash_equals($sessionToken, $headerToken)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'CSRF token validation failed']);
        exit();
    }
}

// ============================================
// Origin / Referer 検証
// ============================================

/**
 * 許可オリジンの一覧を取得
 *
 * @return string[]
 */
function allowedOrigins() {
    if (defined('ALLOWED_ORIGINS') && is_array(ALLOWED_ORIGINS) && !empty(ALLOWED_ORIGINS)) {
        return ALLOWED_ORIGINS;
    }
    // デフォルト: 自ホストの https
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return $host !== '' ? ['https://' . $host] : [];
}

/**
 * Origin / Referer ヘッダーが許可リストに含まれているか確認
 * 失敗した場合は 403 を返して終了する
 */
function requireSameOrigin() {
    $allowed = allowedOrigins();
    $origin  = $_SERVER['HTTP_ORIGIN']  ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';

    $matched = false;

    if ($origin !== '' && in_array($origin, $allowed, true)) {
        $matched = true;
    } elseif ($origin === '' && $referer !== '') {
        foreach ($allowed as $a) {
            if (strpos($referer, $a . '/') === 0 || $referer === $a) {
                $matched = true;
                break;
            }
        }
    }

    if (!$matched) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Cross-origin request rejected']);
        exit();
    }
}

/**
 * 同一オリジン用 CORS レスポンスヘッダーを送出
 */
function sendSameOriginCorsHeaders() {
    $allowed = allowedOrigins();
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Access-Control-Max-Age: 600');
    }
}

// ============================================
// レート制限（ファイルベース／IPごと）
// ============================================

/**
 * IPアドレスに対するレート制限を実施
 * 上限を超えた場合は 429 を返して終了する
 *
 * @param string $bucket  名前（エンドポイントごとに分ける）
 * @param int    $limit   許可リクエスト数
 * @param int    $windowSeconds 計測窓（秒）
 */
function enforceRateLimit($bucket, $limit, $windowSeconds) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $key = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $bucket . '_' . $ip);

    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pdf_editor_ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    $file = $dir . DIRECTORY_SEPARATOR . $key . '.json';

    $fp = @fopen($file, 'c+');
    if ($fp === false) {
        // レート制限ファイルが扱えない場合は通過（サービス停止より優先）
        return;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return;
    }

    $now = time();
    $contents = stream_get_contents($fp);
    $data = ($contents !== false && $contents !== '') ? json_decode($contents, true) : null;

    $timestamps = (is_array($data) && isset($data['ts']) && is_array($data['ts'])) ? $data['ts'] : [];
    $threshold  = $now - $windowSeconds;
    $timestamps = array_values(array_filter($timestamps, function ($t) use ($threshold) {
        return is_int($t) && $t >= $threshold;
    }));

    if (count($timestamps) >= $limit) {
        flock($fp, LOCK_UN);
        fclose($fp);

        $retryAfter = max(1, $windowSeconds);
        http_response_code(429);
        header('Retry-After: ' . $retryAfter);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Too many requests']);
        exit();
    }

    $timestamps[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(['ts' => $timestamps]));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

// ============================================
// CSP Nonce
// ============================================

/**
 * CSP用のnonceを生成する（リクエストごとに1回）
 *
 * @return string Base64エンコードされたnonce
 */
function generateCspNonce() {
    static $nonce = null;
    if ($nonce === null) {
        $nonce = base64_encode(random_bytes(16));
    }
    return $nonce;
}

/**
 * Content-Security-Policyヘッダーを送出する
 *
 * @param string $nonce generateCspNonce() で生成したnonce
 */
function sendCspHeader($nonce) {
    $nonceDirective = "'nonce-" . $nonce . "'";
    $policy = implode('; ', [
        "default-src 'self'",
        "script-src 'self' " . $nonceDirective,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
        "form-action 'self'",
    ]);
    header('Content-Security-Policy: ' . $policy);
}

// ============================================
// 入力サニタイズ
// ============================================

/**
 * 文字列を安全な形に整形（NUL/制御文字除去・長さ制限・UTF-8強制）
 *
 * @param mixed $value
 * @param int   $maxLength
 * @return string
 */
function sanitizeString($value, $maxLength = 255) {
    if (!is_string($value)) {
        return '';
    }
    // NULバイト除去
    $value = str_replace("\0", '', $value);
    // UTF-8として無効なバイトを除去
    if (!mb_check_encoding($value, 'UTF-8')) {
        $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
    }
    // 制御文字（タブ・改行を除く）を除去
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    // 長さ制限（マルチバイト基準）
    if (mb_strlen($value, 'UTF-8') > $maxLength) {
        $value = mb_substr($value, 0, $maxLength, 'UTF-8');
    }
    return $value;
}
