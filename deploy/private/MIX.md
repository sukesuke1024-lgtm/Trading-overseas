# ミックス構成（Google / Microsoft / Cloudflare ＋ 自作CRM）

```
社員 ─ Google または Microsoft のアカウントでログイン ─▶ Cloudflare Access（許可した人だけ）─▶ CRM（自作・非公開）
                                                                              └▶ 社内ポータル（お知らせ・申請・予定など）
勤怠 ─▶ 勤怠SaaS（既製品）                 カレンダー ─▶ Google / Outlook に1クリックで追加
メール ─▶ Gmail / Outlook で送信（CRMが作成画面を開く）
```

## 役割分担
| 領域 | 担当 | 理由 |
|---|---|---|
| ログインの入り口 | **Cloudflare Access**（IdP：Google・Microsoft Entra ID・ワンタイムPIN） | 会社アカウントで統一。退職者はアカウントを止めれば入れなくなる。50人まで無料 |
| 顧客管理 | **自作CRM**（このリポジトリ） | 契約可否・与信・粗利・為替など、既製品にない業務ロジック |
| 勤怠 | **勤怠SaaS** | 給与・労基法・マイナンバー等の責任を事業者に任せる。ポータルの勤怠は使わない運用にする |
| カレンダー | **Google / Outlook**（ポータルの予定から1クリックで追加） | 各自のカレンダーが正。OAuth不要でデータを自動送信しない |
| メール配信 | **Gmail / Outlook**（CRMが作成画面を開く） | 会社のアカウントから送信され、送信済みに残る。30件以下のBCC |

## 設定手順（Cloudflare Access）
1. Zero Trust → Settings → Authentication → Login methods に、**Google** と **Microsoft Entra ID**、**One-time PIN**（会社アカウントが無い人向け）を追加。
2. Access → Applications で `crm.<ドメイン>`・`portal.<ドメイン>` を登録。ポリシーは「会社のドメインのメール（例 `@example.co.jp`）」または「許可リストのメール」だけ。
3. セッション長は8〜24時間。デバイス姿勢（会社端末のみ）は有料プランで可能。
4. アプリ側の従業員番号 + PIN + 認証アプリは、**そのまま二段目として残ります**（Access で入れた人でも、アプリのログインが必要）。ログインを統一したい場合は、次の段階でアプリ側の認証を Access の JWT 検証に置き換えます（未実装）。

## 勤怠SaaSの選び方（料金・条件は変わるため公式サイトで確認）
- 無料枠のある例：ジョブカン勤怠管理（少人数向け無料プランあり）。有料の定番：freee人事労務、マネーフォワード クラウド勤怠、KING OF TIME。
- 選定条件：36協定の上限管理、CSV/API出力、管理者・本人の権限、監査ログ、データの国内保管、退職者の即時停止。
- ポータルの勤怠データを移す場合は、ポータルの CSV 出力を使う。以後はポータルの打刻を使わない。

## 未実装・次の段階
- Access の JWT でアプリ側ログインを置き換え（SSO統一）。
- カレンダーの双方向同期（Google Calendar / Microsoft Graph API。OAuth と各社への登録が必要）。
- CRM のメールを Gmail API / Microsoft Graph 経由で添付つき送信。
