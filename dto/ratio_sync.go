package dto

type UpstreamDTO struct {
	ID       int    `json:"id,omitempty"`
	Name     string `json:"name" binding:"required"`
	BaseURL  string `json:"base_url" binding:"required"`
	Endpoint string `json:"endpoint"`
}

type UpstreamRequest struct {
	ChannelIDs []int64       `json:"channel_ids"`
	Upstreams  []UpstreamDTO `json:"upstreams"`
	Timeout    int           `json:"timeout"`
}

// TestResult 上游测试连通性结果
type TestResult struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
	// GroupRatio 上游 /api/pricing 响应里随附的分组倍率（如 {"default":0.7}）。
	// 该请求已用本渠道自身的 API Key 认证，故这里反映的是"我方这个渠道在上游
	// 落在哪个分组、上游对该分组打了多少折"，可用于修正批量加价的成本基准。
	// 仅 /api/pricing（type2）格式的上游会有此字段，其余格式为空。
	GroupRatio map[string]float64 `json:"group_ratio,omitempty"`
}

// DifferenceItem 差异项
// Current 为本地值，可能为 nil
// Upstreams 为各渠道的上游值，具体数值 / "same" / nil

type DifferenceItem struct {
	Current    interface{}            `json:"current"`
	Upstreams  map[string]interface{} `json:"upstreams"`
	Confidence map[string]bool        `json:"confidence"`
}

type SyncableChannel struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	BaseURL string `json:"base_url"`
	Status  int    `json:"status"`
	Type    int    `json:"type"`
}
