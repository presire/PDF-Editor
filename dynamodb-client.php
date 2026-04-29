<?php
/**
 * AWS DynamoDB クライアント（Composerなし版）
 * 
 * AWS SDK for PHPを使用せずに、直接DynamoDB APIを呼び出します。
 * このファイルへの直接アクセスは .htaccess で禁止されています。
 */

// 直接アクセスを防止
if (!defined('APP_TITLE')) {
    http_response_code(403);
    exit('Direct access forbidden');
}

class DynamoDBClient {
    private $accessKey;
    private $secretKey;
    private $region;
    private $service = 'dynamodb';
    
    /**
     * コンストラクタ
     */
    public function __construct($accessKey, $secretKey, $region = 'us-east-1') {
        $this->accessKey = $accessKey;
        $this->secretKey = $secretKey;
        $this->region = $region;
    }
    
    /**
     * DynamoDBにアイテムを挿入
     *
     * @param string $tableName テーブル名
     * @param array $item 挿入するアイテム
     * @return array レスポンス
     * @throws Exception
     */
    public function putItem($tableName, $item) {
        $target = 'DynamoDB_20120810.PutItem';
        $payload = json_encode([
            'TableName' => $tableName,
            'Item'      => $item,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($payload === false) {
            throw new Exception('Failed to encode DynamoDB request: ' . json_last_error_msg());
        }

        return $this->makeRequest($target, $payload);
    }
    
    /**
     * DynamoDB APIリクエストを実行
     * 
     * @param string $target APIターゲット
     * @param string $payload リクエストボディ
     * @return array レスポンス
     */
    private function makeRequest($target, $payload) {
        $host = "dynamodb.{$this->region}.amazonaws.com";
        $endpoint = "https://{$host}/";
        
        // リクエスト日時
        $datetime = gmdate('Ymd\THis\Z');
        $date = gmdate('Ymd');
        
        // ヘッダー
        $headers = [
            'Content-Type' => 'application/x-amz-json-1.0',
            'X-Amz-Target' => $target,
            'Host' => $host,
            'X-Amz-Date' => $datetime,
        ];
        
        // AWS Signature Version 4 を計算
        $signature = $this->calculateSignature(
            'POST',
            '/',
            $payload,
            $headers,
            $datetime,
            $date
        );
        
        // Authorization ヘッダーを追加
        $headers['Authorization'] = $signature;
        
        // cURL でリクエスト実行
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        
        // ヘッダーを設定
        $headerArray = [];
        foreach ($headers as $key => $value) {
            $headerArray[] = "{$key}: {$value}";
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headerArray);
        
        // SSL検証（本番環境では true を推奨）
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        // リクエスト実行
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        // エラーチェック
        if ($error) {
            throw new Exception("cURL Error: {$error}");
        }
        
        // レスポンスをデコード
        $result = json_decode($response, true);
        if (!is_array($result)) {
            // HTTPエラーかつボディが非JSONなら HTTP コードのみで例外化
            if ($httpCode >= 400) {
                throw new Exception("DynamoDB Error [{$httpCode}]: non-JSON response");
            }
            throw new Exception('Failed to decode DynamoDB response: ' . json_last_error_msg());
        }

        // HTTPエラーチェック
        if ($httpCode >= 400) {
            $errorMessage = isset($result['__type']) ? $result['__type'] : 'Unknown Error';
            $errorDetail  = isset($result['message']) ? $result['message'] : '';
            throw new Exception("DynamoDB Error [{$httpCode}]: {$errorMessage} - {$errorDetail}");
        }

        return $result;
    }
    
    /**
     * AWS Signature Version 4 を計算
     * 
     * @param string $method HTTPメソッド
     * @param string $uri リクエストURI
     * @param string $payload リクエストボディ
     * @param array $headers ヘッダー
     * @param string $datetime 日時（ISO8601形式）
     * @param string $date 日付（YYYYMMDD形式）
     * @return string Authorization ヘッダーの値
     */
    private function calculateSignature($method, $uri, $payload, $headers, $datetime, $date) {
        // ステップ 1: Canonical Request を作成
        $canonicalHeaders = [];
        $signedHeaders = [];
        
        foreach ($headers as $key => $value) {
            $lowerKey = strtolower($key);
            $canonicalHeaders[$lowerKey] = trim($value);
            $signedHeaders[] = $lowerKey;
        }
        
        ksort($canonicalHeaders);
        sort($signedHeaders);
        
        $canonicalHeadersString = '';
        foreach ($canonicalHeaders as $key => $value) {
            $canonicalHeadersString .= "{$key}:{$value}\n";
        }
        
        $signedHeadersString = implode(';', $signedHeaders);
        
        $payloadHash = hash('sha256', $payload);
        
        $canonicalRequest = implode("\n", [
            $method,
            $uri,
            '', // クエリ文字列（今回は空）
            $canonicalHeadersString,
            $signedHeadersString,
            $payloadHash
        ]);
        
        // ステップ 2: String to Sign を作成
        $algorithm = 'AWS4-HMAC-SHA256';
        $credentialScope = "{$date}/{$this->region}/{$this->service}/aws4_request";
        $canonicalRequestHash = hash('sha256', $canonicalRequest);
        
        $stringToSign = implode("\n", [
            $algorithm,
            $datetime,
            $credentialScope,
            $canonicalRequestHash
        ]);
        
        // ステップ 3: Signing Key を計算
        $kDate = hash_hmac('sha256', $date, "AWS4{$this->secretKey}", true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', $this->service, $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        
        // ステップ 4: Signature を計算
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);
        
        // Authorization ヘッダーを構築
        $authorization = "{$algorithm} " .
            "Credential={$this->accessKey}/{$credentialScope}, " .
            "SignedHeaders={$signedHeadersString}, " .
            "Signature={$signature}";
        
        return $authorization;
    }
}

/**
 * DynamoDBクライアントを取得
 * 
 * @return DynamoDBClient
 */
function getDynamoDBClient() {
    $credentials = loadAWSCredentials();
    
    if (empty($credentials['access_key']) || empty($credentials['secret_key'])) {
        throw new Exception('AWS credentials not configured');
    }
    
    return new DynamoDBClient(
        $credentials['access_key'],
        $credentials['secret_key'],
        $credentials['region']
    );
}
