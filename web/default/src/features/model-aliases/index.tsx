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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { batchUpdateModelMapping, getChannelMappingOverview } from './api'
import { AliasGroupCard } from './components/alias-group-card'
import { buildAliasGroups, buildUpdatesFromGroups } from './lib/alias-grouping'
import { modelAliasesQueryKeys } from './lib/query-keys'
import type { AliasGroup, ChannelMappingRow } from './types'

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
            groups.map((group) => (
              <AliasGroupCard
                key={group.id}
                group={group}
                onChange={updateGroup}
                onApply={(g) => applyGroups([g], g.id)}
                applying={applyingId === group.id || applyingId === '__all__'}
              />
            ))
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
