/**
 * Cssltd Gateway Team Selection Dialog
 *
 * Allows switching between organizations and personal account.
 * Marks the current team with "→ (current)" indicator.
 */

import { DialogSelect } from "@tui/ui/dialog-select"
import type { Organization } from "@cssltdcode/cssltd-gateway"
import { getOrganizationOptions } from "@cssltdcode/cssltd-gateway/tui"

interface DialogCssltdTeamSelectProps {
  organizations: Organization[]
  currentOrgId?: string | null
  hasPersonalAccount?: boolean
  onSelect: (orgId: string | null) => Promise<void>
}

export function DialogCssltdTeamSelect(props: DialogCssltdTeamSelectProps) {
  // Get formatted options with current markers
  const options = getOrganizationOptions(
    props.organizations,
    props.currentOrgId || undefined,
    props.hasPersonalAccount !== false,
  )

  return (
    <DialogSelect
      title="Select Team"
      options={options}
      current={props.currentOrgId || null}
      onSelect={async (option: any) => {
        await props.onSelect(option.value)
      }}
    />
  )
}
