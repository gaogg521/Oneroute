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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2 } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getPricing } from '@/features/pricing/api'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { batchUpdateModelMapping, getChannelMappingOverview } from './api'
import { AliasGroupCard } from './components/alias-group-card'
import { buildAliasGroups, buildUpdatesFromGroups } from './lib/alias-grouping'
import { modelAliasesQueryKeys } from './lib/query-keys'
import { buildVendorIndex, resolveVendor } from './lib/vendor-grouping'
import type { AliasGroup, ChannelMappingRow } from './types'

const ALL = '__all__'
const OTHER = '__other__'

export function ModelAliases() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: modelAliasesQueryKeys.overview(),
    queryFn: getChannelMappingOverview,
  })

  const channels: ChannelMappingRow[] = useMemo(
    () => data?.data ?? [],
    [data]
  )

  // 供应商归类：复用模型广场的 /api/pricing（Model.vendor_id → Vendor），用于下拉分组
  const { data: pricing } = useQuery({
    queryKey: modelAliasesQueryKeys.pricing(),
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })
  const vendorIndex = useMemo(() => buildVendorIndex(pricing), [pricing])

  // 从服务端数据自动聚类出建议分组
  const baseGroups = useMemo(() => buildAliasGroups(channels), [channels])

  // 可编辑的工作副本，服务端数据变化时重置
  const [groups, setGroups] = useState<AliasGroup[]>(baseGroups)
  useEffect(() => {
    setGroups(baseGroups)
  }, [baseGroups])

  // 正在应用的分组 id；'__all__' 表示一键全部应用
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const updateGroup = (updated: AliasGroup) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === updated.id ? updated : g))
    )
  }

  const applyGroups = async (targetGroups: AliasGroup[], busyId: string) => {
    const updates = buildUpdatesFromGroups(targetGroups, channels)
    if (updates.length === 0) {
      toast.warning(t('No channels to update'))
      return
    }
    setApplyingId(busyId)
    try {
      const res = await batchUpdateModelMapping(updates)
      if (res.success) {
        toast.success(
          t('Applied to {{count}} channels', {
            count: res.data?.updated ?? updates.length,
          })
        )
        await queryClient.invalidateQueries({
          queryKey: modelAliasesQueryKeys.overview(),
        })
      } else {
        toast.error(res.message || t('Failed to apply aliases'))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('Failed to apply aliases'))
    } finally {
      setApplyingId(null)
    }
  }

  const applicableGroups = groups.filter(
    (g) => g.alias.trim() && g.bindings.some((b) => b.included)
  )

  // 每个别名组归属的供应商（''=未归类），用于左侧过滤
  const vendorOf = (g: AliasGroup) => resolveVendor(g.alias, vendorIndex) || OTHER

  // 供应商 → 别名组，按模型广场顺序排列，未归类排最后
  const vendorBuckets = useMemo(() => {
    const m = new Map<string, AliasGroup[]>()
    for (const g of groups) {
      const v = vendorOf(g)
      const list = m.get(v)
      if (list) list.push(g)
      else m.set(v, [g])
    }
    const ordered: Array<{ vendor: string; groups: AliasGroup[] }> = []
    for (const v of vendorIndex.vendorOrder) {
      if (m.has(v)) {
        ordered.push({ vendor: v, groups: m.get(v)! })
        m.delete(v)
      }
    }
    for (const [v, gs] of m) {
      if (v !== OTHER) ordered.push({ vendor: v, groups: gs })
    }
    if (m.has(OTHER)) ordered.push({ vendor: OTHER, groups: m.get(OTHER)! })
    return ordered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, vendorIndex])

  const [selectedVendor, setSelectedVendor] = useState<string>(ALL)
  const filteredGroups =
    selectedVendor === ALL
      ? groups
      : (vendorBuckets.find((b) => b.vendor === selectedVendor)?.groups ?? [])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Model Aliases')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          size='sm'
          onClick={() => applyGroups(applicableGroups, '__all__')}
          disabled={applyingId !== null || applicableGroups.length === 0}
        >
          {applyingId === '__all__' ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : null}
          {t('Apply all')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Alert>
            <Info className='h-4 w-4' />
            <AlertTitle>{t('Unify differently-named models')}</AlertTitle>
            <AlertDescription>
              {t(
                'Channels are auto-grouped by model-name similarity. Review each suggested alias, adjust the real upstream model per channel, then apply. Applying is additive — the original model names remain callable.'
              )}
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className='flex items-center justify-center py-16'>
              <Spinner className='size-6' />
            </div>
          ) : isError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('Failed to load channels')}</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : String(error)}
              </AlertDescription>
            </Alert>
          ) : groups.length === 0 ? (
            <Alert>
              <Info className='h-4 w-4' />
              <AlertTitle>{t('No alias suggestions')}</AlertTitle>
              <AlertDescription>
                {t(
                  'No differently-named duplicate models were found across your channels. Aliases are suggested when the same model appears under different names in two or more channels.'
                )}
              </AlertDescription>
            </Alert>
          ) : (
            <div className='grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]'>
              {/* 左侧：按供应商过滤 */}
              <div className='md:border-border/60 flex flex-col gap-1 md:max-h-[calc(100vh-14rem)] md:overflow-y-auto md:border-r md:pr-3'>
                <div className='text-muted-foreground px-1 pb-1 text-xs font-medium'>
                  {t('Filter by vendor')}
                </div>
                <VendorFilterItem
                  label={t('All')}
                  count={groups.length}
                  active={selectedVendor === ALL}
                  onClick={() => setSelectedVendor(ALL)}
                />
                {vendorBuckets.map((b) => (
                  <VendorFilterItem
                    key={b.vendor}
                    icon={
                      b.vendor === OTHER
                        ? null
                        : getLobeIcon(vendorIndex.vendorIcon.get(b.vendor), 16)
                    }
                    label={b.vendor === OTHER ? t('Other') : b.vendor}
                    count={b.groups.length}
                    active={selectedVendor === b.vendor}
                    onClick={() => setSelectedVendor(b.vendor)}
                  />
                ))}
              </div>

              {/* 右侧：所选供应商的别名组 */}
              <div className='flex min-w-0 flex-col gap-4'>
                {filteredGroups.map((group) => (
                  <AliasGroupCard
                    key={group.id}
                    group={group}
                    vendorIndex={vendorIndex}
                    onChange={updateGroup}
                    onApply={(g) => applyGroups([g], g.id)}
                    applying={
                      applyingId === group.id || applyingId === '__all__'
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function VendorFilterItem(props: {
  icon?: ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        props.active
          ? 'bg-primary/10 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {props.icon ? (
        <span className='flex size-4 shrink-0 items-center justify-center'>
          {props.icon}
        </span>
      ) : (
        <span className='size-4 shrink-0' />
      )}
      <span className='min-w-0 flex-1 truncate'>{props.label}</span>
      <Badge variant='secondary' className='shrink-0'>
        {props.count}
      </Badge>
    </button>
  )
}
