# 筋トレ記録アプリ（Firebase対応）

このアプリは GitHub Pages 上で動く静的アプリです。  
Firebase を設定すると、**Pixel 10 とパソコンで同じ記録を共有**できます。

- 公開URLはそのまま使えます（Firebase Hostingへの移行は必須ではありません）
- Googleログイン対応
- 記録は Firestore に保存
- 既存 localStorage 記録は「1回だけ移行」ボタンで移せます
- Firebase未設定時もローカル保存で継続利用できます

---

## 1. 最初に必ずバックアップ（重要）

1. アプリを開く
2. `CSV出力` を押す
3. ダウンロードした CSV を Google Drive などに保存

> これで、万一の時も既存データを復元できます。

---

## 2. Firebase Console 側の設定（非エンジニア向け）

### 2-1. Firebaseプロジェクト作成
1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」
3. 名前を入力して作成

### 2-2. Webアプリ登録
1. Firebaseプロジェクトを開く
2. 「アプリを追加」→ Web（`</>`）
3. 任意のアプリ名を入力して登録
4. 表示される `firebaseConfig` を控える

### 2-3. Authentication（Googleログイン）有効化
1. 左メニュー「Authentication」
2. 「始める」
3. 「Sign-in method」タブ
4. 「Google」を有効化して保存

### 2-4. Firestore Database 作成
1. 左メニュー「Firestore Database」
2. 「データベースを作成」
3. ロケーションを選択して作成

### 2-5. 承認済みドメインに GitHub Pages を追加
1. Authentication → Settings → Authorized domains
2. `tatsuya-sato-jp.github.io` を追加

### 2-6. Firestore Security Rules を設定
1. Firestore → ルール
2. このリポジトリの `firestore.rules` の内容を貼り付け
3. 公開（Publish）

---

## 3. アプリ側の設定（このリポジトリ）

`firebase-config.js` を開いて、プレースホルダーを Firebase の値に置き換えてください。

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

> 注意: ここに **秘密鍵（service account key など）を入れてはいけません**。  
> Webアプリ用 `firebaseConfig` のみを設定してください。

---

## 4. 使い方

1. アプリ上部の `Googleでログイン` を押す
   - ポップアップが開かない場合は、自動的にリダイレクト方式（Googleログイン画面へ移動）に切り替わります。戻ってくればログイン完了です。
2. ログイン後、自分の Firestore 記録が読み込まれる
3. 追加・編集・削除・全削除は Firestore に反映される
4. 初回のみ必要なら `この端末の既存記録をFirestoreへ移行` を実行
   - 実行前に必ず `CSV出力` でバックアップ
   - 二重移行防止のため、同一アカウントでは1回のみ

---

## 5. Firebase未設定・通信エラー時の挙動

- 画面が真っ白になることはありません
- ログイン不可でもローカル保存で継続利用できます
- 通信失敗時はメッセージ表示し、端末側保存を維持します

---

## 6. データ互換性

- 既存のCSV/JSON/Excelインポート仕様は維持
- 既存のCSVエクスポート仕様は維持
- 既存データ形式との互換性を維持

---

## 7. 動作確認チェックリスト

1. ログイン前に「Googleログインが必要」が表示される
2. `Googleでログイン` ボタンからログインできる（ポップアップがブロックされた場合はリダイレクトでログインできる）
3. ログイン後に Firestore の記録が表示される
4. 追加・編集・削除・全削除が Firestore に反映される
5. `この端末の既存記録をFirestoreへ移行` で localStorage データを移行できる
6. Firebase設定未入力でもローカル保存で利用できる

Draft PR test


