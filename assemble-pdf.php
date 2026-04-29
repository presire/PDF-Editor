<?php
/**
 * PDF組み立てエンドポイント
 *
 * 複数のPDFファイルとページリストを受け取り、qpdfでページを組み立てて返す。
 * セキュリティ:
 *  - 同一オリジン + CSRFトークン + レート制限
 *  - ファイルサイズ・MIME・PDFマジックバイト検証
 *  - ページ範囲の厳格なバリデーション（コマンドインジェクション防止）
 *  - 例外時の一時ファイル削除（register_shutdown_function）
 */

require_once 'config.php';
require_once 'security-helpers.php';

$GLOBALS['__assemble_tempfiles'] = [];

register_shutdown_function(function () {
    foreach ($GLOBALS['__assemble_tempfiles'] as $path) {
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

function sendJsonResponse($success, $message, $data = null, $httpStatus = 200) {
    http_response_code($httpStatus);
    $response = ['success' => $success, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit();
}

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

function validatePdfUpload($fileKey, $required) {
    if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] === UPLOAD_ERR_NO_FILE) {
        if ($required) {
            sendJsonResponse(false, "PDF file ($fileKey) is required", null, 400);
        }
        return null;
    }

    $file = $_FILES[$fileKey];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
            sendJsonResponse(false, 'Uploaded file is too large', null, 413);
        }
        sendJsonResponse(false, "PDF file ($fileKey) upload failed", null, 400);
    }

    if ($file['size'] <= 0) {
        sendJsonResponse(false, 'Uploaded file is empty', null, 400);
    }
    if ($file['size'] > MAX_FILE_SIZE) {
        sendJsonResponse(false, 'Uploaded file is too large', null, 413);
    }

    $fileType = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : '';
    if ($fileType !== 'application/pdf') {
        sendJsonResponse(false, 'Uploaded file is not a PDF', null, 400);
    }

    $fp = fopen($file['tmp_name'], 'rb');
    if ($fp === false) {
        sendJsonResponse(false, 'Failed to read uploaded file', null, 500);
    }
    $magic = fread($fp, 4);
    fclose($fp);
    if ($magic !== '%PDF') {
        sendJsonResponse(false, 'Uploaded file is not a valid PDF', null, 400);
    }

    return $file;
}

// セキュリティチェック
requireSameOrigin();
requireValidCsrfToken();
enforceRateLimit('assemble', RATE_LIMIT_ASSEMBLE_REQUESTS, RATE_LIMIT_ASSEMBLE_WINDOW);

