import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';

interface CopyBookmarkFallbackDialogProps {
  // The bookmark name to show, or null when the dialog is hidden. Used on insecure
  // HTTP where the Clipboard API is unavailable, so the user can select + copy manually.
  name: string | null;
  onHide: () => void;
}

export const CopyBookmarkFallbackDialog = ({ name, onHide }: CopyBookmarkFallbackDialogProps) => (
  <Dialog
    header="Copy bookmark name"
    visible={name !== null}
    onHide={onHide}
    dismissableMask
    style={{ width: '320px' }}
  >
    <InputText readOnly value={name ?? ''} autoFocus className="w-full" onFocus={e => e.currentTarget.select()} />
    <p className="mt-2 text-xs text-stone-400">Press Ctrl+C to copy.</p>
  </Dialog>
);
