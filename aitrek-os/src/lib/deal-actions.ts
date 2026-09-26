import { changeStage, log } from "./automation";
import { isWon, stageLabel } from "./constants";
import type { Tx } from "./store/tx";
import type { Deal, DealStage } from "./types";
import type { Action } from "./permissions";

type Run = <R>(fn: (tx: Tx) => R, opts?: { need?: Action; ok?: string }) => R | undefined;

/**
 * Status 変更の共通処理。
 * Contract 以降へ進める場合、未承認の契約は Owner/Admin の「契約承認」を必要とする（AI・一般メンバーは確定できない）。
 */
export function moveDeal(run: Run, deal: Deal, stage: DealStage) {
  if (deal.stage === stage) return;
  const needsApproval = isWon(stage) && !deal.contract_approved;
  return run(
    (tx) => {
      if (needsApproval) {
        tx.update("deals", deal.id, { contract_approved: true });
        log(tx, "approval", `契約承認（${stageLabel(stage)} へ移行）`, { deal_id: deal.id });
      }
      return changeStage(tx, tx.find("deals", deal.id)!, stage);
    },
    { need: needsApproval ? "contract.approve" : "record.edit", ok: `${deal.code} を ${stageLabel(stage)} に移動しました` },
  );
}
