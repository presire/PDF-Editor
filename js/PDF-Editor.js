// PDF.jsの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';

// グローバル変数
const pdfDocuments = [null, null];      // 2つのPDFドキュメントを保持
let draggedElement = null;
let draggedOriginalIndex = -1;          // ドラッグ開始時の元の位置を記録
let draggedOriginalContainer = null;    // ドラッグ開始時の元のコンテナを記録
let draggedIsCopied = false;            // ドラッグしているページがコピーされたものかどうか
let contextMenuTarget = null;
let activeDropZones = [];               // アクティブなドロップゾーンを追跡

// PDF生成のキャンセルフラグ
// この変数がtrueになると、PDF生成処理が中断されます
// まるで信号機のように、「進め（false）」か「止まれ（true）」かを示す役割を持ちます
let pdfGenerationCancelled = false;

// PDF読み込みのキャンセルフラグ（左右のPDF用）
let pdfLoadingCancelled = [false, false];

// ステータスメッセージを表示
function showStatus(message, type = 'info', duration = 3000) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type} show`;

    if (duration > 0) {
        setTimeout(() => {
            statusDiv.classList.remove('show');
        }, duration);
    }
}

// PDFラベルを更新する関数
// pdfNumber: 1または2（左側または右側）
// fileName: 表示するファイル名
function updatePdfLabel(pdfNumber, fileName) {
    const label = document.getElementById(`pdfLabel${pdfNumber}`);
    if (label) {
        const icon = label.querySelector('.pdf-icon');
        const iconText = icon ? icon.textContent : (pdfNumber === 1 ? 'L' : 'R');

        // ファイル名が長い場合は省略表示
        const maxLength = 30;
        let displayName = fileName;
        if (fileName.length > maxLength) {
            displayName = fileName.substring(0, maxLength - 3) + '...';
        }

        // ラベルのHTMLを更新（アイコンとファイル名）
        label.innerHTML = `
            <div class="pdf-icon">${iconText}</div>
            ${displayName}
        `;
    }
}

// プログレスバーを表示する関数
// PDF生成処理の開始時に呼び出されます
// title: プログレスバーに表示するタイトル（例：「左側のPDFを生成中...」）
// total: 処理する必要がある全体のページ数
function showProgress(title, total) {
    const overlay = document.getElementById('progressOverlay');
    const titleElement = document.getElementById('progressTitle');
    const barFill = document.getElementById('progressBarFill');
    const text = document.getElementById('progressText');
    const details = document.getElementById('progressDetails');

    // キャンセルフラグを初期化（falseにリセット）
    // 新しい処理を開始するときは、必ず「キャンセルされていない」状態から始める必要があります
    // これは、まるで新しい旅を始めるときに、前回の旅の記録をリセットするようなものです
    pdfGenerationCancelled = false;

    // プログレスバーの初期状態を設定
    titleElement.textContent = title; // タイトルを設定
    barFill.style.width = '0%'; // バーの幅を0%に初期化
    text.textContent = '0%'; // パーセンテージ表示を0%に初期化
    details.innerHTML = `0 / ${total} <span data-i18n="pages">${getTranslation('pages')}</span>`; // 「0 / 10 ページ」のような形式で表示

    // オーバーレイを表示（画面全体を薄暗くして、プログレスバーを前面に出す）
    overlay.classList.add('show');

    // キャンセルボタンのクリックイベントを設定
    // ユーザーがキャンセルボタンをクリックしたときの処理を定義します
    const cancelBtn = document.getElementById('progressCancelBtn');
    // 古いイベントリスナーを削除してから新しいものを追加
    // これは、同じボタンに何度もイベントが登録されてしまうのを防ぐためです
    cancelBtn.onclick = cancelProgress;

    // ESCキーのイベントリスナーを設定
    // キーボードのESCキーが押されたときにも、キャンセル処理を実行します
    // これは、マウスを使わずにキーボードだけで操作したいユーザーのための配慮です
    document.addEventListener('keydown', handleEscapeKey);
}

// プログレスバーの進捗状況を更新する関数
// ページを1つ処理するたびに呼び出されます
// current: 現在処理が完了したページ数
// total: 処理する必要がある全体のページ数
function updateProgress(current, total) {
    const barFill = document.getElementById('progressBarFill');
    const text = document.getElementById('progressText');
    const details = document.getElementById('progressDetails');

    // 進捗率を計算（例：3ページ完了 / 全10ページ = 30%）
    const percentage = Math.round((current / total) * 100);

    // プログレスバーの各要素を更新
    barFill.style.width = `${percentage}%`; // バーの幅を更新（例：30%）
    text.textContent = `${percentage}%`; // パーセンテージ表示を更新
    details.innerHTML = `${current} / ${total} <span data-i18n="pages">${getTranslation('pages')}</span>`; // 「3 / 10 ページ」のように更新
}

// プログレスバーを非表示にする関数
// PDF生成処理が完全に終了した時、またはエラーが発生した時に呼び出されます
function hideProgress() {
    const overlay = document.getElementById('progressOverlay');

    // ESCキーのイベントリスナーを削除
    // プログレスバーが表示されていないときにESCキーを押しても、
    // キャンセル処理が実行されないようにするための重要な処理です
    // これは、まるでテレビを消したときにリモコンの電池を抜くようなものです
    document.removeEventListener('keydown', handleEscapeKey);

    // キャンセルボタンの状態を初期化（次回のPDF生成のために）
    // この処理を忘れると、一度キャンセルした後、次回の生成時に
    // ボタンが「キャンセル中...」のまま無効化されてしまいます
    const cancelBtn = document.getElementById('progressCancelBtn');
    const titleElement = document.getElementById('progressTitle');

    cancelBtn.disabled = false; // ボタンを有効化
    cancelBtn.textContent = getTranslation('cancelProgress'); // テキストを元に戻す
    cancelBtn.style.opacity = '1'; // 透明度を元に戻す
    titleElement.style.color = ''; // タイトルの色をリセット

    // 少し遅延を入れてから非表示にすることで、100%完了が一瞬見えるようにする
    // これにより、ユーザーは「処理が完全に終わった」という達成感を得られます
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 500); // 0.5秒後に非表示
}

// PDF生成をキャンセルする関数
// キャンセルボタンがクリックされたとき、またはESCキーが押されたときに呼び出されます
function cancelProgress() {
    // キャンセルフラグをtrueに設定
    // この変数がtrueになると、PDF生成処理のループがこれをチェックして、
    // 次のページの処理を始めずに中断します
    pdfGenerationCancelled = true;

    // プログレスバーのタイトルを変更して、キャンセル中であることを視覚的に示す
    const titleElement = document.getElementById('progressTitle');
    titleElement.textContent = getTranslation('cancelling');
    titleElement.style.color = '#e74c3c'; // タイトルの色を赤に変更

    // キャンセルボタンを無効化して、二重にキャンセルされることを防ぐ
    const cancelBtn = document.getElementById('progressCancelBtn');
    cancelBtn.disabled = true; // ボタンを無効化
    cancelBtn.textContent = getTranslation('cancelling'); // ボタンのテキストを変更
    cancelBtn.style.opacity = '0.6'; // ボタンを半透明にして、無効化されていることを示す
}

// ESCキーが押されたときの処理
// この関数は、キーボードのどれかのキーが押されたときに毎回呼び出されます
// その中で、押されたキーがESCキーかどうかを判定します
function handleEscapeKey(event) {
    // event.keyが'Escape'または event.keyCodeが27の場合、ESCキーが押されたと判定
    // 異なるブラウザやキーボードの配列に対応するために、両方をチェックします
    if (event.key === 'Escape' || event.keyCode === 27) {
        // プログレスバーが表示されているかどうかを確認
        const overlay = document.getElementById('progressOverlay');
        if (overlay.classList.contains('show')) {
            // プログレスバーが表示されている場合のみ、キャンセル処理を実行
            // これは、プログレスバーが表示されていないときにESCキーを押しても、
            // 何も起こらないようにするための安全装置です
            cancelProgress();
        }
    }
}

// ファイルアップロード処理
for (let i = 1; i <= 2; i++) {
    const fileInput = document.getElementById(`fileInput${i}`);
    const uploadArea = document.getElementById(`uploadArea${i}`);
    const pagesContainer = document.getElementById(`pagesContainer${i}`);
    const downloadBtn = document.getElementById(`downloadBtn${i}`);
    const loadingCancelBtn = document.getElementById(`loadingCancelBtn${i}`);

    // 「ファイルを選択」ボタン → file input を開く（CSP厳格化のため inline onclick から移行）
    const uploadBtn = uploadArea.querySelector('.upload-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => fileInput.click());
    }

    // ファイル選択
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadPDF(file, i);
        }
    });

    // ドラッグ＆ドロップ
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            loadPDF(file, i);
        }
    });

    // 読み込みキャンセルボタンのイベントリスナー
    loadingCancelBtn.addEventListener('click', () => {
        pdfLoadingCancelled[i - 1] = true;
    });

    // ページコンテナにドラッグイベントを追加
    pagesContainer.addEventListener('dragover', handleDragOver);
    pagesContainer.addEventListener('drop', handleDrop);
}

// PDFを読み込む（qpdf対応版）
// この関数は、PDFファイルを読み込む際に、パスワード保護されているかを
// 自動的に検出し、必要に応じてqpdfでパスワードを完全に解除します
async function loadPDF(file, pdfNumber, password = null) {
    const loadingAlert = document.getElementById(`loadingAlert${pdfNumber}`);
    const loadingMessage = loadingAlert.querySelector('.loading-message');

    try {
        const sideLabel = pdfNumber === 1 ? getTranslation('left') : getTranslation('right');

        // キャンセルフラグをリセット
        // ユーザーが以前に読み込みをキャンセルしていた場合、
        // その状態をリセットして新しい読み込みを開始します
        pdfLoadingCancelled[pdfNumber - 1] = false;

        // 読み込み中アラートを表示
        // ユーザーに「今PDFを読み込んでいます」と視覚的にお知らせします
        loadingAlert.classList.add('show');
        loadingMessage.textContent = getTranslation('loading');

        // PDFファイルをArrayBuffer形式で読み込む
        // ArrayBufferは、バイナリデータ（0と1の羅列）を扱うための
        // JavaScriptの基本的なデータ構造です
        const arrayBuffer = await file.arrayBuffer();

        // === ステップ1: パスワード保護のチェック ===
        // まず、このPDFがパスワードで保護されているか確認します
        // これは、まるで家のドアが施錠されているかチェックするようなものです
        let fileToLoad = file;
        let needsDecryption = false;
        
        try {
            // PDF.jsを使って、パスワードなしで読み込みを試みる
            const checkTask = pdfjsLib.getDocument({ data: arrayBuffer });
            await checkTask.promise;
            
            // ここに到達した = パスワード保護されていない
            console.log('✅ このPDFはパスワード保護されていません');
            
        } catch (error) {
            // エラーが発生した場合、その種類を確認
            if (error.name === 'PasswordException') {
                // パスワードが必要なPDFであることが判明
                console.log('🔒 このPDFはパスワードで保護されています');
                needsDecryption = true;
                
                // === ステップ2: パスワードの取得 ===
                // ユーザーにパスワードを入力してもらいます
                let enteredPassword = password;
                
                // passwordパラメータがない場合は、ダイアログで入力を求める
                if (!enteredPassword) {
                    // 読み込み中アラートを一時的に非表示
                    // パスワードダイアログを表示する際、読み込み中表示は邪魔になるため
                    loadingAlert.classList.remove('show');
                    
                    // パスワード入力ダイアログを表示
                    enteredPassword = await showPasswordDialog(false);
                    
                    // ユーザーがキャンセルした場合
                    if (!enteredPassword) {
                        console.log('ℹ️ ユーザーがパスワード入力をキャンセルしました');
                        return;  // 処理を中断
                    }
                    
                    // 読み込み中アラートを再表示
                    loadingAlert.classList.add('show');
                }
                
                // === ステップ3: qpdfでパスワードを解除 ===
                // サーバーにPDFとパスワードを送信し、パスワード保護を解除します
                // この処理は、まるで鍵を使って南京錠を永久に取り外すようなものです
                loadingMessage.textContent = currentLanguage === 'ja' 
                    ? 'パスワードを解除中...' 
                    : 'Decrypting password...';
                
                try {
                    // qpdfによるパスワード解除を実行
                    const decryptedFile = await decryptPDFWithQpdf(file, enteredPassword);
                    
                    // 解除されたPDFを使用
                    fileToLoad = decryptedFile;
                    console.log('✅ qpdfでパスワード解除に成功しました');
                    
                } catch (decryptError) {
                    // パスワードが間違っている、またはその他のエラー
                    console.error('❌ qpdfでのパスワード解除に失敗:', decryptError);
                    
                    // 読み込み中アラートを非表示
                    loadingAlert.classList.remove('show');
                    
                    // パスワードエラーの場合は、再試行を提案
                    if (decryptError.message && decryptError.message.includes('password')) {
                        // パスワードが間違っている可能性が高い
                        const retry = await showPasswordDialog(true);
                        if (retry) {
                            // リトライ - 新しいパスワードで再度この関数を呼び出す
                            return loadPDF(file, pdfNumber, retry);
                        }
                    } else {
                        // その他のエラー（サーバーエラーなど）
                        showStatus(
                            currentLanguage === 'ja' 
                                ? `パスワード解除に失敗しました: ${decryptError.message}` 
                                : `Failed to decrypt: ${decryptError.message}`,
                            'error',
                            5000
                        );
                    }
                    return;  // 処理を中断
                }
                
            } else {
                // PasswordException以外のエラー（PDF破損など）
                throw error;
            }
        }

        // === ステップ4: PDFの読み込み ===
        // ここまで来たら、fileToLoadには以下のいずれかが入っています：
        // - 元々パスワード保護されていなかったPDF
        // - qpdfでパスワードが解除されたPDF
        // いずれの場合も、パスワードなしで読み込めるPDFです
        
        loadingMessage.textContent = getTranslation('loading');
        
        // PDFファイルを再度ArrayBuffer形式で読み込む
        const finalArrayBuffer = await fileToLoad.arrayBuffer();
        
        // PDFドキュメントを読み込む（パスワードは不要）
        const loadingTask = pdfjsLib.getDocument({
            data: finalArrayBuffer
            // パスワードパラメータは指定しない
        });

        let pdf;
        try {
            pdf = await loadingTask.promise;
            console.log('✅ PDFの読み込みに成功しました');
        } catch (error) {
            // ここでエラーが発生することは稀ですが、念のため処理
            console.error('❌ PDFの読み込みに失敗:', error);
            throw error;
        }

        // === ステップ5: PDFデータの保存 ===
        // 読み込んだPDFの情報をグローバル変数に保存します
        // これにより、後でページを編集したり、PDFをダウンロードしたりできます
        pdfDocuments[pdfNumber - 1] = {
            pdf: pdf,
            file: fileToLoad,  // パスワード解除後のファイルを保存
            password: null,     // パスワードは既に解除されているのでnull
            decryptedData: null // このフィールドは不要（qpdfで既に解除済み）
        };

        // === ステップ6: ページの表示 ===
        // PDFの各ページをサムネイル画像として画面に表示します
        const container = document.getElementById(`pagesContainer${pdfNumber}`);
        container.innerHTML = '';  // 古い内容をクリア

        // ページを1つずつ読み込みながら、進捗を表示
        // 大きなPDFの場合、この処理には時間がかかることがあります
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            // キャンセルチェック
            // ユーザーが「キャンセル」ボタンを押した場合、処理を中断します
            if (pdfLoadingCancelled[pdfNumber - 1]) {
                loadingAlert.classList.remove('show');
                showStatus(
                    currentLanguage === 'ja' 
                        ? `PDFの読み込みをキャンセルしました (${sideLabel})` 
                        : `PDF loading cancelled (${sideLabel})`,
                    'info',
                    3000
                );
                // コンテナをクリア
                container.innerHTML = '';
                pdfDocuments[pdfNumber - 1] = null;
                return;
            }

            // ページを取得してサムネイルを作成
            const page = await pdf.getPage(pageNum);
            const pageItem = await createPageItem(pdf, pdfNumber, pageNum, page);
            container.appendChild(pageItem);

            // 進捗状況を更新
            // 「3 / 10 ページ読み込み中」のような表示になります
            loadingMessage.textContent = `${getTranslation('loading')} ${pageNum} / ${pdf.numPages} ${getTranslation('pages')}`;
        }

        // === ステップ7: 完了処理 ===
        // 読み込みが無事完了したので、後片付けと完了通知を行います
        
        // 読み込み中アラートを非表示
        loadingAlert.classList.remove('show');

        // ダウンロードボタンを有効化
        // PDFが読み込まれたので、ダウンロードボタンが使えるようになります
        document.getElementById(`downloadBtn${pdfNumber}`).disabled = false;

        // PDFラベルをファイル名に更新
        // 画面上部のラベルに、読み込んだPDFのファイル名を表示します
        updatePdfLabel(pdfNumber, fileToLoad.name);

        // 完了メッセージを表示（3秒後に自動的に消える）
        const successMessage = currentLanguage === 'ja' 
            ? `PDFを読み込みました (${pdf.numPages}ページ) - ${sideLabel}`
            : `PDF loaded (${pdf.numPages} pages) - ${sideLabel}`;
        
        // パスワード解除された場合は、その旨も追記
        if (needsDecryption) {
            const decryptNote = currentLanguage === 'ja' 
                ? ' (パスワード解除済み)' 
                : ' (Password removed)';
            showStatus(successMessage + decryptNote, 'success', 3000);
        } else {
            showStatus(successMessage, 'success', 3000);
        }

        // DynamoDBにアップロード情報を記録
        // この行は元のコードから引き継いでいます
        savePDFLogToDynamoDB(fileToLoad.name, pdfNumber, pdf.numPages);
        
    } catch (error) {
        // 予期しないエラーが発生した場合の処理
        // 読み込み中アラートを非表示
        loadingAlert.classList.remove('show');

        // キャンセルによるエラーでない場合のみエラーメッセージを表示
        // ユーザーが意図的にキャンセルした場合は、エラーメッセージは不要です
        if (!pdfLoadingCancelled[pdfNumber - 1]) {
            const sideLabel = pdfNumber === 1 ? getTranslation('left') : getTranslation('right');
            showStatus(
                currentLanguage === 'ja' 
                    ? `PDFの読み込みに失敗しました (${sideLabel})` 
                    : `Failed to load PDF (${sideLabel})`,
                'error',
                3000
            );
            console.error('❌ PDF読み込みエラー:', error);
        }
    }
}

// パスワード入力ダイアログを表示
function showPasswordDialog(isRetry = false) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('passwordOverlay');
        const input = document.getElementById('passwordInput');
        const errorDiv = document.getElementById('passwordError');
        const okBtn = document.getElementById('passwordOkBtn');
        const cancelBtn = document.getElementById('passwordCancelBtn');

        // エラーメッセージを表示
        if (isRetry) {
            errorDiv.textContent = currentLanguage === 'ja'
                ? '❌ パスワードが正しくありません。もう一度入力してください。'
                : '❌ Incorrect password. Please try again.';
        } else {
            errorDiv.textContent = '';
        }

        // 入力欄をクリア
        input.value = '';

        // モーダルを表示
        overlay.classList.add('show');
        input.focus();

        // OKボタンのクリックイベント
        const handleOk = () => {
            const password = input.value;
            overlay.classList.remove('show');
            cleanup();
            resolve(password);
        };

        // キャンセルボタンのクリックイベント
        const handleCancel = () => {
            overlay.classList.remove('show');
            cleanup();
            resolve(null);
        };

        // Enterキーでも送信
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                handleOk();
            }
        };

        // イベントリスナーのクリーンアップ
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keypress', handleEnter);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keypress', handleEnter);
    });
}

// ページアイテムを作成
async function createPageItem(pdf, pdfNumber, pageNum, page) {
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.draggable = true;
    pageItem.dataset.originalPdfNumber = pdfNumber;
    pageItem.dataset.originalPageNumber = pageNum;
    pageItem.dataset.currentContainer = pdfNumber; // 現在どのコンテナにあるか

    const canvasWrapper = document.createElement('div');
    canvas.className = 'page-canvas';
    canvasWrapper.appendChild(canvas);

    const pageNumberDiv = document.createElement('div');
    pageNumberDiv.className = 'page-number';
    const sideLabel = pdfNumber === 1 ? (currentLanguage === 'ja' ? '左' : 'L') : (currentLanguage === 'ja' ? '右' : 'R');
    const sideText = currentLanguage === 'ja' ? '側' : '';
    pageNumberDiv.textContent = `${sideLabel}${sideText} - P.${pageNum}`;
    pageNumberDiv.dataset.pdfNumber = pdfNumber; // PDF番号を保存（言語切り替え用）
    pageNumberDiv.dataset.pageNum = pageNum; // ページ番号を保存（言語切り替え用）

    pageItem.appendChild(canvasWrapper);
    pageItem.appendChild(pageNumberDiv);

    // ドラッグイベント
    pageItem.addEventListener('dragstart', handleDragStart);
    pageItem.addEventListener('dragend', handleDragEnd);

    // 左クリックで拡大表示
    pageItem.addEventListener('click', (e) => {
        // 右クリックの場合はコンテキストメニューを優先
        if (e.button !== 0) return;
        showPageModal(pdfNumber, pageNum, page);
    });

    // 右クリックメニュー
    pageItem.addEventListener('contextmenu', handleContextMenu);

    return pageItem;
}

// ページの拡大表示
async function showPageModal(pdfNumber, pageNum, page) {
    const modal = document.getElementById('modalOverlay');
    const modalInfo = document.getElementById('modalInfo');
    const modalCanvas = document.getElementById('modalCanvas');

    // ページ情報を表示
    const sideLabel = pdfNumber === 1 ? (currentLanguage === 'ja' ? '左側のPDF' : 'Left PDF') : (currentLanguage === 'ja' ? '右側のPDF' : 'Right PDF');
    modalInfo.textContent = `${sideLabel} - ${getTranslation('page')} ${pageNum}`;

    // 高解像度でレンダリング（スケール2倍）
    const viewport = page.getViewport({ scale: 2 });
    modalCanvas.width = viewport.width;
    modalCanvas.height = viewport.height;

    const context = modalCanvas.getContext('2d');
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // モーダルを表示
    modal.classList.add('show');
}

// モーダルを閉じる
document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('modalOverlay').classList.remove('show');
});

// モーダルの背景をクリックしても閉じる
document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
        document.getElementById('modalOverlay').classList.remove('show');
    }
});

// ドロップゾーンを作成（マウス位置に応じて1つだけ動的に移動）
let currentDropZone = null;
let currentDropContainer = null;
let dropZonePosition = null;

function createSingleDropZone(container) {
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.textContent = 'ここにドロップ';
    return dropZone;
}

// マウス位置に応じてドロップゾーンを移動
function updateDropZonePosition(e, container) {
    // ★★★ コピー済みページの元のPDFへの戻し防止 ★★★
    if (draggedIsCopied && draggedElement) {
        const targetPdfNum = container.id.includes('1') ? 1 : 2;
        const originalPdfNum = parseInt(draggedElement.dataset.originalPdfNumber);

        // コピーされたページを元のPDFに戻そうとしている場合は拒否
        if (targetPdfNum === originalPdfNum) {
            // ドロップゾーンがあれば削除
            if (currentDropZone && currentDropZone.parentElement) {
                currentDropZone.remove();
                currentDropZone = null;
                currentDropContainer = null;
                dropZonePosition = null;
            }
            return;
        }
    }

    // マウスの座標を取得
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // コンテナ内のすべてのページアイテムを取得
    const allPageItems = Array.from(container.querySelectorAll('.page-item'));

    if (allPageItems.length === 0) {
        // ページがない場合は、コンテナの最初に配置
        if (!currentDropZone || currentDropZone.parentElement !== container) {
            if (currentDropZone && currentDropZone.parentElement) {
                currentDropZone.remove();
            }
            currentDropZone = createSingleDropZone(container);
            container.appendChild(currentDropZone);
            currentDropContainer = container;
            dropZonePosition = { container, index: 0 };
        }
        return;
    }

    // 同一コンテナかどうかを判定
    const isSameContainer = draggedElement && draggedElement.parentElement === container;

    // 判定に使用するページ配列を決定
    // 同一コンテナの場合はdraggedElementを除外した配列を使用
    const pageItems = isSameContainer
        ? allPageItems.filter(item => item !== draggedElement)
        : allPageItems;

    // draggedElementの元の位置を記録（同一コンテナの場合のみ）
    let draggedOriginalIndex = -1;
    if (isSameContainer) {
        draggedOriginalIndex = allPageItems.indexOf(draggedElement);
    }

    if (pageItems.length === 0) {
        // draggedElement以外にページがない場合（唯一のページをドラッグしている場合）
        // ドロップゾーンを非表示
        if (currentDropZone && currentDropZone.parentElement) {
            currentDropZone.classList.remove('highlight');
        }
        return;
    }

    // どのページの位置にドロップするかを判定
    let targetIndex = null;
    let foundPosition = false;

    // 各ページをチェックして、マウスの位置を判定
    for (let i = 0; i < pageItems.length; i++) {
        const pageRect = pageItems[i].getBoundingClientRect();
        const pageX = pageRect.left - rect.left;
        const pageY = pageRect.top - rect.top;
        const pageWidth = pageRect.width;
        const pageHeight = pageRect.height;

        // マウスがこのページの領域内にあるかチェック
        if (mouseX >= pageX && mouseX <= pageX + pageWidth &&
            mouseY >= pageY && mouseY <= pageY + pageHeight) {

            // ページの端から20%の範囲でのみドロップ位置を判定（バタつき防止）
            const relativePosX = mouseX - pageX;
            const leftThreshold = pageWidth * 0.2;  // 左端20%
            const rightThreshold = pageWidth * 0.8; // 右端20%

            if (relativePosX < leftThreshold) {
                // 左端20%の範囲：このページの前に挿入
                targetIndex = i;
                foundPosition = true;
            } else if (relativePosX > rightThreshold) {
                // 右端20%の範囲：このページの後に挿入
                targetIndex = i + 1;
                foundPosition = true;
            } else {
                // 中央60%の範囲：現在のドロップゾーン位置を維持（バタつき防止）
                if (dropZonePosition && dropZonePosition.container === container) {
                    targetIndex = dropZonePosition.index;
                    foundPosition = true;
                }
            }
            break;
        }
    }

    // ページの外側（コンテナの空白部分）をチェック
    if (!foundPosition) {
        // 最初のページよりも前（先頭）
        // 判定を右寄りに拡張：最初のページ（draggedElementを除く）の左端から右に30%までの範囲も先頭判定とする
        const firstPageRect = pageItems[0].getBoundingClientRect();
        const firstPageX = firstPageRect.left - rect.left;
        const firstPageY = firstPageRect.top - rect.top;
        const firstPageWidth = firstPageRect.width;
        const firstPageThreshold = firstPageX + firstPageWidth * 0.3; // 右に30%拡張

        if (mouseY < firstPageY || (mouseY < firstPageY + firstPageRect.height && mouseX < firstPageThreshold)) {
            targetIndex = 0;
            foundPosition = true;
        }

        // 最後のページよりも後（最後尾）
        // 判定を左寄りに拡張：最後のページ（draggedElementを除く）の右端から左に30%の範囲も最後尾判定とする
        if (!foundPosition) {
            const lastPageRect = pageItems[pageItems.length - 1].getBoundingClientRect();
            const lastPageY = lastPageRect.top - rect.top;
            const lastPageX = lastPageRect.left - rect.left;
            const lastPageWidth = lastPageRect.width;
            const lastPageBottom = lastPageY + lastPageRect.height;
            const lastPageRight = lastPageX + lastPageWidth;
            const lastPageThreshold = lastPageX + lastPageWidth * 0.7; // 左に30%拡張

            if (mouseY > lastPageBottom || (mouseY > lastPageY && mouseX > lastPageThreshold)) {
                targetIndex = pageItems.length;
                foundPosition = true;
            }
        }
    }

    // 位置が決定できなかった場合は、現在の位置を維持
    if (!foundPosition && dropZonePosition && dropZonePosition.container === container) {
        targetIndex = dropZonePosition.index;
    } else if (!foundPosition) {
        // それでも位置が決まらない場合は非表示にする
        if (currentDropZone && currentDropZone.parentElement) {
            currentDropZone.classList.remove('highlight');
        }
        return;
    }

    // 同一コンテナの場合、元の位置と同じかチェック
    if (isSameContainer && targetIndex === draggedOriginalIndex) {
        // 元の位置と同じ場合はドロップゾーンを完全に削除し、dropZonePositionもnullにする
        if (currentDropZone && currentDropZone.parentElement) {
            currentDropZone.remove(); // ドロップゾーン自体を削除
        }
        currentDropZone = null;
        currentDropContainer = null;
        dropZonePosition = null; // これにより、handleDropで処理をスキップする
        return;
    }

    // ドロップゾーンを配置または移動
    if (!currentDropZone || currentDropContainer !== container) {
        // 新しいコンテナに移動した場合、古いドロップゾーンを削除して新しいものを作成
        if (currentDropZone && currentDropZone.parentElement) {
            currentDropZone.remove();
        }
        currentDropZone = createSingleDropZone(container);
        currentDropContainer = container;
    }

    // 正しい位置にドロップゾーンを配置
    // 同一コンテナ内の移動の場合、draggedElementを除外した配列を使用
    const currentPages = isSameContainer
        ? Array.from(container.querySelectorAll('.page-item')).filter(item => item !== draggedElement)
        : Array.from(container.querySelectorAll('.page-item'));

    if (targetIndex >= currentPages.length) {
        container.appendChild(currentDropZone);
    } else {
        container.insertBefore(currentDropZone, currentPages[targetIndex]);
    }

    // ハイライトを追加
    currentDropZone.classList.add('highlight');

    // 現在の位置を保存（元のtargetIndexを保存）
    dropZonePosition = { container, index: targetIndex };
}

// ドラッグ開始
function handleDragStart(e) {
    draggedElement = e.target.closest('.page-item');
    draggedElement.classList.add('dragging');

    // ★★★ ドラッグしているページがコピーされたものかどうかを記録 ★★★
    draggedIsCopied = draggedElement.classList.contains('copied');

    // 元の位置と元のコンテナを記録
    const container = draggedElement.parentElement;
    const allPageItems = Array.from(container.querySelectorAll('.page-item'));
    draggedOriginalIndex = allPageItems.indexOf(draggedElement);
    draggedOriginalContainer = container; // 元のコンテナを記録

    // 初期のドロップゾーンは作成しない（マウスが動いたときに作成）
}

// ドラッグオーバー（ページアイテムとコンテナの両方で処理）
function handleDragOver(e) {
    e.preventDefault();

    // マウスが乗っているコンテナを特定
    let targetContainer = null;
    const container1 = document.getElementById('pagesContainer1');
    const container2 = document.getElementById('pagesContainer2');

    const rect1 = container1.getBoundingClientRect();
    const rect2 = container2.getBoundingClientRect();

    if (e.clientX >= rect1.left && e.clientX <= rect1.right &&
        e.clientY >= rect1.top && e.clientY <= rect1.bottom) {
        targetContainer = container1;
    } else if (e.clientX >= rect2.left && e.clientX <= rect2.right &&
               e.clientY >= rect2.top && e.clientY <= rect2.bottom) {
        targetContainer = container2;
    }

    if (targetContainer) {
        updateDropZonePosition(e, targetContainer);
    }
}

// ドロップ処理
async function handleDrop(e) {
    e.preventDefault();

    if (!dropZonePosition || !draggedElement) {
        return;
    }

    const targetContainer = dropZonePosition.container;
    const targetIndex = dropZonePosition.index;
    const draggedContainer = draggedElement.parentElement;

    // コンテナIDからPDF番号を取得
    const targetContainerId = targetContainer.id;
    const draggedContainerId = draggedContainer.id;
    const targetPdfNum = targetContainerId.includes('1') ? 1 : 2;
    const draggedPdfNum = draggedContainerId.includes('1') ? 1 : 2;

    const originalPdfNum = parseInt(draggedElement.dataset.originalPdfNumber);
    const originalPageNum = parseInt(draggedElement.dataset.originalPageNumber);

    // 同じコンテナ内の移動か、別のコンテナへのコピーかを判定
    const isSameContainer = targetContainer === draggedOriginalContainer;

    if (isSameContainer) {
        // 同じコンテナ内での移動

        // 元の位置と同じ場合は何もしない（キャンセル扱い）
        // targetIndexはdraggedElementを除外した配列でのインデックス
        // draggedOriginalIndexは全要素を含む配列でのインデックス
        if (targetIndex === draggedOriginalIndex) {
            showStatus(currentLanguage === 'ja' ? '元の位置に戻しました（変更なし）' : 'Returned to original position (no change)', 'info', 1500);
            return;
        }

        // ドラッグしたページがコピー済みかどうか
        const isCopiedPage = draggedElement.classList.contains('copied');

        // コピー済みでない場合のみ「移動」マークを付ける（永続表示）
        // ※元の位置に戻った場合は後続の checkAndUpdateMovedMarkers で自動的に外れる
        if (!isCopiedPage) {
            draggedElement.classList.add('moved');
        }

        // draggedElementを除外したページ配列を取得
        const pageItems = Array.from(targetContainer.querySelectorAll('.page-item')).filter(
            item => item !== draggedElement
        );

        // ドロップゾーンの位置に要素を移動
        if (targetIndex >= pageItems.length) {
            targetContainer.appendChild(draggedElement);
        } else {
            targetContainer.insertBefore(draggedElement, pageItems[targetIndex]);
        }

        // 元の位置に戻ったページから「移動」マークを除去
        checkAndUpdateMovedMarkers(targetContainer);

        showStatus(getTranslation('pageMoved'), 'success', 2000);
    } else {
        // 別のコンテナへのコピー

        // ★★★ コピー済みページの元のPDFへの戻し防止（念のための二重チェック） ★★★
        if (draggedElement.classList.contains('copied') && targetPdfNum === originalPdfNum) {
            showStatus(currentLanguage === 'ja' ? 'コピーされたページを元のPDFに戻すことはできません' : 'Cannot return copied page to original PDF', 'error', 3000);
            return;
        }

        const sourcePdfData = pdfDocuments[originalPdfNum - 1];
        if (sourcePdfData) {
            const page = await sourcePdfData.pdf.getPage(originalPageNum);
            const newPageItem = await createPageItem(
                sourcePdfData.pdf,
                originalPdfNum,
                originalPageNum,
                page
            );

            // コピーされたページであることを示すクラスを追加
            newPageItem.classList.add('copied');
            newPageItem.dataset.currentContainer = targetPdfNum;

            // ドロップゾーンの位置に挿入
            const pageItems = Array.from(targetContainer.querySelectorAll('.page-item'));
            if (targetIndex >= pageItems.length) {
                targetContainer.appendChild(newPageItem);
            } else {
                targetContainer.insertBefore(newPageItem, pageItems[targetIndex]);
            }

            // コピー挿入で位置がずれた他ページの「移動」マーカーを更新
            checkAndUpdateMovedMarkers(targetContainer);

            showStatus(getTranslation('pageCopied'), 'success', 2000);
        }
    }
}

// コンテナ内のページのうち、元の位置（読み込み時の位置）に戻ったものから
// 「移動」マークを除去する。マークの「付与」はドラッグ操作時のみ行うため、ここでは行わない。
//
// ※判定は「同じPDF由来のページ（=このペインに元から属するページ）」だけを対象にした
//   相対インデックスで行う。別ペインから挿入された .copied ページは絶対位置をずらすため、
//   絶対インデックスで判定すると「移動」マークの誤消去が起きる。
function checkAndUpdateMovedMarkers(container) {
    const pageItems = Array.from(container.querySelectorAll('.page-item'));
    const containerPdfNum = container.id.includes('1') ? 1 : 2;

    // 同じPDFから読み込まれたページのみを対象に、相対インデックスで位置判定する
    const ownPages = pageItems.filter(item => !item.classList.contains('copied'));

    ownPages.forEach((pageItem, ownIndex) => {
        const originalPageNum = parseInt(pageItem.dataset.originalPageNumber);
        const originalPdfNum  = parseInt(pageItem.dataset.originalPdfNumber);

        const isAtOriginalPosition =
            originalPdfNum === containerPdfNum &&
            originalPageNum === ownIndex + 1;

        if (isAtOriginalPosition) {
            pageItem.classList.remove('moved');
        }
    });
}

// ドラッグ終了
function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
        draggedElement = null;
    }

    // 元の位置とコンテナの記録をリセット
    draggedOriginalIndex = -1;
    draggedOriginalContainer = null;
    draggedIsCopied = false; // ★★★ コピー済みフラグもリセット ★★★

    // ドロップゾーンを削除
    if (currentDropZone && currentDropZone.parentElement) {
        currentDropZone.remove();
    }
    currentDropZone = null;
    currentDropContainer = null;
    dropZonePosition = null;
}

// コンテキストメニュー
function handleContextMenu(e) {
    e.preventDefault();

    contextMenuTarget = e.target.closest('.page-item');
    const contextMenu = document.getElementById('contextMenu');

    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.classList.add('show');
}

// コンテキストメニューを閉じる
document.addEventListener('click', () => {
    document.getElementById('contextMenu').classList.remove('show');
});

// ページ削除
document.getElementById('deleteMenuItem').addEventListener('click', () => {
    if (contextMenuTarget) {
        const container = contextMenuTarget.parentElement;
        const pageCount = container.querySelectorAll('.page-item').length;

        if (pageCount > 1) {
            contextMenuTarget.remove();
            // 削除で後続ページの位置がずれるため、移動マーカーを再計算
            checkAndUpdateMovedMarkers(container);
            showStatus(getTranslation('pageDeleted'), 'success', 2000);
        } else {
            showStatus(getTranslation('cannotDeleteLastPage'), 'error', 2000);
        }

        contextMenuTarget = null;
    }
});

// PDFをダウンロード（個別ダウンロード機能）
// 左側のPDFをダウンロード
document.getElementById('downloadBtn1').addEventListener('click', async () => {
    await downloadPDF(1);
});

// 右側のPDFをダウンロード
document.getElementById('downloadBtn2').addEventListener('click', async () => {
    await downloadPDF(2);
});

// 指定したPDFをダウンロードする関数
async function downloadPDF(pdfNumber) {
    try {
        const sideLabel = pdfNumber === 1 ? getTranslation('left') : getTranslation('right');

        // PDFがアップロードされているか確認
        if (!pdfDocuments[pdfNumber - 1]) {
            showStatus(`${sideLabel}${getTranslation('pdfNotUploaded')}`, 'error', 5000);
            return;
        }

        // 指定されたコンテナからページを取得
        const container = document.getElementById(`pagesContainer${pdfNumber}`);
        const pages = container.querySelectorAll('.page-item');

        // ページが存在するか確認
        if (pages.length === 0) {
            showStatus(`${sideLabel}${getTranslation('noPages')}`, 'error');
            return;
        }

        // プログレスバーを表示（処理開始を視覚的に示す）
        showProgress(`${sideLabel}${getTranslation('generating')}`, pages.length);

        // 新しいPDFドキュメントを作成
        const newPdfDoc = await PDFLib.PDFDocument.create();

        // ページを一つずつ処理していくループ
        // このループの中で、各ページをコピーして新しいPDFに追加します
        let processedCount = 0; // 処理が完了したページ数を追跡

        for (const pageElement of pages) {
            // ★★★ キャンセルチェック ★★★
            // ページを処理する前に、ユーザーがキャンセルボタンを押したか、
            // またはESCキーを押したかをチェックします
            // これは、まるで長い道のりを歩いているときに、各交差点で
            // 「まだ進んでいいですか？それとも引き返しますか？」と確認するようなものです
            if (pdfGenerationCancelled) {
                // キャンセルが要求されていた場合、ループを抜けて処理を中断します
                // この時点で、まだ処理していないページは新しいPDFに含まれません
                console.log('PDF生成がユーザーによってキャンセルされました');

                // プログレスバーを非表示にする
                hideProgress();

                // キャンセルされたことをユーザーに通知
                showStatus(`${sideLabel}${getTranslation('cancelled')}`, 'info', 3000);

                // 関数を終了（ダウンロードは実行されません）
                return;
            }

            // 元のPDF番号とページ番号を使用してコピー
            const originalPdfNum = parseInt(pageElement.dataset.originalPdfNumber);
            const originalPageNum = parseInt(pageElement.dataset.originalPageNumber);

            // 元のPDFドキュメントを取得
            const sourcePdfData = pdfDocuments[originalPdfNum - 1];
            if (sourcePdfData) {
                let pdfDataToLoad;

                // 復号化されたデータがあればそれを使用、なければ元のファイル
                if (sourcePdfData.decryptedData) {
                    console.log('復号化されたデータを使用します');
                    pdfDataToLoad = sourcePdfData.decryptedData;
                } else {
                    pdfDataToLoad = await sourcePdfData.file.arrayBuffer();
                }

                let sourcePdf;
                let useImageFallback = false;

                try {
                    // 復号化されたデータまたは元のデータを読み込む
                    sourcePdf = await PDFLib.PDFDocument.load(pdfDataToLoad);
                    console.log('PDF-libで正常に読み込みました');
                } catch (error) {
                    console.error('PDF-lib読み込みエラー:', error);

                    // 暗号化エラーの場合
                    if (error.message && error.message.includes('encrypted')) {
                        console.log('まだ暗号化されています。画像化にフォールバックします。');
                        useImageFallback = true;
                    } else {
                        throw error;
                    }
                }

                if (useImageFallback) {
                    // 画像化による処理（フォールバック）
                    const page = await sourcePdfData.pdf.getPage(originalPageNum);

                    // 高解像度でレンダリング（スケール2倍）
                    const viewport = page.getViewport({ scale: 2 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;

                    // CanvasをPNG画像として取得
                    const imageDataUrl = canvas.toDataURL('image/png');
                    const imageBytes = await fetch(imageDataUrl).then(res => res.arrayBuffer());

                    // 画像をPDFに埋め込む
                    const pdfImage = await newPdfDoc.embedPng(imageBytes);
                    const pdfPage = newPdfDoc.addPage([viewport.width, viewport.height]);
                    pdfPage.drawImage(pdfImage, {
                        x: 0,
                        y: 0,
                        width: viewport.width,
                        height: viewport.height
                    });
                } else {
                    // 通常のページコピー
                    const [copiedPage] = await newPdfDoc.copyPages(sourcePdf, [originalPageNum - 1]);
                    newPdfDoc.addPage(copiedPage);
                }

                // ページの処理が完了したので、カウントを増やしてプログレスバーを更新
                processedCount++;
                updateProgress(processedCount, pages.length);
            }
        }

        // すべてのページのコピーが完了したので、PDFファイルとして保存
        const pdfBytes = await newPdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // ダウンロード処理を実行
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${sideLabel}_${Date.now()}.pdf`;
        a.click();

        // 使用したURLを解放（メモリリークを防ぐ）
        URL.revokeObjectURL(url);

        // プログレスバーを非表示にする
        hideProgress();

        // 成功メッセージを表示
        showStatus(`${sideLabel}${getTranslation('downloaded')}`, 'success');
    } catch (error) {
        const sideLabel = pdfNumber === 1 ? getTranslation('left') : getTranslation('right');

        // エラーが発生した場合もプログレスバーを非表示にする
        hideProgress();

        // エラーの詳細をユーザーに表示
        const errorMessage = error.message || error.toString();
        showStatus(`${sideLabel}${getTranslation('generationFailed')}${errorMessage}`, 'error', 8000);
        console.error('PDF生成エラーの詳細:', error);
    }
}

