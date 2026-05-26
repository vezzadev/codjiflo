'use client';

import { ReactNode } from 'react';
import {
  ModalOverlay,
  Modal as RAModal,
  Dialog,
  Heading,
} from 'react-aria-components';

export interface ModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  isDismissable?: boolean;
  className?: string;
  children: ReactNode | ((opts: { close: () => void }) => ReactNode);
}

export function Modal({
  isOpen,
  onOpenChange,
  title,
  isDismissable = true,
  className,
  children,
}: ModalProps) {
  const modalClass = ['modal-content', className].filter(Boolean).join(' ');
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className="modal-overlay"
    >
      <RAModal className={modalClass}>
        <Dialog>
          {({ close }) => (
            <>
              <Heading slot="title" className="modal-title">
                {title}
              </Heading>
              {typeof children === 'function' ? children({ close }) : children}
            </>
          )}
        </Dialog>
      </RAModal>
    </ModalOverlay>
  );
}
