# デプロイ & AdSense収益化チェックリスト

## Phase 1: デプロイ前の準備

### 必須置換
- [ ] `__BASE_URL__` を実際のURL（例: `https://keigo-master.com`）に一括置換
  ```bash
  # 全HTMLファイルを一括置換
  sed -i 's|__BASE_URL__|https://keigo-master.com|g' *.html articles/*.html
  ```
- [ ] `contact.html` のメールアドレス `contact@example.com` を実際のアドレスに変更
- [ ] `about.html` の運営者名を記入

### PNGアイコン生成
- [ ] `icons/generate-png.html` をブラウザで開き、3つのPNGを保存:
  - `icons/icon-180.png` (180x180, apple-touch-icon用)
  - `icons/icon-192.png` (192x192, PWA用)
  - `icons/icon-512.png` (512x512, PWA用)

### OGP画像
- [ ] `ogp.png` (1200x630) を作成してルートに配置
  - 推奨: アプリ名「ケイゴマスター」+ キャッチコピー + クイズ画面のスクリーンショット

### iOS用
- [ ] `icons/splash.png` (スプラッシュスクリーン画像) を作成

## Phase 2: ホスティング & ドメイン

### 推奨ホスティング（無料枠あり）
- **Vercel**: `npx vercel` でデプロイ（推奨）
- **Netlify**: ドラッグ&ドロップでデプロイ可能
- **GitHub Pages**: リポジトリのSettings → Pagesから有効化

### 独自ドメイン
- [ ] ドメイン取得（例: keigo-master.com）
- [ ] ホスティングサービスにドメインを接続
- [ ] HTTPS有効化確認
- [ ] `__BASE_URL__` が正しいことを再確認

## Phase 3: AdSense申請

### 申請前チェック
- [ ] サイトが公開されていてアクセス可能
- [ ] 独自ドメインを使用（無料ドメインは審査に通りにくい）
- [ ] 以下のページが存在し、内容が充実していること:
  - [x] プライバシーポリシー (`privacy.html`)
  - [x] お問い合わせ (`contact.html`)
  - [x] 運営者情報 (`about.html`)
- [ ] コンテンツが十分にあること:
  - [x] メインクイズアプリ（88問）
  - [x] 記事3本（敬語ガイド、ビジネスマナー、面接敬語）
- [ ] Google Search Consoleにサイトを登録済み

### 申請手順
1. https://www.google.com/adsense/ にアクセス
2. Googleアカウントでログイン
3. サイトURL・支払い情報を入力
4. AdSenseコード（サイト確認用スニペット）をHTMLに貼り付け
5. 審査開始（通常1〜2週間）

## Phase 4: AdSense審査通過後の実装

### 1. AdSenseスクリプト追加
`index.html` の `<head>` にAdSenseスクリプトを追加:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXX" crossorigin="anonymous"></script>
```

### 2. CSP更新
`index.html` の `Content-Security-Policy` を更新:
```
script-src 'self' https://pagead2.googlesyndication.com https://adservice.google.com;
style-src 'self' https://pagead2.googlesyndication.com;
frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com;
img-src 'self' https://pagead2.googlesyndication.com;
```

### 3. ads.txt更新
`ads.txt` のパブリッシャーIDを実際のIDに置換:
```
google.com, pub-実際のID, DIRECT, f08c47fec0942fa0
```

### 4. 広告ユニット配置
`index.html` の `#ad-header`:
- `hidden` 属性を削除
- 中身にAdSenseの `<ins>` タグを挿入

`app.js` の `#ad-result`（結果画面）:
- 動的に生成される広告ユニットのため、表示後に `(adsbygoogle = window.adsbygoogle || []).push({});` を実行

### 推奨広告配置
| 配置場所 | 広告タイプ | 理由 |
|---------|----------|------|
| ヘッダー下 | ディスプレイ広告（レスポンシブ） | 常に表示、安定した表示回数 |
| 結果画面 | ディスプレイ広告 | クイズ終了後の滞在時間が長い |
| 記事ページ | 記事内広告 | 自然な位置で高クリック率 |

## Phase 5: 収益最適化

### Google Analytics (GA4) 導入
- [ ] GA4プロパティ作成
- [ ] CSPの `connect-src` に `analytics.google.com` を追加
- [ ] 測定ID（G-XXXXX）をサイトに設置

### 追跡すべき指標
- ページビュー数
- クイズ完了率
- カテゴリ別の人気度
- 平均セッション時間
- 広告クリック率（AdSenseダッシュボードで確認）

### SEO強化
- [ ] Google Search Consoleでサイトマップ送信
- [ ] 記事を定期的に追加（月1〜2本目安）
- [ ] SNSでの定期的なシェア