// 使用方法モーダルの制御
const howToUseBtn = document.getElementById('howToUseBtn');
const howToUseOverlay = document.getElementById('howToUseOverlay');
const howToUseClose = document.getElementById('howToUseClose');

// [How to use]ボタンをクリックしたときにモーダルを開く
howToUseBtn.addEventListener('click', () => {
    howToUseOverlay.classList.add('show');
});

// 閉じるボタンをクリックしたときにモーダルを閉じる
howToUseClose.addEventListener('click', () => {
    howToUseOverlay.classList.remove('show');
});

// オーバーレイ（背景）をクリックしたときにモーダルを閉じる
howToUseOverlay.addEventListener('click', (e) => {
    if (e.target === howToUseOverlay) {
        howToUseOverlay.classList.remove('show');
    }
});

// ESCキーを押したときに使用方法モーダルを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
        // 使用方法モーダルが表示されている場合
        if (howToUseOverlay.classList.contains('show')) {
            howToUseOverlay.classList.remove('show');
        }
    }
});

// ========================================
// 言語切り替え機能
// ========================================

// 多言語辞書
const translations = {
    ja: {
        title: 'PDF編集ツール',
        subtitle: '2つのPDFを読み込んで、ページを自由に移動・コピー・削除できます',
        howToUseBtn: 'How to use',
        leftPdf: '左側のPDF',
        rightPdf: '右側のPDF',
        loading: '読み込み中...',
        cancelLoading: '読み込みをキャンセル',
        dragDropText: 'PDFファイルをドラッグ＆ドロップ',
        selectFile: 'ファイルを選択',
        downloadLeft: '左側のPDFをダウンロード',
        downloadRight: '右側のPDFをダウンロード',
        deletePage: 'ページを削除',
        generatingPdf: 'PDFを生成中...',
        pages: 'ページ',
        cancelProgress: 'キャンセル (ESC)',
        usageTitle: '使用方法',
        loadPdfTitle: 'PDFファイルの読み込み',
        loadPdfMethod1: '<strong>方法1:</strong> 「ファイルを選択」ボタンをクリックしてPDFを選択',
        loadPdfMethod2: '<strong>方法2:</strong> PDFファイルをアップロードエリアにドラッグ＆ドロップ',
        loadPdfNote: '左側と右側のパネルに、それぞれ異なるPDFを読み込めます',
        movePageTitle: 'ページの移動',
        movePageDesc1: '同じPDF内でページを並べ替えるには、ページサムネイルをドラッグして目的の位置にドロップ',
        movePageDesc2: 'プレビューラインが挿入位置を示します',
        copyPageTitle: 'ページのコピー',
        copyPageDesc1: '一方のパネルから他方のパネルにページをドラッグ＆ドロップ',
        copyPageDesc2: '元のページはソースPDFに残り、コピーが宛先PDFに追加されます',
        deletePageTitle: 'ページの削除',
        deletePageDesc1: '削除したいページサムネイルを右クリック',
        deletePageDesc2: 'コンテキストメニューから「ページを削除」を選択',
        deletePageNote: '<strong>注意:</strong> PDFには最低1ページが必要です',
        zoomPageTitle: 'ページの拡大表示',
        zoomPageDesc1: '任意のページサムネイルをクリック',
        zoomPageDesc2: 'モーダルウィンドウでページが拡大表示されます',
        zoomPageDesc3: '閉じるボタンまたはモーダルの外側をクリックして閉じます',
        downloadPdfTitle: '編集済みPDFのダウンロード',
        downloadPdfDesc1: '各パネル下部の「左側のPDFをダウンロード」または「右側のPDFをダウンロード」ボタンをクリック',
        downloadPdfDesc2: '進捗バーで生成状況を確認できます',
        downloadPdfDesc3: 'ESCキーまたは「キャンセル」ボタンで操作をキャンセルできます',
        keyboardShortcutTitle: 'キーボードショートカット',
        keyboardShortcutEsc: '<strong>ESC:</strong> PDF生成のキャンセル、またはモーダルウィンドウを閉じる',
        keyboardShortcutRightClick: '<strong>右クリック:</strong> ページサムネイルのコンテキストメニューを開く',
        securityTitle: 'セキュリティ',
        securityDesc1: '全ての処理はブラウザ内で完結します',
        securityDesc2: 'PDFファイルがサーバに送信されることはありません',
        // ステータスメッセージ
        pageMoved: 'ページを移動しました',
        pageCopied: 'ページをコピーしました（元のページは残っています）',
        pageDeleted: 'ページを削除しました',
        cannotDeleteLastPage: '最後のページは削除できません',
        pdfNotUploaded: 'のPDFがアップロードされていません。まずPDFをアップロードしてください。',
        noPages: 'のPDFにページがありません',
        generating: 'のPDFを生成中...',
        cancelling: 'キャンセル中...',
        cancelled: 'のPDF生成をキャンセルしました',
        downloaded: 'のPDFをダウンロードしました',
        generationFailed: 'のPDFの生成に失敗しました: ',
        left: '左側',
        right: '右側',
        page: 'ページ',
        langLabel: '日本語',
        // パスワード関連
        passwordRequired: 'パスワードが必要です',
        passwordPrompt: 'このPDFはパスワードで保護されています。パスワードを入力してください：',
        passwordOk: 'OK',
        passwordCancel: 'キャンセル'
    },
    en: {
        title: 'PDF Editor Tool',
        subtitle: 'Load two PDFs and freely move, copy, and delete pages',
        howToUseBtn: 'How to use',
        leftPdf: 'Left PDF',
        rightPdf: 'Right PDF',
        loading: 'Loading...',
        cancelLoading: 'Cancel Loading',
        dragDropText: 'Drag & Drop PDF File',
        selectFile: 'Select File',
        downloadLeft: 'Download Left PDF',
        downloadRight: 'Download Right PDF',
        deletePage: 'Delete Page',
        generatingPdf: 'Generating PDF...',
        pages: 'Pages',
        cancelProgress: 'Cancel (ESC)',
        usageTitle: 'How to Use',
        loadPdfTitle: 'Loading PDF Files',
        loadPdfMethod1: '<strong>Method 1:</strong> Click "Select File" button to choose a PDF',
        loadPdfMethod2: '<strong>Method 2:</strong> Drag & drop PDF file to upload area',
        loadPdfNote: 'You can load different PDFs in the left and right panels',
        movePageTitle: 'Moving Pages',
        movePageDesc1: 'To reorder pages within the same PDF, drag a page thumbnail and drop it at the desired position',
        movePageDesc2: 'A preview line indicates the insertion position',
        copyPageTitle: 'Copying Pages',
        copyPageDesc1: 'Drag & drop a page from one panel to another',
        copyPageDesc2: 'The original page remains in the source PDF, and a copy is added to the destination PDF',
        deletePageTitle: 'Deleting Pages',
        deletePageDesc1: 'Right-click on the page thumbnail you want to delete',
        deletePageDesc2: 'Select "Delete Page" from the context menu',
        deletePageNote: '<strong>Note:</strong> A PDF must have at least one page',
        zoomPageTitle: 'Zooming Pages',
        zoomPageDesc1: 'Click on any page thumbnail',
        zoomPageDesc2: 'The page will be displayed enlarged in a modal window',
        zoomPageDesc3: 'Click the close button or outside the modal to close',
        downloadPdfTitle: 'Downloading Edited PDF',
        downloadPdfDesc1: 'Click "Download Left PDF" or "Download Right PDF" button at the bottom of each panel',
        downloadPdfDesc2: 'You can check the generation status with the progress bar',
        downloadPdfDesc3: 'Press ESC key or click "Cancel" button to cancel the operation',
        keyboardShortcutTitle: 'Keyboard Shortcuts',
        keyboardShortcutEsc: '<strong>ESC:</strong> Cancel PDF generation or close modal window',
        keyboardShortcutRightClick: '<strong>Right-click:</strong> Open context menu for page thumbnail',
        securityTitle: 'Security',
        securityDesc1: 'All processing is done within the browser',
        securityDesc2: 'PDF files are never sent to the server',
        // Status messages
        pageMoved: 'Page moved',
        pageCopied: 'Page copied (original page remains)',
        pageDeleted: 'Page deleted',
        cannotDeleteLastPage: 'Cannot delete the last page',
        pdfNotUploaded: ' PDF is not uploaded. Please upload a PDF first.',
        noPages: ' PDF has no pages',
        generating: ' PDF generating...',
        cancelling: 'Cancelling...',
        cancelled: ' PDF generation cancelled',
        downloaded: ' PDF downloaded',
        generationFailed: ' PDF generation failed: ',
        left: 'Left',
        right: 'Right',
        page: 'Page',
        langLabel: 'English',
        // Password related
        passwordRequired: 'Password Required',
        passwordPrompt: 'This PDF is password-protected. Please enter the password:',
        passwordOk: 'OK',
        passwordCancel: 'Cancel'
    }
};

