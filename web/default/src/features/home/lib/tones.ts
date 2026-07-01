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
/**
 * Shared warm/cool color tones for home page cards.
 *
 * Tailwind cannot see runtime-concatenated class names, so every class string
 * here is written out in full (static) — same approach as the hero terminal
 * demo's ACCENT_CLASSES. Reference TONES[key] and use the fields you need.
 */
export type ToneKey = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan'

export interface Tone {
  /** Soft diagonal gradient wash for a card background */
  cardBg: string
  /** Icon / badge container background + foreground */
  iconBox: string
  /** Accent text (numbers, labels, links) */
  text: string
  /** Small tag chip */
  chip: string
  /** Solid accent bar / dot */
  bar: string
  /** Border tint on hover */
  hoverBorder: string
}

export const TONES: Record<ToneKey, Tone> = {
  blue: {
    cardBg:
      'bg-gradient-to-br from-blue-500/[0.09] via-blue-500/[0.02] to-transparent',
    iconBox:
      'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    chip: 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    bar: 'bg-blue-500',
    hoverBorder: 'hover:border-blue-500/40',
  },
  violet: {
    cardBg:
      'bg-gradient-to-br from-violet-500/[0.09] via-violet-500/[0.02] to-transparent',
    iconBox:
      'bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
    text: 'text-violet-600 dark:text-violet-400',
    chip: 'border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    hoverBorder: 'hover:border-violet-500/40',
  },
  emerald: {
    cardBg:
      'bg-gradient-to-br from-emerald-500/[0.09] via-emerald-500/[0.02] to-transparent',
    iconBox:
      'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    chip: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    hoverBorder: 'hover:border-emerald-500/40',
  },
  amber: {
    cardBg:
      'bg-gradient-to-br from-amber-500/[0.10] via-amber-500/[0.02] to-transparent',
    iconBox:
      'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-500',
    chip: 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    hoverBorder: 'hover:border-amber-500/40',
  },
  rose: {
    cardBg:
      'bg-gradient-to-br from-rose-500/[0.09] via-rose-500/[0.02] to-transparent',
    iconBox:
      'bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    chip: 'border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300',
    bar: 'bg-rose-500',
    hoverBorder: 'hover:border-rose-500/40',
  },
  cyan: {
    cardBg:
      'bg-gradient-to-br from-cyan-500/[0.09] via-cyan-500/[0.02] to-transparent',
    iconBox:
      'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400',
    text: 'text-cyan-600 dark:text-cyan-400',
    chip: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300',
    bar: 'bg-cyan-500',
    hoverBorder: 'hover:border-cyan-500/40',
  },
}
