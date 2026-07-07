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
import { api, type ApiRequestConfig } from '@/lib/api'

import type {
  BatchUpdateItem,
  BatchUpdateResponse,
  ChannelMappingOverviewResponse,
} from './types'

const actionConfig = (config: ApiRequestConfig = {}): ApiRequestConfig => ({
  ...config,
  skipBusinessError: true,
  skipErrorHandler: true,
})

/** 拉取所有渠道的精简映射视图 */
export async function getChannelMappingOverview(): Promise<ChannelMappingOverviewResponse> {
  const res = await api.get('/api/channel/model_mapping/overview')
  return res.data
}

/** 批量给各渠道下发各自的 model_mapping（可选同时更新 models） */
export async function batchUpdateModelMapping(
  updates: BatchUpdateItem[]
): Promise<BatchUpdateResponse> {
  const res = await api.post(
    '/api/channel/batch/model_mapping',
    { updates },
    actionConfig()
  )
  return res.data
}
