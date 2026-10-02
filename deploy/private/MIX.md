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
4. **会社アカウントでのログイン統一（実装済み）**：各 Access アプリの「Application Audience (AUD) Tag」と、チームドメイン（`xxx.cloudflareaccess.com`）を `.env` の `PORTAL_ACCESS_*`・`CRM_ACCESS_*` に設定すると、Access を通った人は**自動でアプリにログイン**します（署名つき JWT を検証し、メールが従業員名簿の会社メールと**1件だけ一致**した人のみ）。名簿に会社メールを登録しておくこと。
5. 動作を確認したら `.env` の `ACCESS_ONLY=1` で従業員番号 + PIN のログインを止め、会社アカウントのみにできます。決算書・給与明細などの「PIN再入力」は引き続き PIN を使うため、初回に PIN の設定が必要です。

## 勤怠SaaSの選び方（料金・条件は変わるため公式サイトで確認）
- 無料枠のある例：ジョブカン勤怠管理（少人数向け無料プランあり）。有料の定番：freee人事労務、マネーフォワード クラウド勤怠、KING OF TIME。
- 選定条件：36協定の上限管理、CSV/API出力、管理者・本人の権限、監査ログ、データの国内保管、退職者の即時停止。
- ポータルの勤怠データを移す場合は、ポータルの CSV 出力を使う。以後は `.env` の `PORTAL_ATTENDANCE=off`（と `PORTAL_ATTENDANCE_URL`）で、ポータルの勤怠・打刻・Excel連携を非表示にし、`docker compose up -d --build` で作り直す（**実装済み**）。

## 未実装・次の段階
- 実際の Cloudflare Access との結合確認（署名検証は自動テスト済み。本番の AUD・チームドメインでの通し確認は未実施）。
- カレンダーの双方向同期（Google Calendar / Microsoft Graph API。OAuth と各社への登録が必要）。
- CRM のメールを Gmail API / Microsoft Graph 経由で添付つき送信。
