import { useEffect, useRef, type ReactNode } from 'react';

// <dialog> の薄いラッパー。open=true で開き、閉じたら onClose を呼ぶ
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}>
      {open && <div className="dlg"><h2>{title}</h2>{children}</div>}
    </dialog>
  );
}

export function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return <label className={`field${full ? ' full' : ''}`}>{label}{children}</label>;
}

// 2回押しで確定する削除ボタン（誤操作防止）
export function ConfirmButton({ label, armedLabel, onConfirm, className = 'btn danger' }: { label: ReactNode; armedLabel: string; onConfirm: () => void; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const armed = useRef(false);
  return (
    <button ref={ref} type="button" className={className} onClick={() => {
      const b = ref.current; if (!b) return;
      if (armed.current) { armed.current = false; onConfirm(); return; }
      armed.current = true; b.classList.add('armed'); const t = b.textContent; b.textContent = armedLabel;
      setTimeout(() => { armed.current = false; if (ref.current) { ref.current.classList.remove('armed'); ref.current.textContent = t; } }, 4000);
    }}>{label}</button>
  );
}
