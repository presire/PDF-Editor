/**
 * DynamoDB連携機能
 * PDFファイルのアップロード情報をDynamoDBに記録する
 */

/**
 * CSRFトークンを取得（meta タグから）
 */
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

/**
 * PDFアップロード情報をDynamoDBに記録する関数
 * 
 * @param {string} filename - アップロードされたPDFファイルの名前
 * @param {number} pdfNumber - PDFの位置（1: 左側, 2: 右側）
 * @param {number} numPages - PDFのページ数（オプション）
 */
async function savePDFLogToDynamoDB(filename, pdfNumber, numPages = 0) {
    try {
        // 現在の日時を取得（日本時間）
        const now = new Date();
        const uploadTime = now.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // サイドラベル（left または right）
        const side = pdfNumber === 1 ? 'left' : 'right';
        
        // DynamoDBに送信するデータ
        const data = {
            filename: filename,
            upload_time: uploadTime,
            side: side,
            num_pages: numPages
        };
        
        // PHPエンドポイントにPOSTリクエストを送信
        const response = await fetch('save-pdf-log.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify(data)
        });
        
        // レスポンスをJSON形式で取得
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ DynamoDB記録成功:', result.data);
            return true;
        } else {
            console.warn('⚠️ DynamoDB記録失敗:', result.message);
            return false;
        }
        
    } catch (error) {
        // エラーが発生しても、ユーザー体験を損なわないように
        // コンソールに警告を表示するだけで、処理は続行
        console.warn('⚠️ DynamoDB記録エラー（処理は続行）:', error);
        return false;
    }
}

// ============================================
// PDF-Editor.js の loadPDF 関数に以下のコードを追加
// ============================================

/*
// 既存のloadPDF関数内で、PDF読み込み成功後（284行目付近）に以下を追加：

// 完了メッセージを表示（3秒後に自動的に消える）
showStatus(currentLanguage === 'ja' ? `PDFを読み込みました (${pdf.numPages}ページ) - ${sideLabel}` : `PDF loaded (${pdf.numPages} pages) - ${sideLabel}`, 'success', 3000);

// ★★★ ここに追加 ★★★
// DynamoDBにアップロード情報を記録
savePDFLogToDynamoDB(file.name, pdfNumber, pdf.numPages);
// ★★★ 追加ここまで ★★★

*/
