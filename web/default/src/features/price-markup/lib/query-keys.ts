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

/** React Query cache keys for the price-markup feature */
export const priceMarkupQueryKeys = {
  all: ['price-markup'] as const,
  channels: () => [...priceMarkupQueryKeys.all, 'channels'] as const,
  pricing: () => [...priceMarkupQueryKeys.all, 'pricing'] as const,
  /** 持久化的加价记录 + 当前系统价格（同一份 getSystemOptions 派生两种视图） */
  history: () => [...priceMarkupQueryKeys.all, 'history'] as const,
}
