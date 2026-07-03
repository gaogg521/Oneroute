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

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Renders the "Test Connection" button + inline result text for a gateway settings section. */
export function TestConnectionButton({
  onTest,
  isPending,
  result,
  t,
}: {
  onTest: () => void
  isPending: boolean
  result: { success: boolean; message: string } | null
  t: (key: string) => string
}) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={isPending}
        onClick={onTest}
        className='w-fit'
      >
        {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
        {t('Test Connection')}
      </Button>
      {result && (
        <p
          className={cn(
            'text-sm',
            result.success
              ? 'text-green-600 dark:text-green-400'
              : 'text-destructive'
          )}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
