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
import type { ColumnDef } from '@tanstack/react-table'

import { DataTableColumnHeader } from '@/components/data-table/core/column-header'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { StatusBadge } from '@/components/status-badge'
import { Checkbox } from '@/components/ui/checkbox'

import {
  getModeLabel,
  getModeVariant,
  getPriceDetail,
  getPriceSummary,
  type ModelRow,
} from './model-pricing-snapshots'
import type { PriceSourceEntry } from './price-source'

const filterBySelectedValues = (
  rowValue: unknown,
  filterValue: unknown
): boolean => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  return filterValue.includes(String(rowValue))
}

/** 价格来源徽章：手动 / 同步·渠道 / 加价·渠道；无来源记录返回 null 不显示 */
function buildSourceBadge(
  entry: PriceSourceEntry | undefined,
  t: (key: string) => string
): { label: string; variant: 'neutral' | 'info' | 'warning' } | null {
  if (!entry) return null
  const channel = entry.channel ? `·${entry.channel}` : ''
  switch (entry.source) {
    case 'manual':
      return { label: t('Manual'), variant: 'neutral' }
    case 'upstream_sync':
      return { label: `${t('Synced')}${channel}`, variant: 'info' }
    case 'batch_markup':
      return { label: `${t('Markup')}${channel}`, variant: 'warning' }
    default:
      return null
  }
}

type BuildModelRatioColumnsOptions = {
  onDelete: (name: string) => void
  onEdit: (model: ModelRow) => void
  isChannelInUse: (name: string) => boolean
  priceSource: (name: string) => PriceSourceEntry | undefined
  t: (key: string) => string
}

export function buildModelRatioColumns({
  onDelete,
  onEdit,
  isChannelInUse,
  priceSource,
  t,
}: BuildModelRatioColumnsOptions): ColumnDef<ModelRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model name')} />
      ),
      cell: ({ row }) => {
        const src = priceSource(row.original.name)
        const srcBadge = buildSourceBadge(src, t)
        return (
        <div className='flex min-w-0 flex-col gap-1 font-medium'>
          <span className='min-w-0 truncate' title={row.getValue('name')}>
            {row.getValue('name')}
          </span>
          <div className='flex flex-wrap items-center gap-1.5'>
            {isChannelInUse(row.original.name) ? (
              <StatusBadge
                label={t('In use')}
                variant='success'
                copyable={false}
                showDot={false}
                className='shrink-0'
              />
            ) : (
              <StatusBadge
                label={t('Built-in default')}
                variant='neutral'
                copyable={false}
                showDot={false}
                className='shrink-0'
              />
            )}
            {srcBadge && (
              <StatusBadge
                label={srcBadge.label}
                variant={srcBadge.variant}
                copyable={false}
                showDot={false}
                className='shrink-0'
              />
            )}
            {row.original.billingMode === 'tiered_expr' && (
              <StatusBadge
                label={t('Tiered')}
                variant='info'
                copyable={false}
                className='shrink-0'
              />
            )}
            {row.original.hasConflict && (
              <StatusBadge
                label={t('Conflict')}
                variant='danger'
                copyable={false}
                className='shrink-0'
              />
            )}
          </div>
        </div>
        )
      },
      enableHiding: false,
    },
    {
      accessorKey: 'billingMode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Mode')} />
      ),
      cell: ({ row }) => (
        <StatusBadge
          label={t(getModeLabel(row.original.billingMode))}
          variant={getModeVariant(row.original.billingMode)}
          copyable={false}
          showDot={false}
          className='-ml-1.5 px-0'
        />
      ),
      filterFn: (row, id, value) =>
        filterBySelectedValues(row.getValue(id), value),
      meta: { label: t('Mode') },
    },
    {
      id: 'priceSummary',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Price summary')} />
      ),
      cell: ({ row }) => (
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='truncate font-medium'>
            {getPriceSummary(row.original, t)}
          </span>
          <span className='text-muted-foreground truncate text-xs'>
            {getPriceDetail(row.original, t)}
          </span>
        </div>
      ),
      sortingFn: (rowA, rowB) =>
        getPriceSummary(rowA.original, t).localeCompare(
          getPriceSummary(rowB.original, t)
        ),
      meta: { label: t('Price summary') },
    },
    {
      id: 'actions',
      header: () => <div>{t('Actions')}</div>,
      cell: ({ row }) => (
        <StaticRowActions
          editLabel={t('Edit')}
          deleteLabel={t('Delete')}
          menuLabel={t('Open menu')}
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original.name)}
        />
      ),
      enableHiding: false,
    },
  ]
}
