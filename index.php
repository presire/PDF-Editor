<?php
/**
 * PDF編集ツール - ビジュアルエディタ
 * 2つのPDFを読み込んで、ページを自由に移動・コピー・削除できるツール
 */

// 設定ファイルを読み込む
require_once 'config.php';

// セキュリティヘッダーの設定
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars(APP_TITLE); ?></title>
    
    <!-- PDF.js -->
    <script src="<?php echo htmlspecialchars(PDF_JS_PATH); ?>"></script>
    
    <!-- PDF-lib -->
    <script src="<?php echo htmlspecialchars(PDF_LIB_PATH); ?>"></script>
    
    <!-- 外部CSSファイル -->
    <link rel="stylesheet" href="<?php echo htmlspecialchars(CSS_PATH); ?>">
    <style>
        /* 言語切り替えトグルスイッチのスタイル */
        .language-toggle-container {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 100;
        }
        
        .language-label {
            font-size: 14px;
            font-weight: 500;
            color: #555;
        }
        
        .toggle-switch {
            position: relative;
            width: 60px;
            height: 30px;
            background-color: #ccc;
            border-radius: 15px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .toggle-switch.active {
            background-color: #4CAF50;
        }
        
        .toggle-slider {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 24px;
            height: 24px;
            background-color: white;
            border-radius: 50%;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .toggle-switch.active .toggle-slider {
            transform: translateX(30px);
        }
        
        .language-text {
            font-size: 14px;
            font-weight: 500;
            color: #555;
            min-width: 30px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- 言語切り替えトグルスイッチ -->
            <div class="language-toggle-container">
                <span class="language-text" id="currentLangLabel">日本語</span>
                <div class="toggle-switch" id="langToggle">
                    <div class="toggle-slider"></div>
                </div>
            </div>
            
            <h1 data-i18n="title">📄 PDF編集ツール</h1>
            <p data-i18n="subtitle">2つのPDFを読み込んで、ページを自由に移動・コピー・削除できます</p>
            <button class="how-to-use-btn" id="howToUseBtn" data-i18n="howToUseBtn">❓ How to use</button>
        </div>

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
                    <p style="margin-bottom: 15px; color: #666; font-size: 1.1rem;" data-i18n="dragDropText">📎 PDFファイルをドラッグ＆ドロップ</p>
                    <button class="upload-btn" onclick="document.getElementById('fileInput1').click()" data-i18n="selectFile">
                        ファイルを選択
                    </button>
                    <input type="file" id="fileInput1" accept=".pdf">
                </div>
                <div class="pages-container" id="pagesContainer1"></div>
                <div class="download-area">
                    <button class="download-btn" id="downloadBtn1" disabled data-i18n="downloadLeft">
                        💾 左側のPDFをダウンロード
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
                    <p style="margin-bottom: 15px; color: #666; font-size: 1.1rem;" data-i18n="dragDropText">📎 PDFファイルをドラッグ＆ドロップ</p>
                    <button class="upload-btn" onclick="document.getElementById('fileInput2').click()" data-i18n="selectFile">
                        ファイルを選択
                    </button>
                    <input type="file" id="fileInput2" accept=".pdf">
                </div>
                <div class="pages-container" id="pagesContainer2"></div>
                <div class="download-area">
                    <button class="download-btn" id="downloadBtn2" disabled data-i18n="downloadRight">
                        💾 右側のPDFをダウンロード
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 拡大表示モーダル -->
    <div class="modal-overlay" id="modalOverlay">
        <button class="modal-close" id="modalClose">✕</button>
        <div class="modal-content">
            <div class="modal-page-info" id="modalInfo"></div>
            <div class="modal-canvas-wrapper">
                <canvas id="modalCanvas"></canvas>
            </div>
        </div>
    </div>

    <!-- コンテキストメニュー -->
    <div class="context-menu" id="contextMenu">
        <div class="context-menu-item delete" id="deleteMenuItem" data-i18n="deletePage">🗑️ ページを削除</div>
    </div>

    <!-- ステータスメッセージ -->
    <div class="status-message" id="statusMessage"></div>

    <!-- プログレスバー -->
    <div class="progress-overlay" id="progressOverlay">
        <div class="progress-container">
            <div class="progress-title" id="progressTitle" data-i18n="generatingPdf">PDFを生成中...</div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar" id="progressBar">
                    <div class="progress-bar-fill" id="progressBarFill"></div>
                </div>
                <div class="progress-text" id="progressText">0%</div>
            </div>
            <div class="progress-details" id="progressDetails">0 / 0 <span data-i18n="pages">ページ</span></div>
            <!-- キャンセルボタン -->
            <!-- ユーザーが処理を中止したい場合にクリックするボタン -->
            <!-- ESCキーを押しても同じ動作をします -->
            <button class="progress-cancel-btn" id="progressCancelBtn" data-i18n="cancelProgress">
                ✕ キャンセル (ESC)
            </button>
        </div>
    </div>

    <!-- 使用方法モーダル -->
    <div class="how-to-use-overlay" id="howToUseOverlay">
        <div class="how-to-use-modal">
            <button class="how-to-use-close" id="howToUseClose">✕</button>
            <h2 class="how-to-use-title" data-i18n="usageTitle">使用方法</h2>
            <div class="how-to-use-content">
                <section class="how-to-section">
                    <h3 data-i18n="loadPdfTitle">📥 PDFファイルの読み込み</h3>
                    <ul>
                        <li data-i18n="loadPdfMethod1"><strong>方法1:</strong> 「ファイルを選択」ボタンをクリックしてPDFを選択</li>
                        <li data-i18n="loadPdfMethod2"><strong>方法2:</strong> PDFファイルをアップロードエリアにドラッグ＆ドロップ</li>
                        <li data-i18n="loadPdfNote">左側と右側のパネルに、それぞれ異なるPDFを読み込めます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="movePageTitle">🔄 ページの移動</h3>
                    <ul>
                        <li data-i18n="movePageDesc1">同じPDF内でページを並べ替えるには、ページサムネイルをドラッグして目的の位置にドロップ</li>
                        <li data-i18n="movePageDesc2">プレビューラインが挿入位置を示します</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="copyPageTitle">📋 ページのコピー</h3>
                    <ul>
                        <li data-i18n="copyPageDesc1">一方のパネルから他方のパネルにページをドラッグ＆ドロップ</li>
                        <li data-i18n="copyPageDesc2">元のページはソースPDFに残り、コピーが宛先PDFに追加されます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="deletePageTitle">🗑️ ページの削除</h3>
                    <ul>
                        <li data-i18n="deletePageDesc1">削除したいページサムネイルを右クリック</li>
                        <li data-i18n="deletePageDesc2">コンテキストメニューから「🗑️ ページを削除」を選択</li>
                        <li data-i18n="deletePageNote"><strong>注意:</strong> PDFには最低1ページが必要です</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="zoomPageTitle">🔍 ページの拡大表示</h3>
                    <ul>
                        <li data-i18n="zoomPageDesc1">任意のページサムネイルをクリック</li>
                        <li data-i18n="zoomPageDesc2">モーダルウィンドウでページが拡大表示されます</li>
                        <li data-i18n="zoomPageDesc3">✕ボタンまたはモーダルの外側をクリックして閉じます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="downloadPdfTitle">💾 編集済みPDFのダウンロード</h3>
                    <ul>
                        <li data-i18n="downloadPdfDesc1">各パネル下部の「💾 左側のPDFをダウンロード」または「💾 右側のPDFをダウンロード」ボタンをクリック</li>
                        <li data-i18n="downloadPdfDesc2">進捗バーで生成状況を確認できます</li>
                        <li data-i18n="downloadPdfDesc3">ESCキーまたは「✕ キャンセル」ボタンで操作をキャンセルできます</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="keyboardShortcutTitle">⚡ キーボードショートカット</h3>
                    <ul>
                        <li data-i18n="keyboardShortcutEsc"><strong>ESC:</strong> PDF生成のキャンセル、またはモーダルウィンドウを閉じる</li>
                        <li data-i18n="keyboardShortcutRightClick"><strong>右クリック:</strong> ページサムネイルのコンテキストメニューを開く</li>
                    </ul>
                </section>

                <section class="how-to-section">
                    <h3 data-i18n="securityTitle">🔒 セキュリティ</h3>
                    <ul>
                        <li data-i18n="securityDesc1">全ての処理はWebブラウザ内で完結します</li>
                        <li data-i18n="securityDesc2">PDFファイルがサーバに送信されることはありません</li>
                    </ul>
                </section>
            </div>
        </div>
    </div>

    <!-- 外部JavaScriptファイル -->
    <script src="<?php echo htmlspecialchars(JS_PATH); ?>"></script>
    
    <?php if (ENABLE_DEBUG): ?>
    <!-- デバッグモード -->
    <script>
        console.log('Debug mode enabled');
        console.log('App version: <?php echo APP_VERSION; ?>');
    </script>
    <?php endif; ?>
</body>
</html>
