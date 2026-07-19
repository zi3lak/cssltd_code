import { useTerminalDimensions } from "@opentui/solid" // cssltdcode_change
import { createEffect, createMemo, createSignal, Show } from "solid-js" // cssltdcode_change
import { useLocal } from "../context/local"
import { useSync } from "../context/sync"
import { map, pipe, flatMap, entries, filter, sortBy, take, groupBy } from "remeda" // cssltdcode_change
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider"
import { DialogVariant } from "./dialog-variant"
import type { Model } from "@cssltdcode/sdk/v2" // cssltdcode_change
import * as fuzzysort from "fuzzysort"
import { useConnected } from "./use-connected"
import { ModelInfoPanel } from "@/cssltdcode/components/model-info-panel" // cssltdcode_change
import { FreeModelDisclosure } from "@/cssltdcode/components/free-model-disclosure" // cssltdcode_change

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const [query, setQuery] = createSignal("")
  const dimensions = useTerminalDimensions() // cssltdcode_change

  const connected = useConnected()
  const providers = createDialogProviderOptions()
  // cssltdcode_change start
  // Memoize anything that iterates all Cssltd models to avoid calculating it for
  // each Cssltd model and tanking the UI at a couple hundred models
  const cssltdRank = createMemo(() => {
    const provider = sync.data.provider.find((provider) => provider.id === "cssltd")
    const models = provider?.models ?? {}
    return new Map(Object.entries(models).map(([id, info]) => [id, info.recommendedIndex ?? Infinity] as const))
  })
  // cssltdcode_change end

  const showExtra = createMemo(() => connected() && !props.providerID)

  // cssltdcode_change start
  const wide = createMemo(() => dimensions().width >= 108)
  const [preview, setPreview] = createSignal<{
    model: Model
    provider: string
  }>()

  const lookup = (providerID: string, modelID: string) => {
    const provider = sync.data.provider.find((x) => x.id === providerID)
    const model = provider?.models[modelID]
    if (!provider || !model) return
    return {
      model,
      provider: provider.name,
    }
  }

  createEffect(() => {
    dialog.setSize(wide() ? "xlarge" : "large")
  })

  createEffect(() => {
    const current = local.model.current()
    if (!current) return
    const next = lookup(current.providerID, current.modelID)
    if (!next) return
    setPreview(next)
  })

  const footer = (providerID: string, model: Model) => {
    const labels = [
      providerID === "cssltd" && FreeModelDisclosure.hasByok(model) ? FreeModelDisclosure.byok : undefined,
      providerID === "cssltd" && FreeModelDisclosure.collectsData(model) ? FreeModelDisclosure.label : undefined,
      model.cost?.input === 0 && providerID === "cssltdcode" ? "Free" : undefined,
    ].filter((label) => label !== undefined)
    return labels.length > 0 ? labels.join(" · ") : undefined
  }
  // cssltdcode_change end

  const options = createMemo(() => {
    const needle = query().trim()
    // cssltdcode_change: removed showSections guard — sections are always built; empty ones are hidden naturally
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function toOptions(items: typeof favorites, category: string) {
      if (!showExtra()) return [] // cssltdcode_change
      return items.flatMap((item) => {
        const provider = sync.data.provider.find((provider) => provider.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        return [
          {
            key: item,
            value: { providerID: provider.id, modelID: model.id },
            title: model.name ?? item.modelID,
            description: provider.name,
            category,
            disabled: provider.id === "cssltdcode" && model.id.includes("-nano"),
            footer: footer(provider.id, model), // cssltdcode_change
            onSelect: () => {
              onSelect(provider.id, model.id) // cssltdcode_change
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const providerOptions = pipe(
      sync.data.provider,
      sortBy(
        (provider) => provider.id !== "cssltdcode",
        (provider) => provider.name,
      ),
      flatMap((provider) =>
        pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)),
          map(([model, info]) => ({
            value: { providerID: provider.id, modelID: model },
            title: info.name ?? model,
            releaseDate: info.release_date,
            description: favorites.some((item) => item.providerID === provider.id && item.modelID === model)
              ? "(Favorite)"
              : undefined,
            // cssltdcode_change start
            category: connected()
              ? provider.id === "cssltd" && info.recommendedIndex !== undefined
                ? "Recommended"
                : provider.name
              : undefined,
            // cssltdcode_change end
            disabled: provider.id === "cssltdcode" && model.includes("-nano"),
            footer: footer(provider.id, info), // cssltdcode_change
            onSelect() {
              onSelect(provider.id, model) // cssltdcode_change
            },
          })),
          filter((option) => {
            // cssltdcode_change start - only dedupe favorites/recents when those sections are visible
            if (showExtra()) {
              if (
                favorites.some(
                  (item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID,
                )
              )
                return false
              if (
                recents.some(
                  (item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID,
                )
              )
                return false
            }
            // cssltdcode_change end
            return true
          }),
          (options) => sortModelOptions(options, props.providerID !== undefined, cssltdRank()), // cssltdcode_change
        ),
      ),
    )

    const popularProviders = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: "Popular providers",
          })),
          take(6),
        )
      : []

    // cssltdcode_change start - Filter per-section to preserve group headers while typing
    if (needle) {
      const rank = <U extends { title: string; category?: string }>(items: U[]) =>
        fuzzysort.go(needle, items, { keys: ["title", "category"] }).map((x) => x.obj)
      // rank within each provider category to preserve category order
      const rankedProviders = pipe(
        providerOptions,
        groupBy((x) => x.category ?? ""),
        entries(),
        flatMap(([_, items]) => rank(items)),
      )
      return [...rank(favoriteOptions), ...rank(recentOptions), ...rankedProviders, ...rank(popularProviders)]
    }
    // cssltdcode_change end

    return [...favoriteOptions, ...recentOptions, ...providerOptions, ...popularProviders]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((item) => item.id === props.providerID) : null,
  )

  const title = createMemo(() => {
    const value = provider()
    if (!value) return "Select model"
    return value.name
  })

  function onSelect(providerID: string, modelID: string) {
    local.model.set({ providerID, modelID }, { recent: true })
    const list = local.model.variant.list()
    const cur = local.model.variant.selected()
    if (cur === "default" || (cur && list.includes(cur))) {
      dialog.clear()
      return
    }
    if (list.length > 0) {
      dialog.replace(() => <DialogVariant />)
      return
    }
    dialog.clear()
  }

  // cssltdcode_change start
  return (
    <box flexDirection="row">
      <box flexGrow={1} flexShrink={1}>
        <DialogSelect<ReturnType<typeof options>[number]["value"]>
          options={options()}
          actions={[
            {
              command: "model.dialog.provider",
              title: connected() ? "Connect provider" : "View all providers",
              onTrigger() {
                dialog.replace(() => <DialogProvider />)
              },
            },
            {
              command: "model.dialog.favorite",
              title: "Favorite",
              hidden: !connected(),
              onTrigger: (option) => {
                local.model.toggleFavorite(option.value as { providerID: string; modelID: string })
              },
            },
          ]}
          onFilter={setQuery}
          onMove={(option) => {
            if (typeof option.value === "string") {
              setPreview(undefined)
              return
            }
            const next = lookup(option.value.providerID, option.value.modelID)
            if (!next) return
            setPreview(next)
          }}
          // cssltdcode_change: removed flat={true} to keep section headers visible while filtering
          skipFilter={true}
          title={title()}
          current={local.model.current()}
        />
      </box>
      <Show when={wide() && preview()}>
        {(item) => <ModelInfoPanel model={item().model} provider={item().provider} />}
      </Show>
    </box>
  )
  // cssltdcode_change end
}

export function sortModelOptions<
  T extends {
    footer?: string
    releaseDate: string | number
    title: string
    value?: { providerID: string; modelID: string } // cssltdcode_change
  },
>(
  options: T[],
  newestFirst: boolean,
  rank: ReadonlyMap<string, number> = new Map(), // cssltdcode_change
) {
  // cssltdcode_change start - Sort within Recommended / Cssltd Gateway
  const recommended = (option: T) =>
    option.value?.providerID === "cssltd" ? (rank.get(option.value.modelID) ?? Infinity) : 0
  // cssltdcode_change end
  if (newestFirst)
    return sortBy(
      options,
      recommended, // cssltdcode_change
      [(option) => option.releaseDate, "desc"],
      (option) => option.title,
    )
  return sortBy(
    options,
    recommended, // cssltdcode_change
    (option) => option.footer === undefined, // cssltdcode_change - free model footers include Cssltd disclosure labels
    (option) => option.title,
  )
}
