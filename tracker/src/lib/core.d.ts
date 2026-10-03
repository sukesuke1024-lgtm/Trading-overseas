export type Mode = 'sea' | 'air' | 'domestic' | 'intl';
export type StageKey = 'booked' | 'picked_up' | 'departed' | 'in_transit' | 'arrived' | 'customs' | 'delivered';
export interface TrackEvent { at: string; text: string; place?: string }
export interface Shipment {
  mode: Mode; containerNo: string; stage: StageKey;
  bookingNo?: string; blNo?: string; carrier?: string; vessel?: string; voyage?: string;
  pol?: string; pod?: string; etd?: string; eta?: string; freeTimeEnd?: string;
  lot?: string; producer?: string; buyer?: string; note?: string;
  exception?: boolean; exceptionNote?: string; lastEventAt?: string; checkedAt?: string;
  position?: { lat: number; lon: number }; events?: TrackEvent[];
  updatedBy?: string; updatedAt?: string;
}
export interface Alert { level: 'danger' | 'warn'; text: string }
export interface Candidate { mode: Mode; carrier: string; valid: boolean }
export interface Place { name: string; lat: number; lon: number }
export const PORTS: Record<string, Place>;
export const MODES: Record<Mode, { name: string; short: string }>;
export const STAGE_KEYS: StageKey[];
export const CSV_COLS: string[];
export function stageLabels(mode: Mode): { key: StageKey; label: string }[];
export function normalizeNo(s: string): string;
export function isValidContainerNo(s: string): boolean;
export function isValidAwb(s: string): boolean;
export function isValidYamato(s: string): boolean;
export function isValidS10(s: string): boolean;
export function detect(input: string): Candidate[];
export function validFor(mode: Mode, no: string): boolean;
export function carrierOf(no: string, mode?: Mode): string;
export function stageIndex(key: string): number;
export function estimatePosition(s: Partial<Shipment>, now?: number): { lat: number; lon: number; p: number; actual: boolean } | null;
export function daysToEta(s: Partial<Shipment>, now?: number): number | null;
export function alertsFor(s: Shipment, now?: number): Alert[];
export function severity(s: Shipment, now?: number): 0 | 1 | 2;
export function migrate(s: Partial<Shipment>): Shipment;
export function applyUpdate(s: Shipment, up: Partial<Shipment> & { now?: number }): { shipment: Shipment; changed: boolean };
export function toCsv(list: Shipment[]): string;
export function parseCsv(text: string): Shipment[];
