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
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Info, Loader2, Percent, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  buildVendorIndex,
  type VendorIndex,
} from '@/features/model-aliases/lib/vendor-grouping'
import { ChannelSelectorDialog } from '@/features/system-settings/models/channel-selector-dialog'
import {
  DEFAULT_ENDPOINT,
  MODELS_DEV_PRESET_ENDPOINT,
  MODELS_DEV_PRESET_ID,
  OFFICIAL_CHANNEL_ENDPOINT,
  OFFICIAL_CHANNEL_ID,
  OPENROUTER_CHANNEL_TYPE,
  OPENROUTER_ENDPOINT,
} from '@/features/system-settings/models/constants'
import type { DifferencesMap, UpstreamChannel } from '@/features/system-settings/types'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  fetchUpstreamRatios,
  getPricing,
  getSystemOptions,
  getUpstreamChannels,
  updateSystemOption,
} from './api'
import {
  buildMarkupPlan,
  buildOptionUpdates,
  parseOptionMaps,
} from './lib/markup'
import { priceMarkupQueryKeys } from './lib/query-keys'
import type { MarkupRow } from './types'

/** 「渠道名(id)」→ 只保留渠道名，用于展示 */
function stripChannelId(channelKey: string): string {
  return channelKey.replace(/\(\d+\)$/, '')
}

