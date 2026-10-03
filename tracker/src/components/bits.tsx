import * as C from '../lib/core.js';
import type { Shipment } from '../lib/core.js';

export const portName = (c?: string) => (c && C.PORTS[c]?.name) || c || '—';
export const stageLabel = (s: Shipment) => C.stageLabels(s.mode)[C.stageIndex(s.stage)].label;

export function ModePill({ mode }: { mode: Shipment['mode'] }) {
  return <span className="pill mode" title={C.MODES[mode].name}>{C.MODES[mode].short}</span>;
}

export function Seg({ s }: { s: Shipment }) {
  const idx = C.stageIndex(s.stage);
  return (
    <span className="seg" aria-hidden="true">
      {C.STAGE_KEYS.map((k, i) => <i key={k} className={i < idx ? 'on' : i === idx ? 'cur' : ''} />)}
    </span>
  );
}

export function Status({ s }: { s: Shipment }) {
  const idx = C.stageIndex(s.stage);
  return <span><Seg s={s} />{idx >= 6 ? <span className="pill good">{stageLabel(s)}</span> : stageLabel(s)}</span>;
}

export function AlertPill({ s }: { s: Shipment }) {
  const a = C.alertsFor(s);
  if (!a.length) return null;
  const level = a.some((x) => x.level === 'danger') ? 'bad' : 'warn';
  return <span className={`pill ${level}`}>{a[0].text}{a.length > 1 ? ` ほか${a.length - 1}件` : ''}</span>;
}

// 簡易世界地図（等距円筒）。港・空港と現在位置（実績 or 推定）を描く
export function RouteMap({ s }: { s: Shipment }) {
  const W = 800, H = 380;
  const x = (lon: number) => ((lon + 180) / 360) * W;
  const y = (lat: number) => ((90 - lat) / 180) * H;
  const a = s.pol ? C.PORTS[s.pol] : undefined;
  const b = s.pod ? C.PORTS[s.pod] : undefined;
  if (!a || !b) return null;
  const pos = C.estimatePosition(s);
  const lons = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];
  const lats = [-60, -30, 0, 30, 60];
  return (
    <>
      <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${a.name}から${b.name}への経路`}>
        {lons.map((v) => <line key={`o${v}`} x1={x(v)} y1={0} x2={x(v)} y2={H} stroke="currentColor" opacity=".3" />)}
        {lats.map((v) => <line key={`a${v}`} x1={0} y1={y(v)} x2={W} y2={y(v)} stroke="currentColor" opacity=".3" />)}
        <line x1={x(a.lon)} y1={y(a.lat)} x2={x(b.lon)} y2={y(b.lat)} stroke="var(--brand)" strokeWidth={4} strokeDasharray="12 9" />
        {[a, b].map((p) => (
          <g key={p.name}>
            <circle cx={x(p.lon)} cy={y(p.lat)} r={9} fill="var(--text)" />
            <text x={Math.min(x(p.lon) + 14, W - 190)} y={y(p.lat) - 14} fill="var(--text)" fontSize={28} fontWeight={600}>{p.name}</text>
          </g>
        ))}
        {pos && <circle cx={x(pos.lon)} cy={y(pos.lat)} r={14} fill="var(--brand)" stroke="var(--surface)" strokeWidth={5} />}
      </svg>
      <div className="muted hint">{pos?.actual ? '位置は追跡サービスの実績値です。' : '位置は出発日〜ETAからの推定（目安）です。'}</div>
    </>
  );
}