try {
    $qpdfInfo = checkQpdfAvailability();
    if (!$qpdfInfo['available']) {
        error_log('assemble-pdf: qpdf not available at ' . $qpdfInfo['path']);
        sendJsonResponse(false, 'PDF assembly is currently unavailable', null, 503);
    }

    $file1 = validatePdfUpload('pdf1', true);
    $file2 = validatePdfUpload('pdf2', false);

    // pageList のバリデーション
    if (!isset($_POST['pageList'])) {
        sendJsonResponse(false, 'pageList parameter is missing', null, 400);
    }

    $pageList = json_decode($_POST['pageList'], true);
    if (!is_array($pageList) || empty($pageList)) {
        sendJsonResponse(false, 'pageList must be a non-empty JSON array', null, 400);
    }
    if (count($pageList) > 1000) {
        sendJsonResponse(false, 'Too many page entries', null, 400);
    }

    foreach ($pageList as $i => $entry) {
        if (!isset($entry['pdf']) || !isset($entry['page'])) {
            sendJsonResponse(false, "pageList[$i]: pdf and page are required", null, 400);
        }
        $pdfNum = $entry['pdf'];
        if ($pdfNum !== 1 && $pdfNum !== 2) {
            sendJsonResponse(false, "pageList[$i]: pdf must be 1 or 2", null, 400);
        }
        if ($pdfNum === 2 && $file2 === null) {
            sendJsonResponse(false, "pageList[$i]: references pdf2 but no pdf2 was uploaded", null, 400);
        }
        $page = $entry['page'];
        if (!is_int($page) || $page < 1) {
            sendJsonResponse(false, "pageList[$i]: page must be a positive integer", null, 400);
        }
    }

    // 一時ファイル
    $tempDir  = sys_get_temp_dir();
    $randomId = bin2hex(random_bytes(16));
    $input1Path = $tempDir . DIRECTORY_SEPARATOR . 'pdf_' . $randomId . '_asm_input1.pdf';
    $outputPath = $tempDir . DIRECTORY_SEPARATOR . 'pdf_' . $randomId . '_asm_output.pdf';
    $GLOBALS['__assemble_tempfiles'][] = $input1Path;
    $GLOBALS['__assemble_tempfiles'][] = $outputPath;

    if (!move_uploaded_file($file1['tmp_name'], $input1Path)) {
        sendJsonResponse(false, 'Failed to save uploaded file', null, 500);
    }

    $input2Path = null;
    if ($file2 !== null) {
        $input2Path = $tempDir . DIRECTORY_SEPARATOR . 'pdf_' . $randomId . '_asm_input2.pdf';
        $GLOBALS['__assemble_tempfiles'][] = $input2Path;
        if (!move_uploaded_file($file2['tmp_name'], $input2Path)) {
            sendJsonResponse(false, 'Failed to save uploaded file', null, 500);
        }
    }

    $fileMap = [
        1 => $input1Path,
        2 => $input2Path,
    ];

    // 連続する同一ソースのページをグループ化してqpdfの引数を構築
    $groups = [];
    $currentPdf = null;
    $currentPages = [];

    foreach ($pageList as $entry) {
        if ($entry['pdf'] !== $currentPdf) {
            if ($currentPdf !== null) {
                $groups[] = ['pdf' => $currentPdf, 'pages' => $currentPages];
            }
            $currentPdf = $entry['pdf'];
            $currentPages = [$entry['page']];
        } else {
            $currentPages[] = $entry['page'];
        }
    }
    if ($currentPdf !== null) {
        $groups[] = ['pdf' => $currentPdf, 'pages' => $currentPages];
    }

    // qpdfコマンド構築
    $qpdfPath = getQpdfPath();
    $commandParts = [escapeshellcmd($qpdfPath), '--empty', '--pages'];

    foreach ($groups as $group) {
        $commandParts[] = escapeshellarg($fileMap[$group['pdf']]);
        $pageNums = implode(',', $group['pages']);
        if (!preg_match('/^[0-9,]+$/', $pageNums)) {
            sendJsonResponse(false, 'Invalid page specification', null, 400);
        }
        $commandParts[] = $pageNums;
    }

    $commandParts[] = '--';
    $commandParts[] = escapeshellarg($outputPath);
    $commandParts[] = '2>&1';

    $command = implode(' ', $commandParts);

    $output = [];
    $returnVar = 0;
    exec($command, $output, $returnVar);

    if ($returnVar !== 0 && $returnVar !== 3) {
        error_log('assemble-pdf: qpdf failed (rc=' . $returnVar . ')');
        sendJsonResponse(false, 'Failed to assemble PDF', null, 500);
    }

    if (!file_exists($outputPath)) {
        error_log('assemble-pdf: output file missing after qpdf success');
        sendJsonResponse(false, 'Assembled PDF could not be produced', null, 500);
    }

    $pdfContent = file_get_contents($outputPath);
    if ($pdfContent === false) {
        sendJsonResponse(false, 'Failed to read assembled PDF', null, 500);
    }

    sendJsonResponse(true, 'PDF assembled successfully', [
        'pdf_data' => base64_encode($pdfContent),
        'size'     => strlen($pdfContent),
    ]);

} catch (Throwable $e) {
    error_log('assemble-pdf error: ' . $e->getMessage());
    sendJsonResponse(false, 'An unexpected error occurred', null, 500);
}
