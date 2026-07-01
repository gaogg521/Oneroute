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

/** A single navigable documentation page in the sidebar. */
export interface DocNavItem {
  /** Display label (already translated). */
  label: string
  /** Internal route path, e.g. /docs/api/nanobanana-2 */
  to: string
  /** Optional badge shown before the label, e.g. an HTTP method. */
  badge?: string
}

/** A labelled group of doc pages in the sidebar. */
export interface DocNavGroup {
  /** Group heading (already translated). */
  title: string
  items: DocNavItem[]
}
