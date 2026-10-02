#!/bin/bash
# Mac：ダブルクリックで起動（初回は 右クリック→開く）。他の端末からも開く場合は末尾に --lan
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が見つかりません。https://nodejs.org/ から LTS を入れてから、もう一度開いてください。"
  read -r -p "Enterで閉じる"; exit 1
fi
node desktop/launch.mjs "$@"
read -r -p "終了しました。Enterで閉じる"
