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
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { groupOptionsByVendor, type VendorIndex } from '../lib/vendor-grouping'

type VendorModelComboboxProps = {
  value: string
  onChange: (value: string) => void
  options: string[]
  vendorIndex: VendorIndex
  disabled?: boolean
  className?: string
}

/**
 * 可搜索的「真实上游模型」选择器：选项按供应商分组（复用模型广场归类），
 * 分组标题带供应商图标（LobeHub），支持输入过滤。渠道模型很多时体验优于原生 select。
 */
export function VendorModelCombobox({
  value,
  onChange,
  options,
  vendorIndex,
  disabled,
  className,
}: VendorModelComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const isMobile = useIsMobile()

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const opts = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options
    return groupOptionsByVendor(opts, vendorIndex)
  }, [options, query, vendorIndex])

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  const content = (
    <Command
      className='rounded-lg border-0 bg-transparent'
      filter={() => 1}
      shouldFilter={false}
    >
      <CommandInput
        placeholder={t('Search models...')}
        className='h-9'
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className={isMobile ? 'max-h-[50vh]' : 'max-h-[280px]'}>
        {grouped.length === 0 ? (
          <div className='text-muted-foreground px-3 py-6 text-center text-xs'>
            {t('No model found.')}
          </div>
        ) : (
          grouped.map((g) => (
            <CommandGroup key={g.vendor || '__other__'} className='p-1'>
              <div className='text-muted-foreground flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium'>
                {g.vendor ? (
                  <>
                    <span className='flex size-3.5 shrink-0 items-center justify-center'>
                      {getLobeIcon(vendorIndex.vendorIcon.get(g.vendor), 14)}
                    </span>
                    <span className='truncate'>{g.vendor}</span>
                  </>
                ) : (
                  t('Other')
                )}
              </div>
              {g.models.map((m) => (
                <CommandItem
                  key={m}
                  value={m}
                  onSelect={() => select(m)}
                  className='mb-0.5 flex items-center justify-between rounded-md px-2 py-1.5 text-xs'
                >
                  <span className='min-w-0 truncate font-medium'>{m}</span>
                  <Check
                    className={cn(
                      'ml-2 size-3.5 shrink-0',
                      value === m ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          ))
        )}
      </CommandList>
    </Command>
  )

  const trigger = (
    <Button
      variant='outline'
      role='combobox'
      size='sm'
      disabled={disabled}
      aria-expanded={open}
      className={cn(
        'h-8 min-w-48 justify-between gap-2 px-2.5 font-normal shadow-none',
        className
      )}
    >
      <span className='min-w-0 truncate text-xs'>
        {value || t('Select model')}
      </span>
      <ChevronsUpDown className='text-muted-foreground size-3.5 shrink-0 opacity-60' />
    </Button>
  )

  return isMobile ? (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className='flex max-h-[80vh] min-h-[50vh] flex-col'>
        <DrawerHeader className='pb-2 text-left'>
          <DrawerTitle>{t('Real upstream model')}</DrawerTitle>
        </DrawerHeader>
        <div className='min-h-0 flex-1 overflow-hidden px-2 pb-4'>
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align='end'
        side='bottom'
        sideOffset={4}
        collisionPadding={8}
        className='bg-popover z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border p-0 shadow-lg'
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
