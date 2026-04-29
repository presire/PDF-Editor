<?php
/**
 * PDFアップロードログをDynamoDBに保存
 *
 * このスクリプトは、PDFファイルがアップロードされた際に
 * ファイル名と日時をDynamoDBに記録します。
 */

require_once 'config.php';
require_once 'security-helpers.php';
require_once 'aws-config.php';
require_once 'dynamodb-client.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// 同一オリジン用 CORS ヘッダー
sendSameOriginCorsHeaders();

// プリフライト
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// POSTのみ受け付け
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST, OPTIONS');
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

/**
 * JSONレスポンスを返す
 */
function sendJsonResponse($success, $message, $data = null, $httpStatus = 200) {
    http_response_code($httpStatus);
    $response = ['success' => $success, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit();
}

// DynamoDBログが無効の場合は何もせず成功を返す
if (!ENABLE_DYNAMODB_LOG) {
    sendJsonResponse(true, 'Logging is disabled');
}

// 同一オリジン検証 → CSRF検証 → レート制限
requireSameOrigin();
requireValidCsrfToken();
enforceRateLimit('save_log', RATE_LIMIT_LOG_REQUESTS, RATE_LIMIT_LOG_WINDOW);

// Content-Type 検証
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    sendJsonResponse(false, 'Unsupported content type', null, 415);
}

try {
    // ペイロードサイズ制限
    $contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
    if ($contentLength > MAX_JSON_PAYLOAD) {
        sendJsonResponse(false, 'Payload too large', null, 413);
    }

    $input = file_get_contents('php://input', false, null, 0, MAX_JSON_PAYLOAD + 1);
    if ($input === false) {
        sendJsonResponse(false, 'Failed to read request body', null, 400);
    }
    if (strlen($input) > MAX_JSON_PAYLOAD) {
        sendJsonResponse(false, 'Payload too large', null, 413);
    }

    $data = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        sendJsonResponse(false, 'Invalid JSON data', null, 400);
    }

    // --- 入力検証 ---

    // filename: 必須・最大255文字・パス区切り文字を排除
    $filenameRaw = $data['filename'] ?? '';
    $filename = sanitizeString($filenameRaw, 255);
    $filename = str_replace(['/', '\\'], '_', $filename);
    if ($filename === '') {
        sendJsonResponse(false, 'Filename is required', null, 400);
    }

    // side: ホワイトリスト
    $side = $data['side'] ?? '';
    if (!in_array($side, ['left', 'right'], true)) {
        $side = 'unknown';
    }

    // num_pages: 0〜10000
    $numPages = isset($data['num_pages']) ? (int)$data['num_pages'] : 0;
    if ($numPages < 0)     { $numPages = 0; }
    if ($numPages > 10000) { $numPages = 10000; }

    // upload_time: クライアント値は信用せずサーバ時刻を使用
    $uploadTime = date('Y-m-d H:i:s');

    // --- AWS 認証情報 ---
    if (!validateAWSCredentials()) {
        error_log('save-pdf-log: AWS credentials not configured');
        sendJsonResponse(false, 'Server configuration error', null, 500);
    }

    $dynamoDb  = getDynamoDBClient();
    $tableName = DYNAMODB_TABLE_LOG;
    $uniqueId  = time() . '-' . bin2hex(random_bytes(8));

    $item = [
        'id'          => ['S' => $uniqueId],
        'filename'    => ['S' => $filename],
        'upload_time' => ['S' => $uploadTime],
        'side'        => ['S' => $side],
        'timestamp'   => ['N' => (string)time()],
        'date'        => ['S' => date('Y-m-d')],
        'time'        => ['S' => date('H:i:s')],
    ];
    if ($numPages > 0) {
        $item['num_pages'] = ['N' => (string)$numPages];
    }

    $dynamoDb->putItem($tableName, $item);

    sendJsonResponse(true, 'PDF upload log saved successfully', [
        'id'          => $uniqueId,
        'filename'    => $filename,
        'upload_time' => $uploadTime,
        'side'        => $side,
        'num_pages'   => $numPages,
    ]);

} catch (Throwable $e) {
    // 詳細はサーバログのみ。クライアントには汎用メッセージ。
    error_log('save-pdf-log error: ' . $e->getMessage());
    sendJsonResponse(false, 'Failed to save log', null, 500);
}
