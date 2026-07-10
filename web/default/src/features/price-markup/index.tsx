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
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  fetchUpstreamRatios,
  getPricing,
  getSystemOptions,
  getUpstreamChannels,
  updateSystemOption,
} from './api'
import {
  buildHistoryEntries,
  MARKUP_HISTORY_OPTION_KEY,
  mergeMarkupHistory,
  parseMarkupHistory,
} from './lib/history'
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
  const queryClient = useQueryClient()

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
  // 从上游 /api/pricing 检测到的分组倍率候选（channel id -> {分组名: 倍率}），
  // 仅用于渲染下拉供管理员挑选，不做任何静默预填
  const [detectedGroupRatios, setDetectedGroupRatios] = useState<
    Record<number, Record<string, number>>
  >({})
  // 管理员在下拉里手动确认选择的分组（channel id -> 分组名；空字符串=手动输入模式）
  const [channelGroupChoice, setChannelGroupChoice] = useState<
    Record<number, string>
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
      // group_ratio 就是"我方这个渠道在上游落在哪个分组"。不同分组倍率可能相差
      // 很大（如 0.5~0.7），不做静默猜测/预填——只记录检测到的候选，交给管理员
      // 在下拉里亲眼看到全部选项后手动确认选哪个，选了才写入换算系数。
      const detected: Record<number, Record<string, number>> = {}
      for (const u of variables.upstreams) {
        const gr = data.data.test_results.find(
          (r) => r.name === `${u.name}(${u.id})`
        )?.group_ratio
        if (gr && Object.keys(gr).length > 0) detected[u.id] = gr
      }
      setDetectedGroupRatios(detected)
      setChannelGroupChoice({})
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

  // 持久化的加价记录（近一次拉取的渠道价 + 加价%）+ 当前系统实际生效价格（同一份
  // getSystemOptions 派生两种视图，"当前系统渠道价格"永远读最新，不受记录时效影响）
  const historyQuery = useQuery({
    queryKey: priceMarkupQueryKeys.history(),
    queryFn: getSystemOptions,
  })
  const history = useMemo(
    () => parseMarkupHistory(historyQuery.data?.data ?? []),
    [historyQuery.data]
  )
  const currentMaps = useMemo(
    () => parseOptionMaps(historyQuery.data?.data ?? []),
    [historyQuery.data]
  )
  const historyRows = useMemo(
    () =>
      Object.entries(history).sort(
        (a, b) =>
          a[1].vendor.localeCompare(b[1].vendor) || a[0].localeCompare(b[0])
      ),
    [history]
  )

  const applyMutation = useMutation({
    mutationFn: async () => {
      const opts = await getSystemOptions()
      const current = parseOptionMaps(opts.data ?? [])
      const updates = buildOptionUpdates(plan, current)
      for (const u of updates) await updateSystemOption(u)
      // 持久化本次加价记录：合并进现有历史（同模型名以本次为准），供表格核对
      const currentHistory = parseMarkupHistory(opts.data ?? [])
      const newEntries = buildHistoryEntries(plan, Date.now())
      await updateSystemOption({
        key: MARKUP_HISTORY_OPTION_KEY,
        value: mergeMarkupHistory(currentHistory, newEntries),
      })
      return updates.length
    },
    onSuccess: () => {
      toast.success(
        t('Applied markup to {{count}} models', { count: plan.rows.length })
      )
      void queryClient.invalidateQueries({
        queryKey: priceMarkupQueryKeys.history(),
      })
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

          <div className='flex flex-col gap-2'>
            <div className='text-sm font-medium'>
              {t('Applied markup record')}
            </div>
            {historyQuery.isLoading ? (
              <div className='flex items-center justify-center py-8'>
                <Spinner className='size-5' />
              </div>
            ) : historyRows.length === 0 ? (
              <Alert>
                <Info className='h-4 w-4' />
                <AlertDescription>
                  {t(
                    'No markup has been applied yet. This table fills in and persists after you click "Apply markup" below.'
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <div className='overflow-x-auto rounded-lg border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Model list')}</TableHead>
                      <TableHead>{t('Last synced channel price')}</TableHead>
                      <TableHead>{t('Batch markup')}</TableHead>
                      <TableHead>{t('Current system channel price')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map(([model, entry]) => {
                      const currentValue =
                        entry.billing === 'price'
                          ? currentMaps.ModelPrice[model]
                          : entry.billing === 'expr'
                            ? currentMaps.BillingExpr[model]
                            : currentMaps.ModelRatio[model]
                      const expected =
                        entry.billing === 'expr'
                          ? entry.exprAfter
                          : entry.appliedResult
                      const drifted =
                        currentValue !== undefined &&
                        expected !== undefined &&
                        currentValue !== expected
                      return (
                        <TableRow key={model}>
                          <TableCell>
                            <span className='font-medium'>{model}</span>
                            <Badge variant='outline' className='ml-2'>
                              {entry.vendor || t('Other')}
                            </Badge>
                          </TableCell>
                          <TableCell className='tabular-nums'>
                            {entry.billing === 'expr' ? (
                              <span
                                className='block max-w-64 truncate font-mono text-[11px]'
                                title={entry.exprBefore}
                              >
                                {entry.exprBefore}
                              </span>
                            ) : (
                              entry.upstreamPrice
                            )}
                            <span className='text-muted-foreground ml-1 text-[11px]'>
                              ({t('from')} {stripChannelId(entry.sourceChannel)})
                            </span>
                          </TableCell>
                          <TableCell className='tabular-nums'>
                            +{entry.pct}%
                          </TableCell>
                          <TableCell className='tabular-nums'>
                            {entry.billing === 'expr' ? (
                              <span
                                className='block max-w-64 truncate font-mono text-[11px]'
                                title={String(currentValue ?? '')}
                              >
                                {currentValue ?? t('(cleared)')}
                              </span>
                            ) : (
                              <span
                                className={
                                  drifted ? 'text-amber-600 dark:text-amber-500' : ''
                                }
                              >
                                {currentValue ?? t('(cleared)')}
                              </span>
                            )}
                            {drifted ? (
                              <Badge
                                variant='outline'
                                className='ml-2 border-amber-500 text-amber-600 dark:text-amber-500'
                              >
                                {t('Changed since')}
                              </Badge>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

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
                  "When the upstream's /api/pricing response includes a group_ratio (that request is already authenticated with this channel's own API key, so it reflects which group YOUR key falls under), all detected groups are listed below — pick the one that matches your account, or enter the factor manually. Nothing is pre-filled automatically."
                )}
              </p>
              <div className='flex flex-col gap-2'>
                {selectedChannels.map((ch) => {
                  const groups = detectedGroupRatios[ch.id]
                  const choice = channelGroupChoice[ch.id] ?? ''
                  return (
                    <div key={ch.id} className='flex flex-wrap items-center gap-2'>
                      <span className='text-muted-foreground w-40 shrink-0 truncate text-xs'>
                        {ch.name}
                      </span>
                      {groups ? (
                        <NativeSelect
                          size='sm'
                          value={choice}
                          onChange={(e) => {
                            const g = e.target.value
                            setChannelGroupChoice((prev) => ({
                              ...prev,
                              [ch.id]: g === '__manual__' ? '' : g,
                            }))
                            if (g && g !== '__manual__') {
                              setChannelFactorInput((prev) => ({
                                ...prev,
                                [ch.id]: String(groups[g]),
                              }))
                            }
                          }}
                          disabled={busy}
                          className='h-8 min-w-44'
                        >
                          <NativeSelectOption value='' disabled>
                            {t('Select a detected group…')}
                          </NativeSelectOption>
                          {Object.entries(groups).map(([g, ratio]) => (
                            <NativeSelectOption key={g} value={g}>
                              {g} ({ratio}x)
                            </NativeSelectOption>
                          ))}
                          <NativeSelectOption value='__manual__'>
                            {t('Manual entry')}
                          </NativeSelectOption>
                        </NativeSelect>
                      ) : null}
                      <Input
                        type='number'
                        placeholder='1'
                        value={channelFactorInput[ch.id] ?? ''}
                        onChange={(e) => {
                          setChannelFactorInput((prev) => ({
                            ...prev,
                            [ch.id]: e.target.value,
                          }))
                          // 手动改动输入框即视为脱离下拉选择，避免显示误导性的"已选某分组"状态
                          setChannelGroupChoice((prev) => ({
                            ...prev,
                            [ch.id]: '',
                          }))
                        }}
                        disabled={busy}
                        className='h-8 w-24'
                      />
                      {choice ? (
                        <Badge variant='secondary' className='shrink-0'>
                          {t('Confirmed: {{group}}', { group: choice })}
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
