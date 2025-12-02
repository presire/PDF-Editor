// PDF.jsの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// グローバル変数
const pdfDocuments = [null, null]; // 2つのPDFドキュメントを保持
let draggedElement = null;
let draggedOriginalIndex = -1; // ドラッグ開始時の元の位置を記録
let draggedOriginalContainer = null; // ドラッグ開始時の元のコンテナを記録
let draggedIsCopied = false; // ★★★ ドラッグしているページがコピーされたものかどうか ★★★
let contextMenuTarget = null;
let activeDropZones = []; // アクティブなドロップゾーンを追跡

// PDF生成のキャンセルフラグ
// この変数がtrueになると、PDF生成処理が中断されます
// まるで信号機のように、「進め（false）」か「止まれ（true）」かを示す役割を持ちます
let pdfGenerationCancelled = false;

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
    details.textContent = `0 / ${total} ページ`; // 「0 / 10 ページ」のような形式で表示
    
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
    details.textContent = `${current} / ${total} ページ`; // 「3 / 10 ページ」のように更新
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
    cancelBtn.textContent = '✕ キャンセル (ESC)'; // テキストを元に戻す
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
    titleElement.textContent = 'キャンセル中...';
    titleElement.style.color = '#e74c3c'; // タイトルの色を赤に変更
    
    // キャンセルボタンを無効化して、二重にキャンセルされることを防ぐ
    const cancelBtn = document.getElementById('progressCancelBtn');
    cancelBtn.disabled = true; // ボタンを無効化
    cancelBtn.textContent = 'キャンセル中...'; // ボタンのテキストを変更
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
    
    // ページコンテナにドラッグイベントを追加
    pagesContainer.addEventListener('dragover', handleDragOver);
    pagesContainer.addEventListener('drop', handleDrop);
}

// PDFを読み込む
async function loadPDF(file, pdfNumber) {
    try {
        const sideLabel = pdfNumber === 1 ? '左側' : '右側';
        
        // 読み込み開始メッセージを表示（duration: 0 で自動的に消えないようにする）
        showStatus(`PDFを読み込み中... (${sideLabel})`, 'info', 0);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // PDFデータを保存
        pdfDocuments[pdfNumber - 1] = {
            pdf: pdf,
            file: file
        };
        
        // ページを表示
        const container = document.getElementById(`pagesContainer${pdfNumber}`);
        container.innerHTML = '';
        
        // ページを1つずつ読み込みながら、進捗を表示
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageItem = await createPageItem(pdf, pdfNumber, pageNum, page);
            container.appendChild(pageItem);
            
            // 進捗状況を更新（現在のページ数 / 全体のページ数）
            showStatus(`PDFを読み込み中... (${sideLabel}) ${pageNum} / ${pdf.numPages} ページ`, 'info', 0);
        }
        
        // ダウンロードボタンを有効化
        document.getElementById(`downloadBtn${pdfNumber}`).disabled = false;
        
        // 完了メッセージを表示（3秒後に自動的に消える）
        showStatus(`PDFを読み込みました (${pdf.numPages}ページ)`, 'success', 3000);
    } catch (error) {
        showStatus('PDFの読み込みに失敗しました', 'error');
        console.error(error);
    }
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
    const sideLabel = pdfNumber === 1 ? '左' : '右';
    pageNumberDiv.textContent = `${sideLabel}側 - P.${pageNum}`;
    
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
    const sideLabel = pdfNumber === 1 ? '左側のPDF' : '右側のPDF';
    modalInfo.textContent = `${sideLabel} - ページ ${pageNum}`;
    
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
            showStatus('元の位置に戻しました（変更なし）', 'info', 1500);
            return;
        }
        
        // ★★★ コピー済みページの場合は「コピー」表示を維持 ★★★
        const isCopiedPage = draggedElement.classList.contains('copied');
        
        if (!isCopiedPage) {
            // オリジナルページの場合のみ、移動マーカーを一時的に表示
            draggedElement.classList.add('moved');
            setTimeout(() => {
                draggedElement.classList.remove('moved');
            }, 2000);
        }
        // コピー済みページの場合は、copiedクラスをそのまま維持（何もしない）
        
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
        
        // 移動後、元の位置に戻ったページから移動マークを削除
        checkAndUpdateMovedMarkers(targetContainer);
        
        showStatus('ページを移動しました', 'success', 2000);
    } else {
        // 別のコンテナへのコピー
        
        // ★★★ コピー済みページの元のPDFへの戻し防止（念のための二重チェック） ★★★
        if (draggedElement.classList.contains('copied') && targetPdfNum === originalPdfNum) {
            showStatus('コピーされたページを元のPDFに戻すことはできません', 'error', 3000);
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
            
            showStatus('ページをコピーしました（元のページは残っています）', 'success', 2000);
        }
    }
}

