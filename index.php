<?php
/**
 * PDF編集ツール - ビジュアルエディタ
 * 2つのPDFを読み込んで、ページを自由に移動・コピー・削除できるツール
 */

// 設定ファイルを読み込む
require_once 'config.php';
require_once 'security-helpers.php';

// セキュアなセッションを開始し、CSRFトークンを発行
startSecureSession();
$csrfToken = getCsrfToken();

// セキュリティヘッダーの設定
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

// CSP nonce を生成し、CSPヘッダーを送出
$cspNonce = generateCspNonce();
sendCspHeader($cspNonce);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <!-- 初期テーマ適用 (FOUC回避: localStorage > prefers-color-scheme) -->
    <script nonce="<?php echo htmlspecialchars($cspNonce, ENT_QUOTES, 'UTF-8'); ?>">
        (function() {
            try {
                var stored = localStorage.getItem('pdfEditorTheme');
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = stored || (prefersDark ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {
                document.documentElement.setAttribute('data-theme', 'light');
            }
        })();
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8'); ?>">
    <title><?php echo htmlspecialchars(APP_TITLE); ?></title>

    <!-- ファビコン追加 -->
    <link rel="icon" type="image/x-icon" href="assets/favicon.ico">

    <!-- PDF.js -->
    <script src="<?php echo htmlspecialchars(PDF_JS_PATH); ?>"></script>

    <!-- PDF-lib -->
    <script src="<?php echo htmlspecialchars(PDF_LIB_PATH); ?>"></script>

    <!-- Webフォント -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap">

    <!-- Tailwind CSS (v4 ビルド済) -->
    <link rel="stylesheet" href="css/tailwind.css">

    <!-- 外部CSSファイル -->
    <link rel="stylesheet" href="<?php echo htmlspecialchars(CSS_PATH); ?>">
</head>
<body>
    <!-- アイコンスプライト (Lucide派生 / stroke 1.75) -->
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
        <defs>
            <symbol id="icon-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </symbol>
            <symbol id="icon-upload-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 16l-4-4-4 4"></path>
                <path d="M12 12v9"></path>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
                <path d="M16 16l-4-4-4 4"></path>
            </symbol>
            <symbol id="icon-file-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
            </symbol>
            <symbol id="icon-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </symbol>
            <symbol id="icon-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
            </symbol>
            <symbol id="icon-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </symbol>
            <symbol id="icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </symbol>
            <symbol id="icon-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </symbol>
            <symbol id="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
            </symbol>
            <symbol id="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </symbol>
        </defs>
    </svg>

    <div class="container">
        <header class="header">
            <!-- ヘッダー右上のコントロール群 -->
            <div class="header-controls">
                <button type="button" class="theme-toggle-btn" id="themeToggle" aria-label="Toggle theme" title="Toggle theme">
                    <svg class="icon icon-moon" aria-hidden="true"><use href="#icon-moon"></use></svg>
                    <svg class="icon icon-sun" aria-hidden="true"><use href="#icon-sun"></use></svg>
                </button>
                <div class="language-toggle-container">
                    <span class="language-text" id="currentLangLabel">日本語</span>
                    <div class="toggle-switch" id="langToggle" role="switch" aria-checked="false" tabindex="0" aria-label="Language toggle">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
            </div>

            <div class="header-brand">
                <img src="assets/pdf-editor-icon-modern.svg" alt="" class="header-logo">
                <h1 data-i18n="title">PDF編集ツール</h1>
            </div>
            <p data-i18n="subtitle">2つのPDFを読み込んで、ページを自由に移動・コピー・削除できます</p>
            <button class="how-to-use-btn" id="howToUseBtn">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-help"></use></svg>
                <span data-i18n="howToUseBtn">How to use</span>
            </button>
        </header>

        <div class="main-content">
            <!-- 左側のPDF -->
            <div class="pdf-panel">
                <h2 id="pdfLabel1">
                    <div class="pdf-icon">L</div>
                    <span data-i18n="leftPdf">左側のPDF</span>
                </h2>
                <!-- 読み込み中アラート（左側専用） -->
                <div class="loading-alert" id="loadingAlert1">
                    <div class="loading-message" data-i18n="loading">読み込み中...</div>
                    <button class="loading-cancel-btn" id="loadingCancelBtn1" data-i18n="cancelLoading">読み込みをキャンセル</button>
                </div>
                <div class="upload-area" id="uploadArea1">
                    <svg class="upload-area-icon" aria-hidden="true"><use href="#icon-upload-cloud"></use></svg>
                    <p data-i18n="dragDropText">PDFファイルをドラッグ＆ドロップ</p>
                    <button type="button" class="upload-btn" data-file-input="fileInput1">
                        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-file-plus"></use></svg>
                        <span data-i18n="selectFile">ファイルを選択</span>
                    </button>
                    <input type="file" id="fileInput1" accept=".pdf">
                </div>
                <div class="pages-container" id="pagesContainer1"></div>
                <div class="download-area">
                    <button class="download-btn" id="downloadBtn1" disabled>
                        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-download"></use></svg>
                        <span data-i18n="downloadLeft">左側のPDFをダウンロード</span>
                    </button>
                </div>
            </div>

            <!-- 右側のPDF -->
            <div class="pdf-panel">
                <h2 id="pdfLabel2">
                    <div class="pdf-icon">R</div>
                    <span data-i18n="rightPdf">右側のPDF</span>
                </h2>
                <!-- 読み込み中アラート（右側専用） -->
                <div class="loading-alert" id="loadingAlert2">
                    <div class="loading-message" data-i18n="loading">読み込み中...</div>
                    <button class="loading-cancel-btn" id="loadingCancelBtn2" data-i18n="cancelLoading">読み込みをキャンセル</button>
                </div>
                <div class="upload-area" id="uploadArea2">
                    <svg class="upload-area-icon" aria-hidden="true"><use href="#icon-upload-cloud"></use></svg>
                    <p data-i18n="dragDropText">PDFファイルをドラッグ＆ドロップ</p>
                    <button type="button" class="upload-btn" data-file-input="fileInput2">
                        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-file-plus"></use></svg>
                        <span data-i18n="selectFile">ファイルを選択</span>
                    </button>
                    <input type="file" id="fileInput2" accept=".pdf">
                </div>
                <div class="pages-container" id="pagesContainer2"></div>
                <div class="download-area">
                    <button class="download-btn" id="downloadBtn2" disabled>
                        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-download"></use></svg>
                        <span data-i18n="downloadRight">右側のPDFをダウンロード</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 拡大表示モーダル -->
    <div class="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalInfo">
        <button class="modal-close" id="modalClose" aria-label="Close">
            <svg class="icon" aria-hidden="true"><use href="#icon-x"></use></svg>
        </button>
        <div class="modal-content">
            <div class="modal-page-info" id="modalInfo"></div>
            <div class="modal-canvas-wrapper">
                <canvas id="modalCanvas"></canvas>
            </div>
        </div>
    </div>

    <!-- コンテキストメニュー -->
    <div class="context-menu" id="contextMenu" role="menu">
        <div class="context-menu-item delete" id="deleteMenuItem" role="menuitem" tabindex="-1">
            <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-trash"></use></svg>
            <span data-i18n="deletePage">ページを削除</span>
        </div>
    </div>

    <!-- ステータスメッセージ -->
    <div class="status-message" id="statusMessage" role="status" aria-live="polite" aria-atomic="true"></div>

    <!-- プログレスバー -->
    <div class="progress-overlay" id="progressOverlay" role="dialog" aria-modal="true" aria-labelledby="progressTitle">
        <div class="progress-container">
            <div class="progress-title" id="progressTitle" data-i18n="generatingPdf">PDFを生成中...</div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar" id="progressBar">
                    <div class="progress-bar-fill" id="progressBarFill"></div>
                </div>
                <div class="progress-text" id="progressText">0%</div>
            </div>
            <div class="progress-details" id="progressDetails">0 / 0 <span data-i18n="pages">ページ</span></div>
            <!-- キャンセルボタン (ESCキーでも同じ動作) -->
            <button class="progress-cancel-btn" id="progressCancelBtn">
                <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-x"></use></svg>
                <span data-i18n="cancelProgress">キャンセル (ESC)</span>
            </button>
        </div>
    </div>

    <!-- 使用方法モーダル -->
    <div class="how-to-use-overlay" id="howToUseOverlay" role="dialog" aria-modal="true" aria-labelledby="howToUseTitle">
        <div class="how-to-use-modal">
            <button class="how-to-use-close" id="howToUseClose" aria-label="Close">
                <svg class="icon" aria-hidden="true"><use href="#icon-x"></use></svg>
            </button>
            <h2 id="howToUseTitle" class="how-to-use-title" data-i18n="usageTitle">使用方法</h2>
            <div class="how-to-use-content">
                <section class="how-to-section">
                    <h3 data-i18n="loadPdfTitle">PDFファイルの読み込み</h3>
                    <ul>
                        <li data-i18n="loadPdfMethod1"><strong>方法1:</strong> 「ファイルを選択」ボタンをクリックしてPDFを選択</li>
                        <li data-i18n="loadPdfMethod2"><strong>方法2:</strong> PDFファイルをアップロードエリアにドラッグ＆ドロップ</li>
                        <li data-i18n="loadPdfNote">左側と右側のパネルに、それぞれ異なるPDFを読み込めます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="movePageTitle">ページの移動</h3>
                    <ul>
                        <li data-i18n="movePageDesc1">同じPDF内でページを並べ替えるには、ページサムネイルをドラッグして目的の位置にドロップ</li>
                        <li data-i18n="movePageDesc2">プレビューラインが挿入位置を示します</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="copyPageTitle">ページのコピー</h3>
                    <ul>
                        <li data-i18n="copyPageDesc1">一方のパネルから他方のパネルにページをドラッグ＆ドロップ</li>
                        <li data-i18n="copyPageDesc2">元のページはソースPDFに残り、コピーが宛先PDFに追加されます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="deletePageTitle">ページの削除</h3>
                    <ul>
                        <li data-i18n="deletePageDesc1">削除したいページサムネイルを右クリック</li>
                        <li data-i18n="deletePageDesc2">コンテキストメニューから「ページを削除」を選択</li>
                        <li data-i18n="deletePageNote"><strong>注意:</strong> PDFには最低1ページが必要です</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="zoomPageTitle">ページの拡大表示</h3>
                    <ul>
                        <li data-i18n="zoomPageDesc1">任意のページサムネイルをクリック</li>
                        <li data-i18n="zoomPageDesc2">モーダルウィンドウでページが拡大表示されます</li>
                        <li data-i18n="zoomPageDesc3">閉じるボタンまたはモーダルの外側をクリックして閉じます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="downloadPdfTitle">編集済みPDFのダウンロード</h3>
                    <ul>
                        <li data-i18n="downloadPdfDesc1">各パネル下部の「左側のPDFをダウンロード」または「右側のPDFをダウンロード」ボタンをクリック</li>
                        <li data-i18n="downloadPdfDesc2">進捗バーで生成状況を確認できます</li>
                        <li data-i18n="downloadPdfDesc3">ESCキーまたは「キャンセル」ボタンで操作をキャンセルできます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="keyboardShortcutTitle">キーボードショートカット</h3>
                    <ul>
                        <li data-i18n="keyboardShortcutEsc"><strong>ESC:</strong> PDF生成のキャンセル、またはモーダルウィンドウを閉じる</li>
                        <li data-i18n="keyboardShortcutRightClick"><strong>右クリック:</strong> ページサムネイルのコンテキストメニューを開く</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="securityTitle">セキュリティ</h3>
                    <ul>
                        <li data-i18n="securityDesc1">全ての処理はWebブラウザ内で完結します</li>
                        <li data-i18n="securityDesc2">PDFファイルがサーバに送信されることはありません</li>
                    </ul>
                </section>
            </div>
        </div>
    </div>

    <!-- パスワード入力モーダル -->
    <div class="password-overlay" id="passwordOverlay" role="dialog" aria-modal="true" aria-labelledby="passwordTitle">
        <div class="password-modal">
            <div class="password-modal-header">
                <span class="password-modal-icon" aria-hidden="true">
                    <svg class="icon" aria-hidden="true"><use href="#icon-lock"></use></svg>
                </span>
                <h3 id="passwordTitle" data-i18n="passwordRequired">パスワードが必要です</h3>
            </div>
            <p data-i18n="passwordPrompt">このPDFはパスワードで保護されています。パスワードを入力してください：</p>
            <input type="password" id="passwordInput" placeholder="パスワード" />
            <div class="password-buttons">
                <button class="password-btn-ok" id="passwordOkBtn" data-i18n="passwordOk">OK</button>
                <button class="password-btn-cancel" id="passwordCancelBtn" data-i18n="passwordCancel">キャンセル</button>
            </div>
            <div class="password-error" id="passwordError"></div>
        </div>
    </div>

    <!-- DynamoDB連携機能 -->
    <script nonce="<?php echo htmlspecialchars($cspNonce, ENT_QUOTES, 'UTF-8'); ?>">var ENABLE_DYNAMODB_LOG = <?php echo ENABLE_DYNAMODB_LOG ? 'true' : 'false'; ?>;</script>
    <script src="js/dynamodb-integration.js"></script>

    <!-- qpdf連携機能（パスワード付きPDF対応） -->
    <script src="js/qpdf-integration.js"></script>

    <!-- 外部JavaScriptファイル -->
    <script src="<?php echo htmlspecialchars(JS_PATH); ?>"></script>
</body>
</html>
