/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import {
  fetchUpstreamRatios,
  getSystemOptions,
  getUpstreamChannels,
  updateSystemOption,
} from '../api'
import type {
  DifferencesMap,
  RatioType,
  UpstreamChannel,
  UpstreamConfig,
} from '../types'
import { ChannelSelectorDialog } from './channel-selector-dialog'
import {
  ConflictConfirmDialog,
  type ConflictItem,
} from './conflict-confirm-dialog'
import {
  buildPriceSourcePatch,
  mergePriceSource,
  parsePriceSource,
  PRICE_SOURCE_OPTION_KEY,
} from './price-source'
import {
  DEFAULT_ENDPOINT,
  MODELS_DEV_PRESET_ENDPOINT,
  MODELS_DEV_PRESET_ID,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OPENROUTER_CHANNEL_TYPE,
  OPENROUTER_ENDPOINT,
} from './constants'
import {
  NUMERIC_SYNC_FIELDS,
  RATIO_SYNC_FIELDS,
  getPreferredSyncField,
  type ResolutionsMap,
} from './upstream-ratio-sync-helpers'
import { UpstreamRatioSyncTable } from './upstream-ratio-sync-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RatioFieldKey =
  | 'ModelPrice'
  | 'ModelRatio'
  | 'CompletionRatio'
  | 'CacheRatio'
  | 'CreateCacheRatio'
  | 'ImageRatio'
  | 'AudioRatio'
  | 'AudioCompletionRatio'
  | 'billing_setting.billing_mode'
  | 'billing_setting.billing_expr'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The two synthesized presets always carry stable negative IDs assigned by
