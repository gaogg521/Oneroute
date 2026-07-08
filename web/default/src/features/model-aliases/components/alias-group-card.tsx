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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'

import { groupOptionsByVendor, type VendorIndex } from '../lib/vendor-grouping'
import type { AliasGroup, ChannelBinding } from '../types'

type AliasGroupCardProps = {
  group: AliasGroup
  vendorIndex: VendorIndex
  onChange: (group: AliasGroup) => void
  onApply: (group: AliasGroup) => void
  applying: boolean
}

export function AliasGroupCard({
  group,
  vendorIndex,
  onChange,
  onApply,
  applying,
}: AliasGroupCardProps) {
  const { t } = useTranslation()

  const includedCount = group.bindings.filter((b) => b.included).length
  const effectiveCount = group.bindings.filter(
    (b) => b.existingMapping || b.target === group.alias
  ).length

  const updateBinding = (channelId: number, patch: Partial<ChannelBinding>) => {
    onChange({
      ...group,
      bindings: group.bindings.map((b) =>
        b.channelId === channelId ? { ...b, ...patch } : b
      ),
    })
  }

  const aliasInvalid = group.alias.trim().length === 0

  return (
    <Card>
      <CardHeader className='gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <label className='text-muted-foreground text-xs font-medium'>
              {t('Unified Alias')}
            </label>
            <Input
              value={group.alias}
              onChange={(e) => onChange({ ...group, alias: e.target.value })}
              placeholder={t('Enter a unified model name')}
              className='max-w-xs font-mono'
              aria-invalid={aliasInvalid}
              disabled={applying}
            />
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>
              {t('{{count}} channels', { count: includedCount })}
            </Badge>
            {effectiveCount > 0 ? (
              <Badge variant='outline'>
                {t('{{count}} in effect', { count: effectiveCount })}
              </Badge>
            ) : null}
            <Button
              size='sm'
              onClick={() => onApply(group)}
              disabled={applying || aliasInvalid || includedCount === 0}
            >
              {applying ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              {t('Apply')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        {group.bindings.map((b) => {
          const options = Array.from(
            new Set([b.target, ...b.availableModels].filter(Boolean))
          )
          const vendorGroups = groupOptionsByVendor(options, vendorIndex)
          // 仅当只有一个「未归类」分组时才平铺，否则一律按供应商分组
          const flat =
            vendorGroups.length === 1 && vendorGroups[0].vendor === ''
          return (
            <div
              key={b.channelId}
              className='border-border/60 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2'
            >
              <Checkbox
                checked={b.included}
                onCheckedChange={(checked) =>
                  updateBinding(b.channelId, { included: checked === true })
                }
                disabled={applying}
              />
              <div className='flex min-w-0 flex-1 items-center gap-2'>
                <span className='truncate text-sm font-medium'>
                  {b.channelName}
                </span>
                <span className='text-muted-foreground text-xs'>
                  #{b.channelId}
                </span>
                {b.channelStatus !== 1 ? (
                  <Badge variant='destructive'>{t('Disabled')}</Badge>
                ) : null}
                {b.existingMapping ? (
                  <Badge variant='outline'>{t('In effect')}</Badge>
                ) : null}
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-xs'>
                  {t('Real upstream model')}
                </span>
                <NativeSelect
                  size='sm'
                  value={b.target}
                  onChange={(e) =>
                    updateBinding(b.channelId, { target: e.target.value })
                  }
                  disabled={applying || !b.included}
                  className='min-w-48'
                >
                  {flat
                    ? options.map((opt) => (
                        <NativeSelectOption key={opt} value={opt}>
                          {opt}
                        </NativeSelectOption>
                      ))
                    : vendorGroups.map((vg) => (
                        <NativeSelectOptGroup
                          key={vg.vendor || '__other__'}
                          label={vg.vendor || t('Other')}
                        >
                          {vg.models.map((opt) => (
                            <NativeSelectOption key={opt} value={opt}>
                              {opt}
                            </NativeSelectOption>
                          ))}
                        </NativeSelectOptGroup>
                      ))}
                </NativeSelect>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
