/**
 * qpdf連携機能
 * パスワード付きPDFのパスワード保護を完全に解除する
 * 
 * このファイルは、パスワードで保護されたPDFファイルを扱うための
 * 重要な機能を提供します。通常、PDF.jsはパスワードを入力すれば
 * PDFを開くことができますが、編集や再保存の際に問題が発生することがあります。
 * 
 * そこで、qpdfというツールを使って、PDFからパスワード保護を
 * 完全に取り除いた「解錠済みのPDF」を作成します。
 */

/**
 * qpdfを使ってPDFのパスワードを解除する関数
 * 
 * この関数は、パスワード付きPDFファイルをサーバーに送信し、
 * qpdfコマンドでパスワード保護を解除した新しいPDFファイルを
 * 取得します。
 * 
 * 処理の流れ：
 * 1. PDFファイルとパスワードをサーバーに送信
 * 2. サーバー側でqpdfコマンドを実行してパスワードを解除
 * 3. 解除されたPDFをBase64形式で受け取る
 * 4. Base64をバイナリ（ArrayBuffer）に変換
 * 5. 新しいFileオブジェクトとして返す
 * 
 * @param {File} file - パスワード付きのPDFファイル
 * @param {string} password - PDFのパスワード
 * @returns {Promise<File>} パスワードが解除されたPDFファイル
 * @throws {Error} 解除に失敗した場合
 */
async function decryptPDFWithQpdf(file, password) {
    try {
        // FormDataオブジェクトを作成
        // FormDataは、HTMLフォームと同じようにデータを送信するための便利な方法です
        // まるで、荷物を梱包して宅配便で送るようなイメージです
        const formData = new FormData();
        formData.append('pdf', file);  // PDFファイルを追加
        formData.append('password', password);  // パスワードを追加
        
        // CSRFトークンを取得（meta タグから）
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

        // サーバーにPOSTリクエストを送信
        // fetchは、サーバーと通信するためのモダンな方法です
        const response = await fetch('decrypt-pdf.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'X-CSRF-Token': csrfToken
            },
            body: formData
            // Content-Typeヘッダーは自動的に設定されるので指定不要
        });
        
        // レスポンスをJSON形式で取得
        const result = await response.json();
        
        // サーバーからのレスポンスを確認
        if (!result.success) {
            // エラーが発生した場合は、エラーメッセージをthrowして呼び出し元に伝える
            throw new Error(result.message || 'Failed to decrypt PDF');
        }
        
        // Base64エンコードされたPDFデータを取得
        // サーバーから返されたPDFは、テキスト形式（Base64）でエンコードされています
        // これを元のバイナリ形式に戻す必要があります
        const base64Data = result.data.pdf_data;
        
        // Base64文字列をバイナリデータ（Uint8Array）に変換
        // この処理は、まるで暗号化された手紙を元の文章に戻すようなものです
        const binaryString = atob(base64Data);  // Base64デコード
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        
        // 1文字ずつバイナリデータに変換
        // この処理は少し時間がかかりますが、正確にデータを復元するために必要です
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Uint8ArrayからBlobを作成
        // Blobは、ファイルのようなバイナリデータを表すオブジェクトです
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        // BlobからFileオブジェクトを作成
        // 元のファイル名を使用しますが、「_decrypted」という接尾辞を追加して
        // 「これはパスワードが解除されたファイルだ」とわかるようにします
        const originalName = file.name;
        const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
        const decryptedFileName = `${nameWithoutExt}_decrypted.pdf`;
        
        const decryptedFile = new File([blob], decryptedFileName, {
            type: 'application/pdf',
            lastModified: Date.now()
        });
        
        console.log('✅ PDFのパスワード解除に成功:', decryptedFileName);
        
        // 解除されたPDFファイルを返す
        return decryptedFile;
        
    } catch (error) {
        // エラーが発生した場合は、詳細なメッセージをコンソールに記録
        console.error('❌ PDFパスワード解除エラー:', error);
        
        // エラーを呼び出し元に再度投げる
        // これにより、呼び出し元でエラーハンドリングができます
        throw error;
    }
}

