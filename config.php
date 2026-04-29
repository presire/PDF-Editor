<?php
/**
 * PDF編集ツール - 設定ファイル
 * 
 * このファイルでアプリケーションの各種設定を管理します。
 * 本番環境では、セキュリティのため適切な設定を行ってください。
 */

// ============================================
// アプリケーション基本設定
// ============================================

// アプリケーション名
define('APP_TITLE', 'PDF編集ツール - ビジュアルエディタ');

// アプリケーションバージョン
define('APP_VERSION', '0.3.0');

// デバッグモード（本番環境ではfalseに設定すること）
define('ENABLE_DEBUG', false);


// ============================================
// パス設定
// ============================================

// CSS ファイルのパス
define('CSS_PATH', 'css/PDF-Editor.css');

// JavaScript ファイルのパス
define('JS_PATH', 'js/PDF-Editor.js');

// PDF.js のパス
define('PDF_JS_PATH', 'js/pdf.min.js');

// PDF-lib のパス
define('PDF_LIB_PATH', 'js/pdf-lib.min.js');


// ============================================
// セキュリティ設定
// ============================================

// アップロード可能な最大ファイルサイズ（バイト単位）
// デフォルト: 50MB
define('MAX_FILE_SIZE', 50 * 1024 * 1024);

// 許可するファイル拡張子
define('ALLOWED_EXTENSIONS', ['pdf']);

// 許可するMIMEタイプ
define('ALLOWED_MIME_TYPES', ['application/pdf']);

// 許可するオリジン（HTTPSのみ）
// 空配列のままにするとリクエスト時のホストを採用します。
// 本番ドメインを明示する場合は ['https://example.com'] のように記述してください。
define('ALLOWED_ORIGINS', []);

// レート制限: ログ書き込みエンドポイント（IPあたり 60秒に N 回）
define('RATE_LIMIT_LOG_REQUESTS', 20);
define('RATE_LIMIT_LOG_WINDOW',   60);

// レート制限: 復号エンドポイント（IPあたり 300秒に N 回）
define('RATE_LIMIT_DECRYPT_REQUESTS', 10);
define('RATE_LIMIT_DECRYPT_WINDOW',   300);

// JSON ペイロードの最大サイズ（バイト）
define('MAX_JSON_PAYLOAD', 4 * 1024);


// ============================================
// AWS DynamoDB 設定
// ============================================

// DynamoDBへのログ記録を有効にするかどうか（true: 有効, false: 無効）
define('ENABLE_DYNAMODB_LOG', false);

// PDFアップロードログを保存するテーブル名
define('DYNAMODB_TABLE_LOG', 'PDFUploadLogs');


// ============================================
// タイムゾーン設定
// ============================================
date_default_timezone_set('Asia/Tokyo');


// ============================================
// エラー報告設定
// ============================================
if (ENABLE_DEBUG) {
    // デバッグモード: すべてのエラーを表示
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    // 本番モード: エラーを非表示
    error_reporting(0);
    ini_set('display_errors', '0');
}


// ============================================
// カスタム関数（将来の拡張用）
// ============================================

/**
 * ファイルサイズを人間が読みやすい形式に変換
 * 
 * @param int $bytes バイト数
 * @return string フォーマットされた文字列
 */
function formatFileSize($bytes) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= (1 << (10 * $pow));
    
    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * ファイル拡張子のバリデーション
 * 
 * @param string $filename ファイル名
 * @return bool 許可された拡張子の場合true
 */
function isAllowedExtension($filename) {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($extension, ALLOWED_EXTENSIONS);
}

/**
 * MIMEタイプのバリデーション
 * 
 * @param string $mimeType MIMEタイプ
 * @return bool 許可されたMIMEタイプの場合true
 */
function isAllowedMimeType($mimeType) {
    return in_array($mimeType, ALLOWED_MIME_TYPES);
}
