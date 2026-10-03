/* バイヤーポータル設定
   companyUrl : 会社サイトのURL（空なら「会社サイト」リンクは表示されません）
   accounts   : デモ用ログインアカウント。パスワード本体は置かず、SHA-256(salt:ID:パスワード) のみを保持します。
                ※ ブラウザ内での照合のため、本番の認証にはサーバー側認証が必要です（README参照）。 */
window.HLINK_CONFIG = {
  companyUrl: '',
  idleMinutes: 15,
  maxFails: 5,
  lockSeconds: 60,
  salt: 'hlink-buyer-demo-v1',
  accounts: [
    { id: 'buyer01', role: 'buyer', name: 'バイヤー', company: 'Sunrise Trading Pte. Ltd.', hash: '51940cb6364dc7f8bea39d38bec9a40611e094ec3e30d05ae5531ae97a42a14a' },
    { id: 'staff01', role: 'internal', name: 'H-LINK 担当', company: 'H-LINK 社内', hash: '47b5ee24662868d0441335431fb9f8d542a77e42521c23e929dff2ba63b62e5c' },
  ],
};
