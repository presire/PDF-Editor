<?php
/**
 * PDFパスワード解除エンドポイント
 *
 * パスワード付きPDFを受け取り、qpdfコマンドでパスワード保護を解除して返す。
 * セキュリティ:
 *  - 同一オリジン + CSRFトークン + レート制限
 *  - ファイルサイズ・MIME・PDFマジックバイト検証
 *  - 例外時の一時ファイル削除（register_shutdown_function）
 *  - パスワードや実行コマンドはログ出力しない
 */

require_once 'config.php';
require_once 'security-helpers.php';

// 一時ファイルパスを保持（shutdown関数からアクセス）
$GLOBALS['__decrypt_tempfiles'] = [];

register_shutdown_function(function () {
    foreach ($GLOBALS['__decrypt_tempfiles'] as $path) {
        if (is_string($path) && $path !== '' && file_exists($path)) {
            @unlink($path);
        }
    }
});

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

sendSameOriginCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

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

/**
 * qpdfコマンドのパスを取得
 */
function getQpdfPath() {
    $localPaths = [
        __DIR__ . '/qpdf/bin/qpdf',
        __DIR__ . '/qpdf/bin/qpdf.exe',
        __DIR__ . '/qpdf.exe',
    ];
    foreach ($localPaths as $path) {
        if (file_exists($path) && is_executable($path)) {
            return $path;
        }
    }
    return 'qpdf';
}

/**
 * qpdfが利用可能かチェック
 */
function checkQpdfAvailability() {
    $qpdfPath = getQpdfPath();
    $output = [];
    $returnVar = 0;
    exec(escapeshellcmd($qpdfPath) . ' --version 2>&1', $output, $returnVar);
    return [
        'available' => ($returnVar === 0),
        'version'   => implode(' ', $output),
        'path'      => $qpdfPath,
    ];
}

// セキュリティチェック
requireSameOrigin();
requireValidCsrfToken();
enforceRateLimit('decrypt', RATE_LIMIT_DECRYPT_REQUESTS, RATE_LIMIT_DECRYPT_WINDOW);

try {
    // qpdfの利用可能性
    $qpdfInfo = checkQpdfAvailability();
    if (!$qpdfInfo['available']) {
        error_log('decrypt-pdf: qpdf not available at ' . $qpdfInfo['path']);
        sendJsonResponse(false, 'PDF decryption is currently unavailable', null, 503);
    }

    // ファイル受け取り
    if (!isset($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['pdf']['error'] ?? 'no_file';
        if ($errCode === UPLOAD_ERR_INI_SIZE || $errCode === UPLOAD_ERR_FORM_SIZE) {
            sendJsonResponse(false, 'Uploaded file is too large', null, 413);
        }
        sendJsonResponse(false, 'PDF file upload failed', null, 400);
    }

    $uploadedFile = $_FILES['pdf'];

    // ファイルサイズ検証
    if ($uploadedFile['size'] <= 0) {
        sendJsonResponse(false, 'Uploaded file is empty', null, 400);
    }
    if ($uploadedFile['size'] > MAX_FILE_SIZE) {
        sendJsonResponse(false, 'Uploaded file is too large', null, 413);
    }

    // MIMEタイプ検証
    $fileType = function_exists('mime_content_type') ? mime_content_type($uploadedFile['tmp_name']) : '';
    if ($fileType !== 'application/pdf') {
        sendJsonResponse(false, 'Uploaded file is not a PDF', null, 400);
    }

    // PDFマジックバイト検証（先頭4バイト）
    $fp = fopen($uploadedFile['tmp_name'], 'rb');
    if ($fp === false) {
        sendJsonResponse(false, 'Failed to read uploaded file', null, 500);
    }
    $magic = fread($fp, 4);
    fclose($fp);
    if ($magic !== '%PDF') {
        sendJsonResponse(false, 'Uploaded file is not a valid PDF', null, 400);
    }

    // パスワード
    if (!isset($_POST['password'])) {
        sendJsonResponse(false, 'Password parameter is missing', null, 400);
    }
    $password = (string)$_POST['password'];
    if (strlen($password) > 1024) {
        sendJsonResponse(false, 'Password is too long', null, 400);
    }

    // 一時ファイル
    $tempDir       = sys_get_temp_dir();
    $randomId      = bin2hex(random_bytes(16));
    $inputPdfPath  = $tempDir . DIRECTORY_SEPARATOR . 'pdf_' . $randomId . '_input.pdf';
    $outputPdfPath = $tempDir . DIRECTORY_SEPARATOR . 'pdf_' . $randomId . '_output.pdf';
    $GLOBALS['__decrypt_tempfiles'][] = $inputPdfPath;
    $GLOBALS['__decrypt_tempfiles'][] = $outputPdfPath;

    if (!move_uploaded_file($uploadedFile['tmp_name'], $inputPdfPath)) {
        sendJsonResponse(false, 'Failed to save uploaded file', null, 500);
    }

    // qpdfでパスワード解除
    $qpdfPath = getQpdfPath();
    $commandParts = [
        escapeshellcmd($qpdfPath),
        '--password=' . escapeshellarg($password),
        '--decrypt',
        '--',
        escapeshellarg($inputPdfPath),
        escapeshellarg($outputPdfPath),
        '2>&1',
    ];
    $command = implode(' ', $commandParts);

    $output = [];
    $returnVar = 0;
    exec($command, $output, $returnVar);

    if ($returnVar !== 0) {
        // 失敗内容はサーバログのみ（パスワードを含むコマンドはログ出力しない）
        error_log('decrypt-pdf: qpdf failed (rc=' . $returnVar . ')');
        sendJsonResponse(false, 'Failed to decrypt PDF. The password may be incorrect.', null, 400);
    }

    if (!file_exists($outputPdfPath)) {
        error_log('decrypt-pdf: output file missing after qpdf success');
        sendJsonResponse(false, 'Decrypted PDF could not be produced', null, 500);
    }

    $pdfContent = file_get_contents($outputPdfPath);
    if ($pdfContent === false) {
        sendJsonResponse(false, 'Failed to read decrypted PDF', null, 500);
    }

    // Base64で返却（既存フロントとの互換維持）
    sendJsonResponse(true, 'PDF decrypted successfully', [
        'pdf_data' => base64_encode($pdfContent),
        'size'     => strlen($pdfContent),
    ]);

} catch (Throwable $e) {
    error_log('decrypt-pdf error: ' . $e->getMessage());
    sendJsonResponse(false, 'An unexpected error occurred', null, 500);
}
