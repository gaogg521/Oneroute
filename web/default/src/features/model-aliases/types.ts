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

/** 后端返回的精简渠道视图（GET /api/channel/model_mapping/overview） */
export type ChannelMappingRow = {
  id: number
  name: string
  type: number
  status: number
  group: string
  models: string // 逗号分隔的模型名列表
  model_mapping: string // JSON 字符串 {客户端请求名: 上游真实名}
}

export type ChannelMappingOverviewResponse = {
  success: boolean
  message?: string
  data?: ChannelMappingRow[]
}

/** 单个渠道的映射补丁（POST /api/channel/batch/model_mapping） */
export type BatchUpdateItem = {
  id: number
  model_mapping: string
  models?: string
}

export type BatchUpdateResponse = {
  success: boolean
  message?: string
  data?: { updated: number }
}

/** 别名组内某个渠道的绑定关系 */
export type ChannelBinding = {
  channelId: number
  channelName: string
  channelStatus: number
  /** 该渠道现有模型名，作为「真实上游名」下拉选项 */
  availableModels: string[]
  /** 选中的真实上游模型名 */
  target: string
  /** 是否把该渠道纳入本别名 */
  included: boolean
  /** 该渠道当前 model_mapping[alias]，非空表示别名已生效 */
  existingMapping: string
}

/** 一个统一别名分组 */
export type AliasGroup = {
  /** 稳定 key（规范化后的模型键），用于 React key 与去重 */
  id: string
  /** 建议/编辑后的统一别名名 */
  alias: string
  bindings: ChannelBinding[]
}
