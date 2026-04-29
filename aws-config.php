<?php
/**
 * AWS設定ファイル
 * AWS認証情報とリージョン設定を管理
 * 
 * このファイルへの直接アクセスは .htaccess で禁止されています
 */

// 直接アクセスを防止
if (!defined('APP_TITLE')) {
    http_response_code(403);
    exit('Direct access forbidden');
}

/**
 * AWS認証情報を読み込む
 *
 * AWS CLIと同じ INI 形式（[default] セクション）を想定。
 * 使用するプロファイルは AWS_PROFILE 環境変数で上書き可能（既定: default）。
 *
 * @return array AWS認証情報の連想配列
 */
function loadAWSCredentials() {
    $credentialsFile = __DIR__ . '/../../credentials';
    $configFile      = __DIR__ . '/../../config';
    $profile         = getenv('AWS_PROFILE');
    if (!is_string($profile) || $profile === '') {
        $profile = 'default';
    }

    $credentials = [
        'access_key' => '',
        'secret_key' => '',
        'region'     => '',
        'output'     => '',
    ];

    // credentialsファイル（[profile] 形式）
    if (is_readable($credentialsFile)) {
        $parsed = @parse_ini_file($credentialsFile, true, INI_SCANNER_RAW);
        if (is_array($parsed) && isset($parsed[$profile]) && is_array($parsed[$profile])) {
            $section = $parsed[$profile];
            if (!empty($section['aws_access_key_id'])) {
                $credentials['access_key'] = trim($section['aws_access_key_id']);
            }
            if (!empty($section['aws_secret_access_key'])) {
                $credentials['secret_key'] = trim($section['aws_secret_access_key']);
            }
        }
    }

    // configファイル（credentials 以外は [profile xxx] が AWS CLI 仕様）
    if (is_readable($configFile)) {
        $parsed = @parse_ini_file($configFile, true, INI_SCANNER_RAW);
        if (is_array($parsed)) {
            // 'default' は素のセクション名、それ以外は 'profile <name>'
            $sectionKey = ($profile === 'default') ? 'default' : 'profile ' . $profile;
            if (isset($parsed[$sectionKey]) && is_array($parsed[$sectionKey])) {
                $section = $parsed[$sectionKey];
                if (!empty($section['region'])) {
                    $credentials['region'] = trim($section['region']);
                }
                if (!empty($section['output'])) {
                    $credentials['output'] = trim($section['output']);
                }
            }
        }
    }

    return $credentials;
}

/**
 * AWS DynamoDB クライアントの設定を取得
 *
 * @return array DynamoDBクライアント設定
 */
function getAWSDynamoDBConfig() {
    $credentials = loadAWSCredentials();

    return [
        'version' => 'latest',
        'region' => $credentials['region'],
        'credentials' => [
            'key' => $credentials['access_key'],
            'secret' => $credentials['secret_key']
        ]
    ];
}

/**
 * AWS認証情報が正しく設定されているか確認
 *
 * @return bool 認証情報が有効な場合true
 */
function validateAWSCredentials() {
    $credentials = loadAWSCredentials();

    return !empty($credentials['access_key']) &&
           !empty($credentials['secret_key']) &&
           !empty($credentials['region']);
}
