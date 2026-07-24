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
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getMissingPricingModels } from '@/features/models/api'
import { modelsQueryKeys } from '@/features/models/lib/query-keys'
import type { MissingPricingModel } from '@/features/models/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { formatLogQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

type MissingPricingPanelProps = {
  onConfigure: (modelName: string) => void
}

function ModelRow({
  model,
  onConfigure,
  emphasize,
}: {
  model: MissingPricingModel
  onConfigure: (modelName: string) => void
  emphasize: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'>
      <div className='min-w-0 flex-1'>
        <div className='truncate font-mono text-sm'>{model.model_name}</div>
        {emphasize && (
          <div className='text-muted-foreground text-xs'>
            {t('{{count}} requests, {{amount}} billed at the fallback ratio', {
              count: model.request_count,
              amount: formatLogQuota(model.total_quota),
            })}
          </div>
        )}
      </div>
      <Button size='sm' variant='outline' onClick={() => onConfigure(model.model_name)}>
        {t('Configure now')}
      </Button>
    </div>
  )
}

export function MissingPricingPanel({ onConfigure }: MissingPricingPanelProps) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [showUnused, setShowUnused] = useState(false)
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: modelsQueryKeys.missingPricing(),
    queryFn: getMissingPricingModels,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const totalCount = data?.data?.length ?? 0

  const { used, unused } = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = (data?.data ?? []).filter((row) =>
      term === '' ? true : row.model_name.toLowerCase().includes(term)
    )
    const used = rows
      .filter((row) => row.request_count > 0)
      .sort((a, b) => b.total_quota - a.total_quota)
    const unused = rows.filter((row) => row.request_count === 0)
    return { used, unused }
  }, [data, search])

  if (dismissed || totalCount === 0) return null

  return (
    <div className='bg-card flex flex-col gap-2 rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <TriangleAlert className='text-destructive size-4 shrink-0' />
          <span className='text-sm font-medium'>
            {t('{{count}} unpriced models detected in your channels', {
              count: totalCount,
            })}
          </span>
        </div>
        <Button
          size='icon-xs'
          variant='ghost'
          aria-label={t('Dismiss')}
          onClick={() => setDismissed(true)}
        >
          <X />
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search unpriced models...')}
        className='h-8'
      />

      {search.trim() !== '' && used.length === 0 && unused.length === 0 && (
        <div className='text-muted-foreground py-2 text-center text-xs'>
          {t('No unpriced models match your search')}
        </div>
      )}

      {used.length > 0 && (
        <div className='flex flex-col gap-2'>
          {used.map((model) => (
            <ModelRow
              key={model.model_name}
              model={model}
              onConfigure={onConfigure}
              emphasize
            />
          ))}
        </div>
      )}

      {unused.length > 0 && (
        <Collapsible
          open={showUnused || search.trim() !== ''}
          onOpenChange={setShowUnused}
        >
          <CollapsibleTrigger
            render={
              <button
                type='button'
                className='text-muted-foreground flex items-center gap-1 text-xs hover:underline'
              />
            }
          >
            <ChevronDown
              className={cn(
                'size-3 transition-transform',
                showUnused && 'rotate-180'
              )}
            />
            {t('{{count}} more declared in channels but never called', {
              count: unused.length,
            })}
            <Badge variant='secondary'>{unused.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className='mt-2 flex flex-col gap-2'>
              {unused.map((model) => (
                <ModelRow
                  key={model.model_name}
                  model={model}
                  onConfigure={onConfigure}
                  emphasize={false}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
