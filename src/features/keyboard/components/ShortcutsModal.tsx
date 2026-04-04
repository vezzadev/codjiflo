import { Dialog, Modal, ModalOverlay, Heading } from 'react-aria-components';
import { Button as AriaButton } from 'react-aria-components';
import { getShortcutsList } from '../hooks';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying available keyboard shortcuts
 * S-1.5: AC-1.5.4, AC-1.5.5
 */
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const shortcuts = getShortcutsList();

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      className="modal-overlay"
    >
      <Modal className="modal-content">
        <Dialog aria-labelledby="shortcuts-title">
          <Heading slot="title" id="shortcuts-title" className="modal-title">
            Keyboard Shortcuts
          </Heading>

          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map(({ key, description }) => (
                <tr key={key}>
                  <td>
                    <kbd className="kbd">
                      {key}
                    </kbd>
                  </td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <AriaButton
            onPress={onClose}
            className="btn-colorful modal-close-btn"
          >
            Close
          </AriaButton>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
