import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@cssltdcode/plugin/tui"
import { RemoteIndicator } from "@/cssltdcode/remote-tui"

const id = "internal:remote"

function View(props: { api: TuiPluginApi }) {
  return (
    <box flexShrink={0}>
      <RemoteIndicator
        sdk={{ client: props.api.client }}
        theme={props.api.theme.current}
        cssltd={true}
        event={props.api.event}
      />
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 51,
    slots: {
      session_prompt_right() {
        return <View api={api} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = { id, tui }

export default plugin
