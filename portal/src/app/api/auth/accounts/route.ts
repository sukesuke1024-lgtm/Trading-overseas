import { employees, loadDb, roleOfServer } from "@/server/db";
import { readAuthLog } from "@/server/authlog";
import { json, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** 管理者：ID・PINの状態・再設定URLの発行履歴の台帳。PINそのものは誰にも見えない（ハッシュ化のみ保管） */
export async function GET(req: Request) {
  const me = sessionUser(req);
  if (!me || roleOfServer(me) !== "admin") return json({ error: "forbidden" }, 403);
  const db = loadDb(), log = readAuthLog().entries;
  const rows = employees().map((e) => {
    const u = db.users[e.id];
    const mine = log.filter((x) => (x.event === "pin_reset_link_issued" || x.event === "pin_reset_to_initial" ? x.detail === e.id : x.actor === e.id));
    const last = (ev: string) => [...mine].reverse().find((x) => x.event === ev);
    const history = mine.filter((x) => ["pin_reset_link_issued", "pin_reset_to_initial", "pin_reset_done", "pin_changed", "pin_reset_requested", "pin_reset_admin_request"].includes(x.event)).slice(-20).reverse().map((x) => ({ at: x.at, by: x.actor === e.id ? "本人" : x.actor, kind: x.event }));
    const issued = mine.filter((x) => x.event === "pin_reset_link_issued");
    return {
      id: e.id, name: e.name, role: e.role, dept: e.dept ?? "", left: e.left ?? "",
      pin: !u ? "未作成" : u.mustChange ? "初期PIN（未変更）" : "本人設定済",
      pinChangedAt: (["pin_changed", "pin_reset_done"].map(last).filter(Boolean).sort((a, b) => b!.at.localeCompare(a!.at))[0])?.at ?? "",
      lastLoginAt: last("login_ok")?.at ?? "", enrolled: !!u?.totpEnrolled, locked: !!u && u.lockedUntil > Date.now(),
      urlIssued: issued.length, lastUrlAt: issued[issued.length - 1]?.at ?? "", lastUrlBy: issued[issued.length - 1]?.actor ?? "", history,
    };
  });
  return json({ rows, initialPinIsDefault: !process.env.PORTAL_INITIAL_PIN });
}
