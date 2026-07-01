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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface ParamRow {
  name: string
  type: string
  required?: boolean
  /** Description; may include JSX such as inline lists. */
  description: ReactNode
}

/** A request/response parameter table for API reference pages. */
export function ParamTable({ rows }: { rows: ParamRow[] }) {
  const { t } = useTranslation()
  return (
    <div className='border-border/60 my-4 overflow-x-auto rounded-xl border'>
      <table className='w-full border-collapse text-left text-sm'>
        <thead>
          <tr className='border-border/60 bg-muted/40 border-b'>
            <th className='px-4 py-2.5 font-semibold'>{t('Parameter')}</th>
            <th className='px-4 py-2.5 font-semibold'>{t('Type')}</th>
            <th className='px-4 py-2.5 font-semibold'>{t('Description')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              className='border-border/40 border-b last:border-b-0 align-top'
            >
              <td className='px-4 py-3 whitespace-nowrap'>
                <code className='text-foreground font-mono text-[13px]'>
                  {row.name}
                </code>
                {row.required ? (
                  <span className='ml-1.5 text-xs font-medium text-red-500'>
                    {t('required')}
                  </span>
                ) : null}
              </td>
              <td className='text-muted-foreground px-4 py-3 font-mono text-xs whitespace-nowrap'>
                {row.type}
              </td>
              <td className='text-muted-foreground px-4 py-3 text-sm leading-relaxed'>
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