// 現在の言語（デフォルトは日本語）
let currentLanguage = 'ja';

// 言語を切り替える関数
function switchLanguage(lang) {
    currentLanguage = lang;

    // HTML要素のテキストを更新
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.innerHTML = translations[lang][key];
        }
    });

    // PDFラベルを更新（ファイルが読み込まれている場合は維持）
    updatePdfLabelsForLanguage();

    // ページアイテムのラベルを更新
    updatePageLabelsForLanguage();

    // ステータスメッセージを更新
    updateDynamicTexts();

    // 言語ラベルを更新
    document.getElementById('currentLangLabel').textContent = translations[lang].langLabel;

    // HTML lang属性を更新
    document.documentElement.lang = lang;

    // ローカルストレージに保存
    localStorage.setItem('pdfEditorLanguage', lang);
}

// PDFラベルを言語切り替え時に更新
function updatePdfLabelsForLanguage() {
    for (let i = 1; i <= 2; i++) {
        const label = document.getElementById(`pdfLabel${i}`);
        if (label) {
            const icon = label.querySelector('.pdf-icon');
            const iconText = icon ? icon.textContent : (i === 1 ? 'L' : 'R');

            // ファイル名が表示されているかチェック
            const hasFileName = label.innerHTML.includes('</div>') &&
                               !label.textContent.includes(translations.ja.leftPdf) &&
                               !label.textContent.includes(translations.ja.rightPdf) &&
                               !label.textContent.includes(translations.en.leftPdf) &&
                               !label.textContent.includes(translations.en.rightPdf);

            if (!hasFileName) {
                // ファイル名がない場合は、言語に応じたデフォルトラベルを表示
                const defaultLabel = i === 1 ? translations[currentLanguage].leftPdf : translations[currentLanguage].rightPdf;
                label.innerHTML = `
                    <div class="pdf-icon">${iconText}</div>
                    <span data-i18n="${i === 1 ? 'leftPdf' : 'rightPdf'}">${defaultLabel}</span>
                `;
            }
        }
    }
}

