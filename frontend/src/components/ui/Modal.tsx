import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  /** Qatlam (z-index) — bir modal ustida boshqasini ochish uchun. Masalan "z-[60]". */
  zClass?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg", zClass = "z-50" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 ${zClass} grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-md data-[state=open]:animate-fade-in`}>
          <Dialog.Content
            className={`relative ${zClass} w-full ${maxWidth}
              rounded-3xl border border-white/60 bg-white/95 p-6 shadow-float backdrop-blur-xl
              focus:outline-none max-h-[90vh] overflow-y-auto data-[state=open]:animate-scale-in`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <Dialog.Title className="font-display text-lg font-extrabold text-ink">
                {title}
              </Dialog.Title>
              <Dialog.Close className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink">
                <X size={18} />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-ink-faint">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand" />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}