// 元の位置に戻ったページから移動マークを削除する関数
function checkAndUpdateMovedMarkers(container) {
    // コンテナ内の全ページアイテムを取得
    const pageItems = Array.from(container.querySelectorAll('.page-item'));
    
    // 各ページをチェック
    pageItems.forEach((pageItem, currentIndex) => {
        const originalPageNum = parseInt(pageItem.dataset.originalPageNumber);
        const originalPdfNum = parseInt(pageItem.dataset.originalPdfNumber);
        
        // コンテナIDからPDF番号を取得
        const containerPdfNum = container.id.includes('1') ? 1 : 2;
        
        // このページが元のPDFからのページで、かつ元の位置に戻っているかチェック
        // 元の位置とは、originalPageNumと現在の位置（1から数えて）が一致すること
        // currentIndexは0から始まるので、+1して比較
        if (originalPdfNum === containerPdfNum && originalPageNum === currentIndex + 1) {
            // 元の位置に戻っている場合、movedクラスを削除
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
            showStatus('ページを削除しました', 'success', 2000);
        } else {
            showStatus('最後のページは削除できません', 'error', 2000);
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
        const sideLabel = pdfNumber === 1 ? '左側' : '右側';
        
        // PDFがアップロードされているか確認
        if (!pdfDocuments[pdfNumber - 1]) {
            showStatus(`${sideLabel}のPDFがアップロードされていません。まずPDFをアップロードしてください。`, 'error', 5000);
            return;
        }
        
        // 指定されたコンテナからページを取得
        const container = document.getElementById(`pagesContainer${pdfNumber}`);
        const pages = container.querySelectorAll('.page-item');
        
        // ページが存在するか確認
        if (pages.length === 0) {
            showStatus(`${sideLabel}のPDFにページがありません`, 'error');
            return;
        }
        
        // プログレスバーを表示（処理開始を視覚的に示す）
        showProgress(`${sideLabel}のPDFを生成中...`, pages.length);
        
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
                showStatus(`${sideLabel}のPDF生成をキャンセルしました`, 'info', 3000);
                
                // 関数を終了（ダウンロードは実行されません）
                return;
            }
            
            // 元のPDF番号とページ番号を使用してコピー
            const originalPdfNum = parseInt(pageElement.dataset.originalPdfNumber);
            const originalPageNum = parseInt(pageElement.dataset.originalPageNumber);
            
            // 元のPDFドキュメントを取得
            const sourcePdfData = pdfDocuments[originalPdfNum - 1];
            if (sourcePdfData) {
                const arrayBuffer = await sourcePdfData.file.arrayBuffer();
                // 暗号化されたPDFにも対応するためignoreEncryptionオプションを追加
                const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                
                // ページをコピー（インデックスは0から始まるので-1）
                const [copiedPage] = await newPdfDoc.copyPages(sourcePdf, [originalPageNum - 1]);
                newPdfDoc.addPage(copiedPage);
                
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
        showStatus(`${sideLabel}のPDFをダウンロードしました`, 'success');
    } catch (error) {
        const sideLabel = pdfNumber === 1 ? '左側' : '右側';
        
        // エラーが発生した場合もプログレスバーを非表示にする
        hideProgress();
        
        // エラーの詳細をユーザーに表示
        const errorMessage = error.message || error.toString();
        showStatus(`${sideLabel}のPDFの生成に失敗しました: ${errorMessage}`, 'error', 8000);
        console.error('PDF生成エラーの詳細:', error);
    }
}