// ページアイテムのラベルを言語切り替え時に更新
function updatePageLabelsForLanguage() {
    // すべてのページアイテムのpage-numberラベルを取得して更新
    document.querySelectorAll('.page-number').forEach(pageNumberDiv => {
        const pdfNumber = parseInt(pageNumberDiv.dataset.pdfNumber);
        const pageNum = parseInt(pageNumberDiv.dataset.pageNum);

        if (pdfNumber && pageNum) {
            const sideLabel = pdfNumber === 1 ? (currentLanguage === 'ja' ? '左' : 'L') : (currentLanguage === 'ja' ? '右' : 'R');
            const sideText = currentLanguage === 'ja' ? '側' : '';
            pageNumberDiv.textContent = `${sideLabel}${sideText} - P.${pageNum}`;
        }
    });
}

// 動的なテキスト（プログレスバーなど）を更新
function updateDynamicTexts() {
    // プログレスバーの詳細テキストを更新
    const progressDetails = document.getElementById('progressDetails');
    if (progressDetails) {
        const currentText = progressDetails.textContent;
        const match = currentText.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
            const current = match[1];
            const total = match[2];
            progressDetails.innerHTML = `${current} / ${total} <span data-i18n="pages">${translations[currentLanguage].pages}</span>`;
        }
    }
}

