import { createMemo, Match, Switch, type JSX } from "solid-js"
import { SplitBorder } from "@tui/ui/border"
import { useTheme } from "@tui/context/theme"
import { parseCssltdErrorCode, cssltdErrorTitle, cssltdErrorDescription } from "@/cssltdcode/cssltd-errors"
import type { AssistantMessage } from "@cssltdcode/sdk/v2"

interface CssltdErrorBlockProps {
  error: NonNullable<AssistantMessage["error"]>
  fallback: JSX.Element
}

export function CssltdErrorBlock(props: CssltdErrorBlockProps) {
  const { theme } = useTheme()

  const cssltdErrorCode = createMemo(() => {
    return parseCssltdErrorCode(props.error)
  })

  const title = createMemo(() => {
    const code = cssltdErrorCode()
    return code ? cssltdErrorTitle(code) : undefined
  })

  const description = createMemo(() => {
    const code = cssltdErrorCode()
    return code ? cssltdErrorDescription(code) : undefined
  })

  return (
    <Switch fallback={props.fallback}>
      <Match when={cssltdErrorCode()}>
        <box
          border={["left"]}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          marginTop={1}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.primary}
        >
          <text fg={theme.text}>{title()}</text>
          <text fg={theme.textMuted}>{description()}</text>
          <text fg={theme.primary}>{"Run /connect or `cssltd auth login` to connect to Cssltd Gateway"}</text>
        </box>
      </Match>
    </Switch>
  )
}
