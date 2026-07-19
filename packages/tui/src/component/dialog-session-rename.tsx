import { DialogPrompt } from "../ui/dialog-prompt"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { createMemo } from "solid-js"
import { useSDK } from "../context/sdk"

interface DialogSessionRenameProps {
  session: string
  title?: string // cssltdcode_change
  onConfirm?: () => void // cssltdcode_change
}

export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog()
  const sync = useSync()
  const sdk = useSDK()
  const session = createMemo(() => sync.session.get(props.session))

  return (
    <DialogPrompt
      title="Rename Session"
      value={session()?.title ?? props.title} // cssltdcode_change
      onConfirm={(value) => {
        void sdk.client.session
          .update({
            sessionID: props.session,
            title: value,
          })
          .then(() => props.onConfirm?.()) // cssltdcode_change
        dialog.clear()
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