// 言語トグルスイッチのイベントリスナー
const langToggle = document.getElementById('langToggle');

function toggleLanguage() {
    const newLang = currentLanguage === 'ja' ? 'en' : 'ja';
    langToggle.classList.toggle('active');
    langToggle.setAttribute('aria-checked', newLang === 'en' ? 'true' : 'false');
    switchLanguage(newLang);
}

langToggle.addEventListener('click', toggleLanguage);
langToggle.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleLanguage();
    }
});

// ページ読み込み時に保存された言語設定を復元
document.addEventListener('DOMContentLoaded', () => {
    const savedLanguage = localStorage.getItem('pdfEditorLanguage');
    if (savedLanguage && savedLanguage !== 'ja') {
        currentLanguage = savedLanguage;
        langToggle.classList.add('active');
        langToggle.setAttribute('aria-checked', 'true');
        switchLanguage(savedLanguage);
    }
});

// 言語を取得する関数（他の関数から使用）
function getTranslation(key) {
    return translations[currentLanguage][key] || key;
}

// テーマ切替（ライト / ダーク）
// 初期テーマは <head> のインラインスクリプトで適用済み。ここではトグル動作のみ担当
(function setupThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    const apply = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        try { localStorage.setItem('pdfEditorTheme', theme); } catch (e) { /* noop */ }
    };

    apply(document.documentElement.getAttribute('data-theme') || 'light');

    btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(next);
    });
})();
