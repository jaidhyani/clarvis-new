interface ConfirmPermissionModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmPermissionModal({
  onConfirm,
  onCancel
}: ConfirmPermissionModalProps) {
  return (
    <div class="modal-overlay" onClick={onCancel}>
      <div class="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Confirm Permission Change</h3>
          <button class="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div class="modal-body">
          <p class="confirm-warning">
            Are you sure you want to enable <strong>Skip Permissions</strong> mode?
          </p>
          <p class="confirm-details">
            This will skip all permission checks for this session. Claude will be able to
            execute any action without asking for confirmation.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button class="btn-danger" onClick={onConfirm}>
            Enable Skip Permissions
          </button>
        </div>
      </div>
    </div>
  )
}
