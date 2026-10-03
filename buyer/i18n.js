/* 多言語対応（日本語 / English / 简体中文）
   画面は日本語で組み立て、表示時に下の辞書で置き換えます。入力された文章（チャット本文など）は変換しません。 */
(function () {
  'use strict';
  // [日本語, English, 简体中文]  ※長い語句から優先して置換されます
  const D = [
    // カテゴリー・国
    ['水産物', 'Seafood', '水产品'], ['農産物', 'Produce', '农产品'], ['畜産物', 'Meat', '畜产品'], ['加工食品', 'Processed foods', '加工食品'],
    ['飲料', 'Beverages', '饮料'], ['調味料', 'Seasonings', '调味料'], ['健康・機能性', 'Health & functional', '健康・功能性'], ['その他', 'Others', '其他'],
    ['シンガポール', 'Singapore', '新加坡'], ['香港', 'Hong Kong', '香港'], ['台湾', 'Taiwan', '台湾'], ['韓国', 'South Korea', '韩国'], ['タイ', 'Thailand', '泰国'],
    ['ベトナム', 'Vietnam', '越南'], ['マレーシア', 'Malaysia', '马来西亚'], ['米国', 'United States', '美国'], ['アラブ首長国連邦', 'United Arab Emirates', '阿拉伯联合酋长国'],
    // ステータス
    ['製造準備中', 'In preparation', '生产准备中'], ['出荷準備中', 'Preparing to ship', '发货准备中'], ['出荷準備', 'Ready to ship', '发货准备'], ['出荷済み', 'Shipped', '已发货'],
    ['配送完了', 'Delivered', '配送完成'], ['配送中', 'In transit', '配送中'], ['受付済', 'Received', '已受理'], ['発送済み', 'Sent', '已寄出'], ['回答待ち', 'Awaiting reply', '等待回复'],
    ['完了', 'Completed', '已完成'], ['受付', 'Received', '受理'], ['出荷', 'Shipped', '发货'],
    // サプライヤー
    ['北海道フードパートナーズ株式会社', 'Hokkaido Food Partners Co., Ltd.', '北海道食品合作伙伴株式会社'], ['北海道フードパートナーズ', 'Hokkaido Food Partners', '北海道食品合作伙伴'],
    ['九州ミートファクトリー株式会社', 'Kyushu Meat Factory Co., Ltd.', '九州肉类工坊株式会社'], ['道央フルーツ協同組合', 'Doo Fruit Cooperative', '道央水果合作社'],
    ['栃木ベリーファーム', 'Tochigi Berry Farm', '枥木莓果农场'], ['北のこめ工房', 'Kita no Kome Kobo', '北方稻米工坊'], ['瀬戸内水産株式会社', 'Setouchi Fisheries Co., Ltd.', '濑户内水产株式会社'],
    ['津軽アップルグロワーズ', 'Tsugaru Apple Growers', '津轻苹果种植者'], ['博多麺工房', 'Hakata Noodle Workshop', '博多面工坊'], ['静岡茶業協同組合', 'Shizuoka Tea Cooperative', '静冈茶业合作社'],
    ['小豆島醸造所', 'Shodoshima Brewery', '小豆岛酿造所'], ['薩摩黒酢本舗', 'Satsuma Black Vinegar Honpo', '萨摩黑醋本铺'], ['関西パッケージ株式会社', 'Kansai Package Co., Ltd.', '关西包装株式会社'],
    // 商品
    ['北海道産 ホタテ（冷凍）', 'Hokkaido Scallops (frozen)', '北海道产 扇贝（冷冻）'], ['北海道オホーツク海産の大粒ホタテ貝柱。急速冷凍で鮮度とうま味を保持。', 'Large scallop adductors from the Sea of Okhotsk, flash-frozen to lock in freshness and umami.', '北海道鄂霍次克海产大粒扇贝柱，急速冷冻保持鲜度与鲜味。'],
    ['1kg×10袋', '10 bags x 1kg', '1kg×10袋'], ['冷凍 18か月', 'Frozen, 18 months', '冷冻 18个月'], ['受注後 7〜10日で出荷', 'Ships 7-10 days after order', '接单后7～10天发货'],
    ['国産和牛 サーロイン', 'Japanese Wagyu Sirloin', '日本和牛 西冷'], ['きめ細かなサシと上品な甘みの A4/A5 国産和牛サーロイン。真空パックで輸出に対応。', 'A4/A5 Japanese Wagyu sirloin with fine marbling and a refined sweetness. Vacuum-packed for export.', '纹理细腻、甘味高雅的A4/A5日本和牛西冷，真空包装可出口。'],
    ['真空パック 約5kg/箱', 'Vacuum-packed, approx. 5kg/box', '真空包装 约5kg/箱'], ['冷凍 12か月', 'Frozen, 12 months', '冷冻 12个月'], ['受注後 10〜14日で出荷', 'Ships 10-14 days after order', '接单后10～14天发货'],
    ['北海道産 メロン', 'Hokkaido Melon', '北海道产 哈密瓜'], ['糖度 14 度以上を厳選した赤肉メロン。海外向けに空輸対応の専用箱で出荷。', 'Red-flesh melons selected for a Brix of 14 or higher, shipped in dedicated air-freight boxes.', '精选糖度14度以上的红肉哈密瓜，使用空运专用箱发货。'],
    ['2玉/箱（約3kg）', '2 melons/box (approx. 3kg)', '2个/箱（约3kg）'], ['冷蔵 10日', 'Chilled, 10 days', '冷藏 10天'], ['受注後 5〜7日で出荷', 'Ships 5-7 days after order', '接单后5～7天发货'],
    ['北海道産 トラウトサーモン フィレ（冷凍）', 'Hokkaido Trout Salmon Fillet (frozen)', '北海道产 三文鳟鱼片（冷冻）'], ['脂ののった養殖トラウトのフィレ。刺身・加熱どちらにも使える業務用規格。', 'Rich farmed trout fillets for sashimi or cooking, in commercial-grade packs.', '肥美的养殖鳟鱼片，生食熟食皆宜，业务用规格。'],
    ['受注後 7日で出荷', 'Ships 7 days after order', '接单后7天发货'], ['冷凍いちご（とちおとめ）', 'Frozen Strawberries (Tochiotome)', '冷冻草莓（枥乙女）'], ['完熟で収穫して急速凍結。スムージー・製菓・デザート用に。', 'Harvested fully ripe and flash-frozen. For smoothies, confectionery and desserts.', '完熟采摘后急速冷冻，适用于奶昔、糕点和甜品。'],
    ['受注後 5日で出荷', 'Ships 5 days after order', '接单后5天发货'], ['北海道産 米（ゆめぴりか）', 'Hokkaido Rice (Yumepirika)', '北海道产 大米（梦美人）'], ['もちもちとした粘りと甘みが特長。輸出用の 10kg/25kg 規格に対応。', 'Known for its sticky texture and sweetness. Available in 10kg/25kg export packs.', '特点是软糯黏口、回甘。提供10kg/25kg出口规格。'],
    ['10kg/袋', '10kg/bag', '10kg/袋'], ['常温 12か月', 'Ambient, 12 months', '常温 12个月'], ['黒毛和牛 肩ロース スライス', 'Black Wagyu Chuck Roll, Sliced', '黑毛和牛 肩里脊 切片'],
    ['すき焼き・しゃぶしゃぶ用にスライスした肩ロース。', 'Sliced chuck roll for sukiyaki and shabu-shabu.', '切成薄片的肩里脊，适用于寿喜烧和涮锅。'], ['真空 500g×10', 'Vacuum, 10 x 500g', '真空 500g×10'],
    ['受注後 10日で出荷', 'Ships 10 days after order', '接单后10天发货'], ['愛媛県産 真鯛 フィレ（冷蔵）', 'Ehime Sea Bream Fillet (chilled)', '爱媛县产 真鲷鱼片（冷藏）'], ['瀬戸内で育った養殖真鯛。下処理済みフィレで飲食店向け。', 'Farmed sea bream from the Seto Inland Sea. Pre-processed fillets for restaurants.', '濑户内海养殖真鲷，已处理的鱼片，适合餐饮店。'],
    ['2kg/箱', '2kg/box', '2kg/箱'], ['冷蔵 5日', 'Chilled, 5 days', '冷藏 5天'], ['予約受付：2週間後から出荷', 'Pre-orders open: ships from 2 weeks out', '接受预订：2周后起发货'],
    ['青森県産 ふじりんご', 'Aomori Fuji Apples', '青森县产 富士苹果'], ['蜜入りの大玉ふじ。輸出向けに選果・ワックス処理済み。', 'Large honey-core Fuji apples, sorted and waxed for export.', '蜜心大果富士苹果，已分选并打蜡，适合出口。'],
    ['10kg/箱（28玉）', '10kg/box (28 apples)', '10kg/箱（28个）'], ['冷蔵 2か月', 'Chilled, 2 months', '冷藏 2个月'], ['無添加 冷凍ラーメン（醤油）', 'Additive-free Frozen Ramen (soy sauce)', '无添加 冷冻拉面（酱油）'],
    ['化学調味料不使用のスープと細麺のセット。1ケース 30食。', 'Soup and thin noodles with no chemical seasoning. 30 servings per case.', '不使用化学调味料的汤底与细面套装，1箱30份。'], ['30食/ケース', '30 servings/case', '30份/箱'], ['冷凍 9か月', 'Frozen, 9 months', '冷冻 9个月'],
    ['静岡県産 抹茶パウダー（業務用）', 'Shizuoka Matcha Powder (commercial)', '静冈县产 抹茶粉（业务用）'], ['石臼挽きの鮮やかな緑。ラテ・製菓・アイス向けの業務用 500g 缶入り。', 'Stone-ground, vivid green. Commercial 500g tins for lattes, confectionery and ice cream.', '石臼研磨的鲜艳翠绿，500g罐装业务用，适合拿铁、糕点和冰淇淋。'],
    ['500g缶×4', '4 x 500g tins', '500g罐×4'], ['国産丸大豆 醤油（1L）', 'Japanese Whole-Soybean Soy Sauce (1L)', '日本整粒大豆 酱油（1L）'], ['木桶仕込みの丸大豆醤油。やわらかなコクと香り。', 'Cask-brewed whole-soybean soy sauce with mellow richness and aroma.', '木桶酿造的整粒大豆酱油，醇厚柔和，香气浓郁。'],
    ['1L×6本/箱', '6 x 1L bottles/box', '1L×6瓶/箱'], ['常温 24か月', 'Ambient, 24 months', '常温 24个月'], ['薩摩 黒酢ドリンク（健康・機能性表示）', 'Satsuma Black Vinegar Drink (functional claim)', '萨摩 黑醋饮料（功能性标示）'],
    ['壺造り黒酢を飲みやすく仕立てた機能性ドリンク。', 'A functional drink made from jar-brewed black vinegar, easy to drink.', '以陶壶酿造黑醋制成的易饮功能性饮料。'], ['720ml×12本', '12 x 720ml bottles', '720ml×12瓶'], ['常温 18か月', 'Ambient, 18 months', '常温 18个月'],
    ['食品用 真空包装資材（冷凍対応）', 'Food Vacuum Packaging Rolls (freezer-grade)', '食品用 真空包装材料（耐冷冻）'], ['輸出冷凍食品の梱包に適した耐寒・高バリアの真空袋ロール。', 'Cold-resistant, high-barrier vacuum bag rolls suited to packing frozen food for export.', '耐寒、高阻隔的真空袋卷，适合出口冷冻食品包装。'],
    ['10ロール/箱', '10 rolls/box', '10卷/箱'], ['北海道', 'Hokkaido', '北海道'], ['熊本県', 'Kumamoto', '熊本县'], ['栃木県', 'Tochigi', '枥木县'], ['愛媛県', 'Ehime', '爱媛县'], ['青森県', 'Aomori', '青森县'], ['福岡県', 'Fukuoka', '福冈县'],
    ['静岡県', 'Shizuoka', '静冈县'], ['香川県', 'Kagawa', '香川县'], ['鹿児島県', 'Kagoshima', '鹿儿岛县'], ['大阪府', 'Osaka', '大阪府'],
    ['冷凍', 'Frozen', '冷冻'], ['冷蔵', 'Chilled', '冷藏'], ['常温', 'Ambient', '常温'], ['輸出証明書', 'Export certificate', '出口证明书'], ['産地証明', 'Origin certificate', '产地证明'], ['有機JAS', 'JAS Organic', '有机JAS'], ['ハラール', 'Halal', '清真'],
    ['ケース', 'case', '箱'], ['ロール', 'roll', '卷'],
    // 通知・メッセージの初期データ
    ['Sunrise Trading 第2倉庫', 'Sunrise Trading 2nd Warehouse', 'Sunrise Trading 第二仓库'], ['年間契約を想定しています。', 'We are considering an annual contract.', '我们计划签订年度合同。'], ['バイヤー', 'Buyer', '买家'], ['H-LINK 担当', 'H-LINK Staff', 'H-LINK 负责人'], ['H-LINK 社内', 'H-LINK Internal', 'H-LINK 内部'],
    ['お気に入りの「国産和牛 サーロイン」の在庫が更新されました', 'Stock was updated for your favorite "Japanese Wagyu Sirloin"', '您收藏的“日本和牛 西冷”库存已更新'], ['が出荷されました', ' has shipped', ' 已发货'],
    ['この商品の輸出に必要な書類について教えていただけますか？', 'Could you tell me which documents are required to export this product?', '请问出口这款商品需要哪些文件？'],
    ['お問い合わせありがとうございます。', 'Thank you for your inquiry.', '感谢您的咨询。'], ['輸出証明書・原産地証明書の発行が可能です。', 'We can issue an export certificate and a certificate of origin.', '我们可以开具出口证明书和原产地证明书。'], ['詳しい手続きについてご案内いたします。', 'We will guide you through the procedure.', '我们将为您详细说明办理流程。'],
    ['輸出関連資料.pdf', 'Export documents.pdf', '出口相关资料.pdf'], ['サーロインの次回ロットは来週入荷予定です。ご希望数量をお知らせください。', 'The next sirloin lot arrives next week. Please let us know your desired quantity.', '西冷的下一批货预计下周到货，请告知您需要的数量。'],
    ['輸出に必要な書類（輸出証明書・原産地証明書・インボイス等）をご用意できます。仕向国をお知らせください。', 'We can prepare the required export documents (export certificate, certificate of origin, invoice, etc.). Please tell us the destination country.', '我们可以准备出口所需文件（出口证明书、原产地证明书、发票等），请告知目的国。'],
    ['ご数量に応じた卸価格をご案内します。希望数量と納期をお知らせいただければ、見積を作成します。', 'We offer wholesale prices by quantity. Tell us your quantity and delivery date and we will prepare a quote.', '我们将按数量提供批发价。请告知数量与交期，我们为您制作报价。'],
    ['サンプル対応可能です。商品ページの「サンプル依頼」からお申し込みください。', 'Samples are available. Please apply from "Request a sample" on the product page.', '可提供样品。请在商品页面通过“样品申请”提交。'],
    ['在庫状況と納期を確認して、本日中にご連絡いたします。', 'We will check stock and lead time and get back to you today.', '我们将确认库存与交期，并于今日内联系您。'], ['お問い合わせありがとうございます。担当者が確認のうえ、改めてご連絡いたします。', 'Thank you for your inquiry. Our representative will check and contact you again.', '感谢您的咨询。负责人确认后会再与您联系。'],
    // 通知・トースト
    ['からメッセージが届きました', ' sent you a message', ' 发来了消息'], ['お気に入りから削除しました', 'Removed from favorites', '已从收藏中删除'], ['お気に入りに追加しました', 'Added to favorites', '已加入收藏'],
    ['を受け付けました', ' received', ' 已受理'], ['注文を受け付けました', 'Order received', '订单已受理'], ['を送信しました', ' sent', ' 已发送'], ['見積依頼を送信しました', 'Quote request sent', '报价申请已发送'],
    ['前回と同じ内容で再注文しました', 'Reordered with the same details as last time', '已按上次相同内容再次下单'], ['数量を入力してください', 'Please enter a quantity', '请输入数量'],
    ['送付先を選択してください（アカウント設定で住所を追加できます）', 'Please select a delivery address (you can add one in Account settings)', '请选择收货地址（可在账户设置中添加）'],
    ['アカウント情報を保存しました', 'Account information saved', '账户信息已保存'], ['住所を追加しました', 'Address added', '地址已添加'], ['デモデータを初期化しました', 'Demo data has been reset', '演示数据已重置'],
    // モーダル・フォーム
    ['注文内容の確認', 'Confirm your order', '确认订单内容'], ['最小ロット', 'Min. lot', '最小起订量'], ['単価', 'Unit price', '单价'], ['合計（税抜）', 'Total (excl. tax)', '合计（不含税）'], ['希望納品日', 'Desired delivery date', '期望交货日'],
    ['キャンセル', 'Cancel', '取消'], ['注文を確定する', 'Place order', '确认下单'], ['見積依頼', 'Quote request', '报价申请'], ['希望数量', 'Desired quantity', '期望数量'], ['数量', 'Quantity', '数量'], ['仕向国', 'Destination country', '目的国'],
    ['メッセージ（任意）', 'Message (optional)', '留言（选填）'], ['希望納期、貿易条件（FOB/CIF など）、年間見込み数量など', 'Desired lead time, trade terms (FOB/CIF, etc.), expected annual volume, etc.', '期望交期、贸易条件（FOB/CIF等）、年预计用量等'],
    ['見積を依頼する', 'Request a quote', '提交报价申请'],     // ヘッダー・メニュー
    ['本文へスキップ', 'Skip to content', '跳到正文'], ['メニューを開閉', 'Toggle menu', '展开/收起菜单'], ['前のページへ戻る', 'Back to previous page', '返回上一页'], ['次のページへ進む', 'Forward to next page', '前进到下一页'], ['戻る', 'Back', '返回'], ['進む', 'Forward', '前进'],
    ['商品名・キーワード・産地で検索', 'Search by product, keyword or origin', '按商品名、关键词、产地搜索'], ['商品検索', 'Product search', '商品搜索'], ['検索', 'Search', '搜索'], ['会社サイトへ', 'Company website', '前往公司网站'], ['会社サイト', 'Company site', '公司网站'],
    ['言語', 'Language', '语言'], ['通知', 'Notifications', '通知'], ['すべて既読にする', 'Mark all as read', '全部标为已读'], ['通知はありません', 'No notifications', '暂无通知'],
    ['アカウント設定', 'Account settings', '账户设置'], ['使い方ガイド', 'User guide', '使用指南'], ['ログアウト', 'Log out', '退出登录'], ['ダッシュボード', 'Dashboard', '控制面板'], ['商品を探す', 'Find products', '查找商品'], ['カテゴリー', 'Categories', '分类'],
    ['お気に入り', 'Favorites', '收藏'], ['見積・サンプル依頼', 'Quotes & samples', '报价・样品申请'], ['発注履歴', 'Order history', '订单记录'], ['メッセージ', 'Messages', '消息'], ['デモデータを初期化', 'Reset demo data', '重置演示数据'],
    ['お気に入り・注文・メッセージなどを初期状態に戻します。', 'Restores favorites, orders, messages and more to their initial state.', '将收藏、订单、消息等恢复到初始状态。'], ['初期化する', 'Reset', '重置'],
    ['DEMO版・関係者限定', 'DEMO / Authorized users only', '演示版・仅限相关人员'], ['メインメニュー', 'Main menu', '主菜单'], ['H-LINK トップへ', 'H-LINK home', 'H-LINK 首页'], ['閉じる', 'Close', '关闭'], ['前へ', 'Previous', '上一张'], ['次へ', 'Next', '下一张'], ['スライド', 'Slide', '幻灯片'],
    ['ファイルを添付', 'Attach a file', '添加附件'], ['送信', 'Send', '发送'], ['一覧へ戻る', 'Back to list', '返回列表'], ['キーワード', 'Keyword', '关键词'], ['並び替え', 'Sort', '排序'], ['新しい住所', 'New address', '新地址'],
    // ログイン
    ['バイヤーポータル ログイン', 'Buyer Portal Login', '买家门户登录'], ['社内および卸の関係者専用です。発行されたIDとパスワードでログインしてください。', 'For internal staff and wholesale partners only. Log in with the ID and password issued to you.', '仅限公司内部及批发相关人员使用。请使用已发放的ID和密码登录。'],
    ['ログインID', 'Login ID', '登录ID'], ['パスワード', 'Password', '密码'], ['ログイン', 'Log in', '登录'], ['セッションは一定時間操作がないと自動的にログアウトされます。', 'You are logged out automatically after a period of inactivity.', '一段时间无操作将自动退出登录。'],
    ['IDまたはパスワードが正しくありません。', 'The ID or password is incorrect.', 'ID或密码不正确。'], ['ログインIDとパスワードを入力してください。', 'Please enter your login ID and password.', '请输入登录ID和密码。'],
    ['ログイン試行が多すぎます。しばらくしてからお試しください。', 'Too many attempts. Please try again later.', '尝试次数过多，请稍后再试。'], ['一定時間操作がなかったため、ログアウトしました。', 'You were logged out because of inactivity.', '因长时间未操作，已退出登录。'],
    ['ログアウトしました。', 'You have been logged out.', '已退出登录。'], ['まもなく自動ログアウトされます。操作を続けると延長されます。', 'You will be logged out soon. Keep using the page to stay signed in.', '即将自动退出登录。继续操作可延长时间。'],
    ['社内担当', 'Internal staff', '内部负责人'], ['バイヤー（卸関係者）', 'Buyer (wholesale partner)', '买家（批发相关方）'], ['社内', 'Internal', '内部'],
    // ダッシュボード
    ['H-LINK つなぐ、越える、食の可能性をひらく。', 'H-LINK: Connect, go beyond, open up the possibilities of food.', 'H-LINK 连接、超越，开启食品的无限可能。'], ['食でつながる価値を、もっと大きく。 FOOD CONNECTS A BRIGHTER TOMORROW', 'Growing the value food connects. FOOD CONNECTS A BRIGHTER TOMORROW', '让美食连接的价值更加远大。 FOOD CONNECTS A BRIGHTER TOMORROW'],
    ['H-LINK ブランドビジュアル', 'H-LINK brand visuals', 'H-LINK 品牌视觉'], ['日本の食と、新たなビジネスの可能性を。', 'Japanese food and new business possibilities.', '日本美食，与全新的商业可能。'], ['すべてのカテゴリー', 'All categories', '全部分类'], ['産地', 'Origin', '产地'],
    ['ようこそ、', 'Welcome, ', '欢迎，'], ['様', '', ''], ['本日の取引状況', 'Today\'s activity', '今日交易情况'], ['進行中の注文はありません', 'No orders in progress', '暂无进行中的订单'], ['進行中の注文', 'Orders in progress', '进行中的订单'],
    ['見積・サンプル対応中', 'Quotes & samples in progress', '报价・样品处理中'], ['未読メッセージ', 'Unread messages', '未读消息'], ['人気のカテゴリー', 'Popular categories', '热门分类'], ['すべて見る', 'View all', '查看全部'], ['発注履歴へ', 'Go to order history', '前往订单记录'],
    ['お気に入りから再注文', 'Reorder from favorites', '从收藏再次下单'], ['お気に入りへ', 'Go to favorites', '前往收藏'], ['お気に入りがまだありません。', 'You have no favorites yet.', '还没有收藏。'], ['お気に入りがまだありません', 'You have no favorites yet', '还没有收藏'],
    ['再注文', 'Reorder', '再次下单'], ['おすすめ商品', 'Recommended products', '推荐商品'], ['商品一覧へ', 'Go to product list', '前往商品列表'], ['食でつながる価値を、', 'Growing the value', '让美食连接的价值，'], ['もっと大きく。', 'that food connects.', '更加远大。'],
    ['H-LINK は、国内外のバイヤーと日本の食をつなぐ B2B マーケットプレイスです。商品探しから見積・サンプル・発注・配送までを、ひとつの画面で。', 'H-LINK is a B2B marketplace connecting buyers in Japan and overseas with Japanese food. From product search to quotes, samples, orders and delivery, all on one screen.', 'H-LINK 是连接国内外买家与日本美食的B2B交易平台。从商品查找、报价、样品、下单到配送，一个页面全部搞定。'],
    ['サプライヤーに相談', 'Talk to a supplier', '咨询供应商'], ['日本の食の価値を、世界の食卓へ。', 'Bringing the value of Japanese food to tables around the world.', '把日本美食的价值，送上世界的餐桌。'],
    ['H-LINK は、国内外のバイヤーと日本の食をつなぎ、新たなビジネスと食の可能性を創造します。', 'H-LINK connects buyers in Japan and overseas with Japanese food, creating new business and new possibilities for food.', 'H-LINK 连接国内外买家与日本美食，创造全新的商业与美食可能。'],
    ['多様な', 'Diverse', '多样的'], ['サプライヤー', 'suppliers', '供应商'], ['世界のバイヤーと', 'Connect with', '与全球买家'], ['つながる', 'buyers worldwide', '建立联系'], ['安定した', 'Stable', '稳定的'], ['供給', 'supply', '供应'], ['高品質な', 'High-quality', '高品质的'], ['日本の食', 'Japanese food', '日本美食'],
    ['カテゴリーから商品を探せます。', 'Browse products by category.', '可按分类查找商品。'], ['商品検索・カテゴリーフィルター', 'Product search & category filter', '商品搜索・分类筛选'], ['豊富なカテゴリと詳細な条件で、目的の商品をすばやく検索。', 'Find what you need quickly with rich categories and detailed filters.', '丰富的分类与详细条件，快速找到目标商品。'],
    ['条件をクリア', 'Clear filters', '清除条件'], ['カテゴリーを絞り込む', 'Filter by category', '按分类筛选'], ['価格帯', 'Price range', '价格带'], ['認証・規格', 'Certification', '认证・规格'], ['新着順', 'Newest', '最新'], ['価格が安い順', 'Price: low to high', '价格从低到高'], ['最小ロットが小さい順', 'Min. lot: small to large', '起订量从小到大'],
    ['条件に合う商品が見つかりませんでした。条件を変更してください。', 'No products match your criteria. Please change the filters.', '没有符合条件的商品，请更改条件。'], ['商品が見つかりません。', 'Product not found.', '未找到该商品。'], ['検索結果', 'Results', '搜索结果'], ['商品', 'Product', '商品'],
    // 商品詳細
    ['商品詳細・卸価格・在庫・MOQ', 'Product details, wholesale price, stock & MOQ', '商品详情・批发价・库存・MOQ'], ['MOQ・卸価格・在庫状況をわかりやすく表示。安心して商談を進められます。', 'MOQ, wholesale prices and stock at a glance, so you can negotiate with confidence.', '清晰展示MOQ、批发价与库存状况，让洽谈更安心。'],
    ['（日本）', ' (Japan)', '（日本）'], ['最小ロット（MOQ）', 'Minimum order (MOQ)', '最小起订量（MOQ）'], ['在庫状況', 'Stock status', '库存状况'], ['在庫あり', 'In stock', '有库存'], ['残りわずか', 'Low stock', '库存紧张'], ['予約受付', 'Pre-order', '接受预订'],
    ['荷姿', 'Packing', '包装'], ['賞味期限', 'Shelf life', '保质期'], ['納期目安', 'Lead time', '交期参考'], ['卸価格（税抜）', 'Wholesale price (excl. tax)', '批发价（不含税）'], ['概算合計（税抜）', 'Estimated total (excl. tax)', '预估合计（不含税）'],
    ['サンプル依頼', 'Request a sample', '样品申请'], ['注文する', 'Order', '下单'], ['サプライヤーに問い合わせる', 'Contact the supplier', '联系供应商'], ['適用単価', 'Applied unit price', '适用单价'], ['同じカテゴリーの商品', 'More in this category', '同分类商品'], ['以上', 'and above', '以上'],
    // サンプル
    ['サンプル依頼フロー', 'Sample request flow', '样品申请流程'], ['簡単なステップでサンプルを依頼。商談の第一歩をスムーズに。', 'Request samples in a few easy steps and make the first step of your negotiation smooth.', '简单几步即可申请样品，顺畅迈出洽谈的第一步。'],
    ['入力', 'Enter', '填写'], ['確認', 'Review', '确认'], ['サンプル内容', 'Sample contents', '样品内容'], ['サンプル希望数量', 'Sample quantity', '样品数量'], ['送付先', 'Ship to', '收货地址'], ['希望到着時期', 'Desired arrival', '期望到货时间'],
    ['最短で希望', 'As soon as possible', '尽快'], ['1週間以内', 'Within 1 week', '1周内'], ['2週間以内', 'Within 2 weeks', '2周内'], ['1か月以内', 'Within 1 month', '1个月内'], ['品質確認のため、サンプルを希望します。', 'We would like a sample to check the quality.', '为确认品质，希望获得样品。'],
    ['個（セット）', ' set(s)', '套'], ['確認画面へ', 'Go to review', '前往确认页'], ['※ サンプルの送料・輸出手続きの条件はサプライヤーより別途ご案内します。', '* The supplier will separately inform you of sample shipping fees and export procedures.', '※ 样品运费及出口手续条件将由供应商另行告知。'],
    ['修正する', 'Edit', '修改'], ['この内容で依頼する', 'Submit request', '按此内容提交'], ['サンプル依頼を受け付けました', 'Sample request received', '样品申请已受理'], ['依頼番号', 'Request no.', '申请编号'], ['サプライヤーからの連絡をお待ちください。', 'Please wait to hear from the supplier.', '请等待供应商联系。'],
    ['依頼状況を見る', 'View request status', '查看申请状态'], ['商品検索へ戻る', 'Back to product search', '返回商品搜索'], 
    ['依頼の状況を一覧で確認できます。', 'See the status of your requests in one list.', '可在列表中查看申请状态。'], ['依頼日', 'Requested on', '申请日'], ['ステータス', 'Status', '状态'], ['依頼はまだありません', 'No requests yet', '暂无申请'],
    // お気に入り・再注文
    ['お気に入りリスト・再注文', 'Favorites & reorder', '收藏列表・再次下单'], ['よく見る商品をお気に入りに保存。過去の注文からワンクリックで再注文。', 'Save frequently viewed products as favorites and reorder past orders in one click.', '收藏常看的商品，从历史订单一键再次下单。'],
    ['前回', 'Last order', '上次'], ['ワンクリック再注文', 'One-click reorder', '一键再次下单'], ['注文履歴がありません', 'No order history', '暂无订单记录'],
    // チャット
    ['問い合わせ・チャット', 'Inquiries & chat', '咨询・聊天'], ['サプライヤーに直接問い合わせ。商談や輸出に関する相談もスムーズに。', 'Contact suppliers directly. Discussions about deals and exports go smoothly.', '直接向供应商咨询，洽谈与出口事宜更顺畅。'],
    ['サプライヤーへ最初のメッセージを送りましょう。', 'Send your first message to the supplier.', '向供应商发送第一条消息吧。'], ['入力中…', 'Typing…', '正在输入…'], ['左の一覧からサプライヤーを選択してください。', 'Select a supplier from the list on the left.', '请从左侧列表选择供应商。'],
    ['メッセージを入力…', 'Type a message…', '输入消息…'], ['新しいチャット', 'New chat', '新聊天'], ['[添付]', '[Attachment]', '[附件]'], ['サプライヤー', 'Supplier', '供应商'],
    // 注文
    ['注文・発注履歴・ステータス追跡', 'Orders, history & status tracking', '订单・订单记录・状态跟踪'], ['注文状況をリアルタイムで確認。出荷から納品まで、安心のトラッキング。', 'Check order status in real time, with reliable tracking from shipment to delivery.', '实时查看订单状态，从发货到交付全程跟踪。'],
    ['すべて', 'All', '全部'], ['進行中', 'In progress', '进行中'], ['過去の注文', 'Past orders', '历史订单'], ['注文日', 'Order date', '下单日'], ['注文番号', 'Order no.', '订单号'], ['金額（税抜）', 'Amount (excl. tax)', '金额（不含税）'], ['該当する注文はありません', 'No matching orders', '没有符合条件的订单'],
    ['配送ステータス', 'Delivery status', '配送状态'], ['同じ内容で再注文', 'Reorder same details', '按相同内容再次下单'], ['注文', 'Order', '订单'],
    // アカウント
    ['会社情報・送付先・通知を管理します。', 'Manage company details, delivery addresses and notifications.', '管理公司信息、收货地址和通知。'], ['会社・担当者情報', 'Company & contact', '公司・负责人信息'], ['会社名', 'Company name', '公司名称'], ['担当者名', 'Contact name', '负责人姓名'], ['国・地域', 'Country / region', '国家・地区'],
    ['メールアドレス', 'Email address', '电子邮箱'], ['電話番号', 'Phone number', '电话号码'], ['保存する', 'Save', '保存'], ['送付先住所', 'Delivery addresses', '收货地址'], ['追加', 'Add', '添加'], ['削除', 'Delete', '删除'], ['登録された住所はありません', 'No registered addresses', '暂无已登记地址'],
    ['会社名 / 住所', 'Company / address', '公司名称 / 地址'], ['通知設定', 'Notification settings', '通知设置'], ['注文・配送ステータスの更新', 'Order and delivery status updates', '订单・配送状态更新'], ['見積・サンプルの回答', 'Replies to quotes and samples', '报价・样品回复'],
    ['メッセージの受信', 'Incoming messages', '收到消息'], ['お知らせ・新着商品', 'News and new products', '通知・新品上架'],
    ['お気に入り・再注文', 'Favorites & reorder', '收藏・再次下单'], ['商品詳細', 'Product details', '商品详情'],
    ['バイヤーポータル', 'Buyer Portal', '买家门户'], ['卸受注ダッシュボード', 'Wholesale order dashboard', '批发订单控制面板'],
    // 共通
    ['配送ステータス', 'Delivery status', '配送状态'], ['製造準備', 'Preparation', '生产准备'],
  ];
  const UNIT = { '箱': ['box', '箱'], 'ケース': ['case', '箱'], '本': ['bottle', '瓶'], 'ロール': ['roll', '卷'], '個': ['pc', '个'] };
  // 辞書より先に適用する文型ルール／辞書のあとに適用する単位ルール
  const PRE = [
    [/最小ロットは (.+?) です/g, l => l === 'en' ? 'Minimum order quantity is $1' : '最小起订量为 $1'],
    [/検索結果 (\d[\d,]*) 件/g, l => l === 'en' ? '$1 results' : '搜索结果 $1 件'],
    [/(\d[\d,]*) 商品/g, l => l === 'en' ? '$1 products' : '$1 种商品'],
    [/(\d[\d,]*) 件/g, l => l === 'en' ? '$1 items' : '$1 件'],
  ];
  const POST = [
    [/(\d[\d,]*)\s?(箱|ケース|本|ロール|個)/g, l => (m, n, u) => `${n} ${UNIT[u][l === 'en' ? 0 : 1]}`],
    [/\/(箱|ケース|本|ロール|個)/g, l => (m, u) => '/' + UNIT[u][l === 'en' ? 0 : 1]],
    [/（(箱|ケース|本|ロール|個)）/g, l => (m, u) => ' (' + UNIT[u][l === 'en' ? 0 : 1] + ')'],
  ];
  const maps = { en: new Map(), zh: new Map() };
  D.forEach(([ja, en, zh]) => { maps.en.set(ja, en); maps.zh.set(ja, zh); });
  const keys = [...maps.en.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const dictRe = new RegExp(keys.join('|'), 'g');
  const JA = /[぀-ヿ一-鿿＀-￯]/;
  let lang = 'ja';

  function translate(str, l) {
    l = l || lang;
    if (l === 'ja' || !str || !JA.test(str)) return str;
    let s = str;
    for (const [re, f] of PRE) s = s.replace(re, f(l));
    s = s.replace(dictRe, m => maps[l].get(m));
    for (const [re, f] of POST) s = s.replace(re, f(l));
    if (l === 'en') s = s.replace(/（/g, ' (').replace(/）/g, ')').replace(/、/g, ', ').replace(/。/g, '. ').replace(/：/g, ': ').replace(/／/g, ' / ').replace(/・/g, ' / ').replace(/〜/g, '~').replace(/\s{2,}/g, ' ');
    else s = s.replace(/〜/g, '～');
    return s;
  }

  // DOM への適用（元の日本語は保持して、言語を戻せるようにする）
  const origText = new WeakMap();
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const skip = n => n.parentElement && n.parentElement.closest('[data-notr],script,style,textarea');
  function tNode(n) {
    if (skip(n)) return;
    if (!origText.has(n)) origText.set(n, n.nodeValue);
    const o = origText.get(n), v = translate(o);
    if (n.nodeValue !== v) n.nodeValue = v;
  }
  function tEl(el) {
    if (el.nodeType !== 1 || el.closest('[data-notr]')) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const k = 'data-o-' + a;
      if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
      const v = translate(el.getAttribute(k));
      if (el.getAttribute(a) !== v) el.setAttribute(a, v);
    }
  }
  function apply(root) {
    root = root || document.body;
    if (root.nodeType === 3) { tNode(root); return; }
    tEl(root);
    root.querySelectorAll('*').forEach(tEl);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) tNode(n);
  }
  let busy = false;
  const mo = new MutationObserver(muts => {
    if (busy) return; busy = true;
    for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) apply(n); });
    busy = false;
  });
  function setLang(l) {
    if (!maps[l] && l !== 'ja') l = 'ja';
    lang = l;
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
    try { localStorage.setItem('hlink-lang', l); } catch { /* ignore */ }
    busy = true; apply(document.body); busy = false;
    document.title = translate(document.title.startsWith('H-LINK') ? 'H-LINK バイヤーポータル' : document.title);
    document.querySelectorAll('select.lang-sel').forEach(s => { s.value = l; });
  }
  function init() {
    let l = 'ja';
    try { l = localStorage.getItem('hlink-lang') || ''; } catch { /* ignore */ }
    if (!l) l = /^zh/i.test(navigator.language) ? 'zh' : /^en/i.test(navigator.language) ? 'en' : 'ja';
    mo.observe(document.body, { childList: true, subtree: true });
    setLang(l);
  }
  window.I18N = { translate: (s, l) => translate(s, l), setLang, get lang() { return lang; }, apply, init, all: s => [s, translate(s, 'en'), translate(s, 'zh')].join(' ') };
})();
