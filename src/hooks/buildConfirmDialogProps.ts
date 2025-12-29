type ConfirmAction = unknown | null;

type Params = {
  confirmAction: ConfirmAction;
  setConfirmAction: React.Dispatch<React.SetStateAction<ConfirmAction>>;
  onCancel?: () => void;
  onConfirm?: () => void;
};

export default function buildConfirmDialogProps({ confirmAction, setConfirmAction, onCancel, onConfirm }: Params) {
  const handleCancel = onCancel ?? (() => setConfirmAction(null));
  const handleConfirm = onConfirm ?? (() => setConfirmAction(null));
  return {
    action: confirmAction,
    onCancel: handleCancel,
    onConfirm: handleConfirm
  };
}