function defaultEndpoint(channel: UpstreamChannel): string {
  if (channel.id === MODELS_DEV_PRESET_ID) return MODELS_DEV_PRESET_ENDPOINT
  if (channel.id === OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_ENDPOINT
  if (channel.type === OPENROUTER_CHANNEL_TYPE) return OPENROUTER_ENDPOINT
  return DEFAULT_ENDPOINT
}

type VendorBucket = { vendor: string; rows: MarkupRow[] }

export function PriceMarkup() {
  const { t } = useTranslation()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>([])
  const [channelEndpoints, setChannelEndpoints] = useState<
    Record<number, string>
  >({})
  const [differences, setDifferences] = useState<DifferencesMap>({})
  const [channelNames, setChannelNames] = useState<string[]>([])
  const [selectedChannels, setSelectedChannels] = useState<
    Array<{ id: number; name: string }>
  >([])
  const [channelFactorInput, setChannelFactorInput] = useState<
    Record<number, string>
  >({})
  // 记录哪些渠道的系数是从上游 group_ratio 自动读取的（用于 UI 提示"自动检测"）
  const [autoDetectedFactor, setAutoDetectedFactor] = useState<
    Record<number, number>
  >({})
  // 多渠道同一模型报价冲突时，管理员手动指定用哪个渠道的价格作为基准（model -> channelKey）
  const [channelOverride, setChannelOverride] = useState<
    Record<string, string>
  >({})
  const [globalPct, setGlobalPct] = useState('20')
  const [perVendorPctInput, setPerVendorPctInput] = useState<
    Record<string, string>
  >({})

  const { data: channelsData } = useQuery({
    queryKey: priceMarkupQueryKeys.channels(),
    queryFn: getUpstreamChannels,
    enabled: dialogOpen,
  })
  const channels = useMemo(
    () => channelsData?.data ?? [],
    [channelsData?.data]
  )

  useEffect(() => {
    if (channels.length === 0) return
    setChannelEndpoints((prev) => {
      let mutated = false
      const next = { ...prev }
      for (const ch of channels) {
        if (!next[ch.id]) {
          next[ch.id] = defaultEndpoint(ch)
          mutated = true
        }
      }
      return mutated ? next : prev
    })
  }, [channels])

  const { data: pricing } = useQuery({
    queryKey: priceMarkupQueryKeys.pricing(),
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })
  const vendorIndex: VendorIndex = useMemo(
    () => buildVendorIndex(pricing),
    [pricing]
  )

  const fetchMutation = useMutation({
    mutationFn: fetchUpstreamRatios,
    onSuccess: (data, variables) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to fetch upstream prices'))
        return
      }
      setDifferences(data.data.differences)
      // 后端 differences.upstreams 的键是「渠道名(id)」，这里按同样格式构造以精确匹配
      setChannelNames(variables.upstreams.map((u) => `${u.name}(${u.id})`))
      setSelectedChannels(
        variables.upstreams.map((u) => ({ id: u.id, name: u.name }))
      )
      setChannelOverride({})
      // 该次抓取已用渠道自身 API Key 认证上游 /api/pricing，上游随附返回的
      // group_ratio 就是"我方这个渠道在上游落在哪个分组"，自动预填换算系数
      // （只填未手动改过的渠道，不覆盖用户已输入的值）。
      const detected: Record<number, number> = {}
      for (const u of variables.upstreams) {
        const gr = data.data.test_results.find(
          (r) => r.name === `${u.name}(${u.id})`
        )?.group_ratio
        if (!gr) continue
        const keys = Object.keys(gr)
        const suggested =
          gr.default !== undefined
            ? gr.default
            : keys.length === 1
              ? gr[keys[0]]
              : undefined
        if (suggested !== undefined) detected[u.id] = suggested
      }
      setAutoDetectedFactor(detected)
      setChannelFactorInput((prev) => {
        const next = { ...prev }
        for (const [idStr, value] of Object.entries(detected)) {
          const id = Number(idStr)
          if (next[id] === undefined) next[id] = String(value)
        }
        return next
      })
      const errs = data.data.test_results.filter((r) => r.status === 'error')
      if (errs.length > 0) {
        toast.warning(
          t('Some channels failed: {{errorMsg}}', {
            errorMsg: errs.map((r) => `${r.name}: ${r.error}`).join(', '),
          })
        )
      }
      if (Object.keys(data.data.differences).length === 0) {
        toast.warning(t('No upstream prices found for the selected channels'))
      } else {
        toast.success(t('Upstream prices fetched successfully'))
      }
    },
    onError: (e: Error) =>
      toast.error(e.message || t('Failed to fetch upstream prices')),
  })

  const perVendorPct = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(perVendorPctInput)) {
      const n = Number(v)
      if (v.trim() !== '' && !Number.isNaN(n)) out[k] = n
    }
    return out
  }, [perVendorPctInput])

  // 渠道换算系数：修正上游自己的分组/折扣倍率（同步只拉裸 model_ratio，不知道我方
  // 账号在上游落在哪个分组）。键与 channelNames 一致（「渠道名(id)」），默认 1。
  const channelFactors = useMemo(() => {
    const out: Record<string, number> = {}
    for (const ch of selectedChannels) {
      const raw = channelFactorInput[ch.id]
      const n = raw !== undefined && raw.trim() !== '' ? Number(raw) : 1
      out[`${ch.name}(${ch.id})`] = Number.isNaN(n) ? 1 : n
    }
    return out
  }, [selectedChannels, channelFactorInput])

  const plan = useMemo(
    () =>
      buildMarkupPlan(
        differences,
        channelNames,
        vendorIndex,
        Number(globalPct) || 0,
        perVendorPct,
        channelFactors,
        channelOverride
      ),
    [
      differences,
      channelNames,
      vendorIndex,
      globalPct,
      perVendorPct,
      channelFactors,
      channelOverride,
    ]
  )

  const buckets: VendorBucket[] = useMemo(() => {
    const byVendor = new Map<string, MarkupRow[]>()
    for (const r of plan.rows) {
      const list = byVendor.get(r.vendor)
      if (list) list.push(r)
      else byVendor.set(r.vendor, [r])
    }
    const ordered: VendorBucket[] = []
    for (const v of vendorIndex.vendorOrder) {
      if (byVendor.has(v)) {
        ordered.push({ vendor: v, rows: byVendor.get(v)! })
        byVendor.delete(v)
      }
    }
    for (const [v, rows] of byVendor) {
      if (v !== '') ordered.push({ vendor: v, rows })
    }
    if (byVendor.has('')) ordered.push({ vendor: '', rows: byVendor.get('')! })
    return ordered
  }, [plan.rows, vendorIndex.vendorOrder])

  const applyMutation = useMutation({
    mutationFn: async () => {
      const opts = await getSystemOptions()
      const current = parseOptionMaps(opts.data ?? [])
      const updates = buildOptionUpdates(plan, current)
      for (const u of updates) await updateSystemOption(u)
      return updates.length
    },
    onSuccess: () => {
      toast.success(
        t('Applied markup to {{count}} models', { count: plan.rows.length })
      )
    },
    onError: (e: Error) => toast.error(e.message || t('Failed to apply markup')),
  })

  const handleConfirmChannels = (ids: number[]) => {
    const chosen = channels.filter((c) => ids.includes(c.id))
    if (chosen.length === 0) {
      toast.warning(t('Please select at least one channel'))
      return
    }
    fetchMutation.mutate({
      upstreams: chosen.map((c) => ({
        id: c.id,
        name: c.name,
        base_url: c.base_url,
        endpoint: channelEndpoints[c.id] || DEFAULT_ENDPOINT,
      })),
      timeout: 10,
    })
  }

  const busy = fetchMutation.isPending || applyMutation.isPending
  const hasPlan = plan.rows.length > 0

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Batch Price Markup')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button onClick={() => setDialogOpen(true)} disabled={busy} size='sm'>
          <RefreshCcw className='mr-2 h-4 w-4' />
          {t('Select source channels')}
        </Button>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => applyMutation.mutate()}
          disabled={busy || !hasPlan}
        >
          {applyMutation.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : null}
          {t('Apply markup')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Alert>
            <Info className='h-4 w-4' />
            <AlertTitle>{t('Mark up upstream prices by a percentage')}</AlertTitle>
            <AlertDescription>
              <p>
                {t(
                  'Pick source channel(s) to read upstream prices, set a global markup and optional per-vendor overrides, then apply. Sell price = upstream price × (1 + markup%).'
                )}
              </p>
              <ul className='mt-2 list-disc space-y-1 pl-5'>
                <li>
                  {t(
                    'The group ratio multiplies your LOCAL price, not the channel cost. To earn a fixed % on every model, local price must first equal cost — that is exactly what this tool sets.'
                  )}
                </li>
                <li>
                  {t(
                    'After applying here, keep the group ratio at 1, otherwise the two markups stack (cost × markup × group ratio).'
                  )}
                </li>
                <li>
                  {t(
                    'Only channels whose upstream exposes a price list return prices; other channels have nothing to mark up.'
                  )}
                </li>
                <li>
                  {t(
                    'Tiered/expression-billed models are marked up too — every per-tier price coefficient is scaled by the same %, while tier thresholds and labels stay exactly as upstream defined them.'
                  )}
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className='flex flex-wrap items-end gap-3'>
            <div className='flex flex-col gap-1.5'>
              <label className='text-muted-foreground text-xs font-medium'>
                {t('Global markup %')}
              </label>
              <div className='relative w-40'>
                <Input
                  type='number'
                  value={globalPct}
                  onChange={(e) => setGlobalPct(e.target.value)}
                  disabled={busy}
                  className='pr-7'
                />
                <Percent className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2' />
              </div>
            </div>
          </div>

          {selectedChannels.length > 0 ? (
            <div className='border-border/60 flex flex-col gap-2 rounded-lg border p-3'>
              <div className='text-xs font-medium'>
                {t('Channel correction factor')}
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  "Auto-detected when the upstream's /api/pricing response includes a group_ratio (that request is already authenticated with this channel's own API key, so it reflects which group YOUR key falls under). Edit if wrong, or fill manually when it can't be detected."
                )}
              </p>
              <div className='flex flex-wrap gap-3'>
                {selectedChannels.map((ch) => {
                  const isAutoValue =
                    autoDetectedFactor[ch.id] !== undefined &&
                    channelFactorInput[ch.id] === String(autoDetectedFactor[ch.id])
                  return (
                    <div key={ch.id} className='flex items-center gap-2'>
                      <span className='text-muted-foreground text-xs'>
                        {ch.name}
                      </span>
                      <Input
                        type='number'
                        placeholder='1'
                        value={channelFactorInput[ch.id] ?? ''}
                        onChange={(e) =>
                          setChannelFactorInput((prev) => ({
                            ...prev,
                            [ch.id]: e.target.value,
                          }))
                        }
                        disabled={busy}
                        className='h-8 w-24'
                      />
                      {isAutoValue ? (
                        <Badge variant='secondary' className='shrink-0'>
                          {t('Auto-detected')}
                        </Badge>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {fetchMutation.isPending ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
            </div>
          ) : !hasPlan ? (
            <Alert>
              <Info className='h-4 w-4' />
              <AlertTitle>{t('No prices loaded yet')}</AlertTitle>
              <AlertDescription>
                {t(
                  'Click "Select source channels" and choose the channel whose upstream prices should be the cost basis.'
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {plan.skippedTiered.length > 0 ? (
                <Alert variant='destructive'>
                  <AlertTitle>
                    {t('{{count}} tiered-billing models skipped', {
                      count: plan.skippedTiered.length,
                    })}
                  </AlertTitle>
                  <AlertDescription>
                    {t(
                      'Their billing expression has no recognizable price coefficient, so it could not be safely scaled and was left unchanged. (Most tiered/expression-billed models ARE handled — their per-tier coefficients are scaled by the same %, tier thresholds and labels stay untouched.)'
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}

              {buckets.map((b) => (
                <Card key={b.vendor || '__other__'}>
                  <CardHeader className='gap-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        {b.vendor ? (
                          <span className='flex size-4 shrink-0 items-center justify-center'>
                            {getLobeIcon(
                              vendorIndex.vendorIcon.get(b.vendor),
                              16
                            )}
                          </span>
                        ) : null}
                        {b.vendor || t('Other')}
                        <Badge variant='secondary'>
                          {t('{{count}} models', { count: b.rows.length })}
                        </Badge>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='text-muted-foreground text-xs'>
                          {t('Markup %')}
                        </span>
                        <div className='relative w-28'>
                          <Input
                            type='number'
                            placeholder={globalPct}
                            value={perVendorPctInput[b.vendor] ?? ''}
                            onChange={(e) =>
                              setPerVendorPctInput((prev) => ({
                                ...prev,
                                [b.vendor]: e.target.value,
                              }))
                            }
                            disabled={busy}
                            className='h-8 pr-7'
                          />
                          <Percent className='text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2' />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='flex flex-col gap-1'>
                    {b.rows.map((r) => (
                      <div
                        key={r.model}
                        className='border-border/60 flex flex-col gap-1 rounded-md border px-3 py-1.5 text-xs'
                      >
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <span className='min-w-0 flex-1 truncate font-medium'>
                            {r.model}
                            <Badge variant='outline' className='ml-2'>
                              {r.billing === 'price'
                                ? t('Per-call')
                                : r.billing === 'expr'
                                  ? t('Tiered')
                                  : t('Ratio')}
                            </Badge>
                            {r.conflict ? (
                              <Badge variant='destructive' className='ml-1'>
                                <AlertTriangle className='mr-1 h-3 w-3' />
                                {t('{{count}} channels disagree', {
                                  count: r.conflict.length,
                                })}
                              </Badge>
                            ) : null}
                          </span>
                          {r.billing === 'expr' ? (
                            <span className='text-muted-foreground shrink-0 tabular-nums'>
                              ×{(1 + r.pct / 100).toFixed(2)}
                            </span>
                          ) : (
                            <span className='text-muted-foreground shrink-0 tabular-nums'>
                              {r.base}
                              <span className='mx-1'>
                                ×{(1 + r.pct / 100).toFixed(2)}
                              </span>
                              →
                              <span className='text-foreground ml-1 font-semibold'>
                                {r.result}
                              </span>
                            </span>
                          )}
                        </div>

                        {r.conflict ? (
                          <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-muted-foreground'>
                              {t('Source channel:')}
                            </span>
                            <NativeSelect
                              size='sm'
                              value={r.sourceChannel}
                              onChange={(e) =>
                                setChannelOverride((prev) => ({
                                  ...prev,
                                  [r.model]: e.target.value,
                                }))
                              }
                              disabled={busy}
                              className='h-7 min-w-40'
                            >
                              {r.conflict.map((c) => (
                                <NativeSelectOption
                                  key={c.channelKey}
                                  value={c.channelKey}
                                >
                                  {stripChannelId(c.channelKey)} ({c.value})
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          </div>
                        ) : (
                          <span className='text-muted-foreground'>
                            {t('Source:')} {stripChannelId(r.sourceChannel)}
                          </span>
                        )}

                        {r.billing === 'expr' ? (
                          <div className='bg-muted/40 flex flex-col gap-0.5 rounded p-1.5 font-mono text-[10px] break-all'>
                            <div className='text-muted-foreground opacity-70 line-through'>
                              {r.exprBefore}
                            </div>
                            <div className='text-foreground'>{r.exprAfter}</div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        <ChannelSelectorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          channels={channels}
          selectedChannelIds={selectedChannelIds}
          onSelectedChannelIdsChange={setSelectedChannelIds}
          channelEndpoints={channelEndpoints}
          onChannelEndpointsChange={setChannelEndpoints}
          onConfirm={handleConfirmChannels}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
