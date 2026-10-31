'use client';

import React, { useState, type FC, type ReactNode } from 'react';
import { Plus, X, Target, StickyNote, Bell } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export type CreateKind = 'goal' | 'note' | 'reminder';

const ITEMS: { kind: CreateKind; icon: ReactNode; label: string }[] = [
  { kind: 'goal', icon: <Target size={24} strokeWidth={1.5} />, label: 'Goal' },
  { kind: 'note', icon: <StickyNote size={24} strokeWidth={1.5} />, label: 'Note' },
  { kind: 'reminder', icon: <Bell size={24} strokeWidth={1.5} />, label: 'Reminder' },
];

export const CreateNewDisclosure: FC<{ onSelect: (kind: CreateKind) => void }> = ({
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!open ? (
        <motion.button
          key="collapsed"
          layoutId={reduce ? undefined : 'cnd-container'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          onClick={() => setOpen(true)}
          style={{ borderRadius: 32 }}
          transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-black/[0.04] bg-neutral-100 px-6 py-3 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
        >
          <Plus size={22} strokeWidth={1.75} className="text-neutral-900" />
          <motion.span layoutId={reduce ? undefined : 'cnd-label'}>
            Create New
          </motion.span>
        </motion.button>
      ) : (
        <motion.div
          key="expanded"
          layoutId={reduce ? undefined : 'cnd-container'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          style={{ borderRadius: 22 }}
          transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
          className="w-full max-w-[340px] rounded-[22px] border border-black/[0.06] bg-neutral-50 p-1 shadow-md"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <motion.span
              layoutId={reduce ? undefined : 'cnd-label'}
              className="text-[15px] font-semibold text-neutral-600"
            >
              Create New
            </motion.span>
            <motion.button
              onClick={() => setOpen(false)}
              whileTap={{ scale: 0.95 }}
              aria-label="Close"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-neutral-300 transition-colors hover:bg-neutral-400"
            >
              <X size={14} color="#ffffff" strokeWidth={2.5} />
            </motion.button>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-[18px] border border-black/[0.05] bg-white p-3 shadow-sm">
            {ITEMS.map((item) => (
              <button
                key={item.kind}
                onClick={() => {
                  setOpen(false);
                  onSelect(item.kind);
                }}
                className="group flex flex-col items-center gap-1.5 rounded-[16px] px-1 py-3.5 transition-colors hover:bg-neutral-100 cursor-pointer"
              >
                <span className="text-neutral-400 transition-colors group-hover:text-neutral-700">
                  {item.icon}
                </span>
                <span className="text-[13px] font-medium text-neutral-700">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