// `controller/ratio_sync.go`; matching by ID alone is sufficient and avoids
// fragile name/base_url comparisons.
function getDefaultEndpointForChannel(channel: UpstreamChannel): string {
  if (channel.id === MODELS_DEV_PRESET_ID) return MODELS_DEV_PRESET_ENDPOINT
  if (channel.id === OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_ENDPOINT
  if (channel.type === OPENROUTER_CHANNEL_TYPE) return OPENROUTER_ENDPOINT
  return DEFAULT_ENDPOINT
}

function getBillingCategory(ratioType: string): 'price' | 'ratio' | 'tiered' {
  if (ratioType === 'model_price') return 'price'
  if (ratioType === 'billing_mode' || ratioType === 'billing_expr')
    return 'tiered'
  return 'ratio'
}

function optionKeyBySyncField(ratioType: string): string {
  const explicit: Record<string, string> = {
    billing_mode: 'billing_setting.billing_mode',
    billing_expr: 'billing_setting.billing_expr',
  }
  if (explicit[ratioType]) return explicit[ratioType]
  return ratioType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function parseJsonRecord<T>(raw: string | undefined | null): Record<string, T> {
  try {
    return JSON.parse(raw || '{}') as Record<string, T>
  } catch {
    return {}
  }
}

type ParsedRatios = Record<RatioFieldKey, Record<string, number | string>>

// The sync-apply flow used to read its "current local price" base from a
// prop populated from a possibly-stale query cache — captured before other
// edits in this session were saved, or simply not yet refetched. Applying a
// sync writes a full replacement value for each of these 10 option keys, so
// syncing from a stale base silently discarded any real data that wasn't
// reflected in the snapshot. Fetch the option list fresh right before
// building the sync payload so the merge base always matches the database.
async function fetchFreshRatios(): Promise<ParsedRatios> {
  const res = await getSystemOptions()
  const byKey = new Map((res.data ?? []).map((o) => [o.key, o.value]))
  return {
    ModelRatio: parseJsonRecord<number>(byKey.get('ModelRatio')),
    CompletionRatio: parseJsonRecord<number>(byKey.get('CompletionRatio')),
    CacheRatio: parseJsonRecord<number>(byKey.get('CacheRatio')),
    CreateCacheRatio: parseJsonRecord<number>(byKey.get('CreateCacheRatio')),
    ImageRatio: parseJsonRecord<number>(byKey.get('ImageRatio')),
    AudioRatio: parseJsonRecord<number>(byKey.get('AudioRatio')),
    AudioCompletionRatio: parseJsonRecord<number>(
      byKey.get('AudioCompletionRatio')
    ),
    ModelPrice: parseJsonRecord<number>(byKey.get('ModelPrice')),
    'billing_setting.billing_mode': parseJsonRecord<string>(
      byKey.get('billing_setting.billing_mode')
    ),
    'billing_setting.billing_expr': parseJsonRecord<string>(
      byKey.get('billing_setting.billing_expr')
    ),
  }
}

function deleteResolutionField(
  res: ResolutionsMap,
  model: string,
  ratioType: string
): ResolutionsMap {
  if (!res[model]) return res
  const newModelRes = { ...res[model] }
  delete newModelRes[ratioType]
  if (ratioType === 'billing_expr') delete newModelRes['billing_mode']
  if (ratioType === 'billing_mode') delete newModelRes['billing_expr']
  const next = { ...res }
  if (Object.keys(newModelRes).length === 0) {
    delete next[model]
  } else {
    next[model] = newModelRes
  }
  return next
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpstreamRatioSync() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [channelEndpoints, setChannelEndpoints] = useState<
    Record<number, string>
  >({})
  const [differences, setDifferences] = useState<DifferencesMap>({})
  const [resolutions, setResolutions] = useState<ResolutionsMap>({})
  // 记录每个模型的选定值来自哪个上游渠道（渠道名），供写入价格来源追踪。
  // resolutions 只存数值、丢掉了来源，这里并行保留来源渠道名。
  const [resolutionSources, setResolutionSources] = useState<
    Record<string, string>
  >({})
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([])
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [isPreparingSync, setIsPreparingSync] = useState(false)
  // Snapshot fetched fresh at the moment "Apply Sync" was clicked, reused by
  // the conflict-confirmation step so both stages act on the same base
  // instead of re-fetching (and potentially observing different state).
  const pendingSyncRatiosRef = useRef<ParsedRatios | null>(null)

  const { data: channelsData } = useQuery({
    queryKey: ['upstream-channels'],
    queryFn: getUpstreamChannels,
    enabled: channelDialogOpen,
  })

  // Memoize the channels list so the effect below only re-runs when the query
  // data actually changes, instead of on every render (the `|| []` fallback
  // would otherwise produce a new array reference each render).
  const channels = useMemo(() => channelsData?.data ?? [], [channelsData?.data])

  useEffect(() => {
    if (channels.length === 0) return
    setChannelEndpoints((prev) => {
      let mutated = false
      const next = { ...prev }
      for (const channel of channels) {
        if (!next[channel.id]) {
          next[channel.id] = getDefaultEndpointForChannel(channel)
          mutated = true
        }
      }
      return mutated ? next : prev
    })
  }, [channels])

  const fetchMutation = useMutation({
    mutationFn: fetchUpstreamRatios,
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to fetch upstream prices'))
        return
      }

      const { differences: diffs, test_results } = data.data

      const errorResults = test_results.filter((r) => r.status === 'error')
      if (errorResults.length > 0) {
        const errorMsg = errorResults
          .map((r) => `${r.name}: ${r.error}`)
          .join(', ')
        toast.warning(t('Some channels failed: {{errorMsg}}', { errorMsg }))
      }

      setDifferences(diffs)
      setResolutions({})
      setResolutionSources({})

      if (Object.keys(diffs).length === 0) {
        toast.success(t('No price differences found'))
      } else {
        toast.success(t('Upstream prices fetched successfully'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to fetch upstream prices'))
    },
  })

  const { mutate: syncMutate, isPending: isSyncPending } = useMutation({
    mutationFn: async (updates: Array<{ key: string; value: string }>) => {
      for (const update of updates) {
        await updateSystemOption(update)
      }
    },
    onSuccess: () => {
      toast.success(t('Prices synced successfully'))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })

      setDifferences((prevDiffs) => {
        const newDiffs = { ...prevDiffs }
        Object.entries(resolutions).forEach(([model, ratios]) => {
          Object.keys(ratios).forEach((ratioType) => {
            if (newDiffs[model]?.[ratioType as RatioType]) {
              delete newDiffs[model][ratioType as RatioType]
              if (Object.keys(newDiffs[model]).length === 0) {
                delete newDiffs[model]
              }
            }
          })
        })
        return newDiffs
      })

      setResolutions({})
      setResolutionSources({})
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to sync prices'))
    },
  })

  const handleOpenChannelDialog = () => {
    setChannelDialogOpen(true)
  }

  const handleConfirmChannelSelection = (selectedIds: number[]) => {
    const selectedChannels = channels.filter((ch) =>
      selectedIds.includes(ch.id)
    )

    if (selectedChannels.length === 0) {
      toast.warning(t('Please select at least one channel'))
      return
    }

    const upstreams: UpstreamConfig[] = selectedChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      base_url: ch.base_url,
      endpoint: channelEndpoints[ch.id] || DEFAULT_ENDPOINT,
    }))

    fetchMutation.mutate({ upstreams, timeout: 10 })
  }

  const handleSelectValue = useCallback(
    (
      model: string,
      ratioType: RatioType,
      value: number | string,
      sourceName: string
    ) => {
      const modelDiffs = differences[model]

      // Prefer billing_expr over individual ratio fields when available
      const preferredType = sourceName
        ? getPreferredSyncField(modelDiffs || {}, ratioType, sourceName)
        : ratioType
      const preferredValue =
        preferredType === ratioType
          ? value
          : (modelDiffs?.[preferredType]?.upstreams?.[sourceName] ?? value)

      const finalType = preferredType
      const finalValue = preferredValue as number | string
      const category = getBillingCategory(finalType)

      setResolutions((prev) => {
        const newModelRes = { ...(prev[model] || {}) }

        // Clear conflicting categories
        Object.keys(newModelRes).forEach((rt) => {
          if (
            category !== 'tiered' &&
            getBillingCategory(rt) !== 'tiered' &&
            getBillingCategory(rt) !== category
          ) {
            delete newModelRes[rt]
          }
        })

        newModelRes[finalType] = finalValue

        // When selecting a tiered field, auto-populate paired fields from the same source
        if (category === 'tiered' && sourceName && modelDiffs) {
          const modeVal = modelDiffs.billing_mode?.upstreams?.[sourceName]
          const exprVal = modelDiffs.billing_expr?.upstreams?.[sourceName]
          if (modeVal !== undefined && modeVal !== null && modeVal !== 'same') {
            newModelRes['billing_mode'] = modeVal
          } else if (finalType === 'billing_expr') {
            newModelRes['billing_mode'] = 'tiered_expr'
          }
          if (exprVal !== undefined && exprVal !== null && exprVal !== 'same') {
            newModelRes['billing_expr'] = exprVal
          }
        }

        return { ...prev, [model]: newModelRes }
      })

      // 记录该模型的选定来源渠道（用于价格来源追踪）。sourceName 为空时不覆盖已有值。
      if (sourceName) {
        setResolutionSources((prev) => ({ ...prev, [model]: sourceName }))
      }
    },
    [differences]
  )

  const handleUnselectValue = useCallback(
    (model: string, ratioType: RatioType) => {
      setResolutions((prev) => deleteResolutionField(prev, model, ratioType))
    },
    []
  )

  const getLocalBillingCategory = (
    model: string,
    currentRatios: ParsedRatios
  ): 'price' | 'ratio' | null => {
    if (currentRatios.ModelPrice[model] !== undefined) return 'price'
    if (
      currentRatios.ModelRatio[model] !== undefined ||
      currentRatios.CompletionRatio[model] !== undefined ||
      currentRatios.CacheRatio[model] !== undefined ||
      currentRatios.CreateCacheRatio[model] !== undefined ||
      currentRatios.ImageRatio[model] !== undefined ||
      currentRatios.AudioRatio[model] !== undefined ||
      currentRatios.AudioCompletionRatio[model] !== undefined
    )
      return 'ratio'
    return null
  }

  const performSync = useCallback(
    async (currentRatios: ParsedRatios): Promise<boolean> => {
      const finalRatios: Record<string, Record<string, number | string>> = {
        ModelRatio: { ...currentRatios.ModelRatio },
        CompletionRatio: { ...currentRatios.CompletionRatio },
        CacheRatio: { ...currentRatios.CacheRatio },
        CreateCacheRatio: { ...currentRatios.CreateCacheRatio },
        ImageRatio: { ...currentRatios.ImageRatio },
        AudioRatio: { ...currentRatios.AudioRatio },
        AudioCompletionRatio: { ...currentRatios.AudioCompletionRatio },
        ModelPrice: { ...currentRatios.ModelPrice },
        'billing_setting.billing_mode': {
          ...currentRatios['billing_setting.billing_mode'],
        },
        'billing_setting.billing_expr': {
          ...currentRatios['billing_setting.billing_expr'],
        },
      }

      Object.entries(resolutions).forEach(([model, ratios]) => {
        const selectedTypes = Object.keys(ratios)
        const hasPrice = selectedTypes.includes('model_price')
        const hasRatio = selectedTypes.some((rt) =>
          RATIO_SYNC_FIELDS.includes(rt as RatioType)
        )

        if (hasPrice) {
          delete finalRatios.ModelRatio[model]
          delete finalRatios.CompletionRatio[model]
          delete finalRatios.CacheRatio[model]
          delete finalRatios.CreateCacheRatio[model]
          delete finalRatios.ImageRatio[model]
          delete finalRatios.AudioRatio[model]
          delete finalRatios.AudioCompletionRatio[model]
          // Switching to per-request billing: clear any existing tiered billing
          // config so it doesn't silently override the new model_price.
          delete finalRatios['billing_setting.billing_mode'][model]
          delete finalRatios['billing_setting.billing_expr'][model]
        }
        if (hasRatio) {
          delete finalRatios.ModelPrice[model]
          // Switching to token-based billing: clear any existing tiered billing
          // config so it doesn't silently override the new ratio values.
          delete finalRatios['billing_setting.billing_mode'][model]
          delete finalRatios['billing_setting.billing_expr'][model]
        }

        Object.entries(ratios).forEach(([ratioType, value]) => {
          const optionKey = optionKeyBySyncField(ratioType)
          finalRatios[optionKey][model] = NUMERIC_SYNC_FIELDS.has(ratioType)
            ? Number(value)
            : value
        })
      })

      const updates = Object.entries(finalRatios).map(([key, value]) => ({
        key,
        value: JSON.stringify(value, null, 2),
      }))

      // 价格来源追踪：把本次同步的每个模型标记为 upstream_sync + 来源渠道名。
      // 先读现有 PriceSourceHistory 再合并，避免覆盖其他模型的来源记录。
      const resolvedModels = Object.keys(resolutions)
      if (resolvedModels.length > 0) {
        try {
          const opts = await getSystemOptions()
          const currentSource = parsePriceSource(opts.data ?? [])
          const patch = buildPriceSourcePatch(
            resolvedModels,
            'upstream_sync',
            Date.now(),
            (m) => resolutionSources[m]
          )
          updates.push({
            key: PRICE_SOURCE_OPTION_KEY,
            value: mergePriceSource(currentSource, patch),
          })
        } catch {
          // 来源追踪是附加信息，读取失败不应阻断价格同步本身
        }
      }

      return new Promise<boolean>((resolve) => {
        syncMutate(updates, {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        })
      })
    },
    [resolutions, resolutionSources, syncMutate]
  )

  const findSourceChannel = (
    model: string,
    ratioType: RatioType,
    value: number | string
  ): string => {
    const upMap = differences[model]?.[ratioType]?.upstreams
    if (!upMap) return 'Unknown'
    const entry = Object.entries(upMap).find(([, v]) => v === value)
    return entry ? entry[0] : 'Unknown'
  }

  const handleApplySync = async () => {
    setIsPreparingSync(true)
    let currentRatios: ParsedRatios
    try {
      // Re-fetch the option values right before writing: `modelRatios` is a
      // prop snapshot that can be stale (e.g. edited elsewhere in this
      // session and not yet refetched here), and applying a sync writes a
      // full replacement for each of these 10 keys — syncing from a stale
      // base would silently discard real data. See fetchFreshRatios().
      currentRatios = await fetchFreshRatios()
    } catch {
      toast.error(t('Failed to load current prices; sync aborted'))
      setIsPreparingSync(false)
      return
    }
    setIsPreparingSync(false)
    pendingSyncRatiosRef.current = currentRatios

    const conflicts: ConflictItem[] = []

    const fixedPriceLabel = t('Fixed price')
    const modelRatioLabel = t('Model ratio')
    const completionRatioLabel = t('Completion ratio')

    Object.entries(resolutions).forEach(([model, ratios]) => {
      const localCat = getLocalBillingCategory(model, currentRatios)
      const selectedTypes = Object.keys(ratios)
      let newCat: 'price' | 'ratio' | 'tiered'
      if ('model_price' in ratios) {
        newCat = 'price'
      } else if (RATIO_SYNC_FIELDS.some((rt) => selectedTypes.includes(rt))) {
        newCat = 'ratio'
      } else {
        newCat = 'tiered'
      }

      if (localCat && newCat !== 'tiered' && localCat !== newCat) {
        const currentDesc =
          localCat === 'price'
            ? `${fixedPriceLabel}: ${currentRatios.ModelPrice[model]}`
            : `${modelRatioLabel}: ${currentRatios.ModelRatio[model] ?? '-'}\n${completionRatioLabel}: ${currentRatios.CompletionRatio[model] ?? '-'}`

        const newDesc =
          newCat === 'price'
            ? `${fixedPriceLabel}: ${ratios.model_price}`
            : `${modelRatioLabel}: ${ratios.model_ratio ?? '-'}\n${completionRatioLabel}: ${ratios.completion_ratio ?? '-'}`

        const channelNames = selectedTypes
          .map((rt) => findSourceChannel(model, rt as RatioType, ratios[rt]))
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(', ')

        conflicts.push({
          channel: channelNames,
          model,
          current: currentDesc,
          newVal: newDesc,
        })
      }
    })

    if (conflicts.length > 0) {
      setConflictItems(conflicts)
      setConflictDialogOpen(true)
      return
    }

    toast.info(t('Syncing prices, please wait...'))
    performSync(currentRatios)
  }

  const handleConfirmConflict = async () => {
    if (!pendingSyncRatiosRef.current) return
    setConfirmLoading(true)
    try {
      const success = await performSync(pendingSyncRatiosRef.current)
      if (success) {
        setConflictDialogOpen(false)
      }
    } finally {
      setConfirmLoading(false)
    }
  }

  const hasSelections = Object.keys(resolutions).length > 0
  const isLoading =
    fetchMutation.isPending ||
    isSyncPending ||
    confirmLoading ||
    isPreparingSync

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button onClick={handleOpenChannelDialog} disabled={isLoading}>
            <RefreshCcw className='mr-2 h-4 w-4' />
            {t('Select Sync Channels')}
          </Button>
          <Button
            variant='secondary'
            onClick={handleApplySync}
            disabled={!hasSelections || isLoading}
          >
            {(isSyncPending || confirmLoading || isPreparingSync) && (
              <span className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
            )}
            <CheckSquare className='mr-2 h-4 w-4' />
            {t('Apply Sync')}
          </Button>
        </div>
      </div>

      <UpstreamRatioSyncTable
        differences={differences}
        resolutions={resolutions}
        isDisabled={isLoading}
        isSyncing={fetchMutation.isPending}
        onSelectValue={handleSelectValue}
        onUnselectValue={handleUnselectValue}
      />

      <ChannelSelectorDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channels={channels}
        selectedChannelIds={selectedChannelIds}
        onSelectedChannelIdsChange={setSelectedChannelIds}
        channelEndpoints={channelEndpoints}
        onChannelEndpointsChange={setChannelEndpoints}
        onConfirm={handleConfirmChannelSelection}
      />

      <ConflictConfirmDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={conflictItems}
        onConfirm={handleConfirmConflict}
        isLoading={confirmLoading}
      />
    </div>
  )
}
