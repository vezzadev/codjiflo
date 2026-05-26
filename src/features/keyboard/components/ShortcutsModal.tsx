import { getShortcutsList } from '../hooks';
import { Modal } from '@/components/ui';
import { Button } from '@/components/Button';

interface ShortcutsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/**
 * Modal displaying available keyboard shortcuts
 * S-1.5: AC-1.5.4, AC-1.5.5
 */
export function ShortcutsModal({ isOpen, onOpenChange }: ShortcutsModalProps) {
  const shortcuts = getShortcutsList();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} title="Keyboard Shortcuts">
      {({ close }) => (
        <>
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
                    <kbd className="kbd">{key}</kbd>
                  </td>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Button onPress={close} className="modal-close-btn">
            Close
          </Button>
        </>
      )}
    </Modal>
  );
}
