package model

import (
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetMissingModels returns model names that are referenced in the system
func GetMissingModels() ([]string, error) {
	// 1. 获取所有已启用模型（去重）
	models := GetEnabledModels()
	if len(models) == 0 {
		return []string{}, nil
	}

	// 2. 查询已有的元数据模型名
	var existing []string
	if err := DB.Model(&Model{}).Where("model_name IN ?", models).Pluck("model_name", &existing).Error; err != nil {
		return nil, err
	}

	existingSet := make(map[string]struct{}, len(existing))
	for _, e := range existing {
		existingSet[e] = struct{}{}
	}

	// 3. 收集缺失模型
	var missing []string
	for _, name := range models {
		if _, ok := existingSet[name]; !ok {
			missing = append(missing, name)
		}
	}
	return missing, nil
}

// MissingPricingModel is a model that channels can route to but that has no
// entry in either the ModelRatio or ModelPrice pricing tables.
type MissingPricingModel struct {
	ModelName    string `json:"model_name"`
	RequestCount int64  `json:"request_count"`
	TotalQuota   int64  `json:"total_quota"`
}

// GetMissingPricingModels returns enabled models that have no configured
// price (neither ModelRatio nor ModelPrice), enriched with real usage stats
// so the admin can prioritize models that are actually being billed at the
// fallback ratio over ones a channel merely declares but nobody calls.
func GetMissingPricingModels() ([]MissingPricingModel, error) {
	models := GetEnabledModels()
	if len(models) == 0 {
		return []MissingPricingModel{}, nil
	}

	priced := make(map[string]struct{})
	for name := range ratio_setting.GetModelRatioCopy() {
		priced[name] = struct{}{}
	}
	for name := range ratio_setting.GetModelPriceMap() {
		priced[name] = struct{}{}
	}
	// Tiered-expression models carry their whole price in billing_expr and often
	// have no ModelRatio/ModelPrice entry at all. Without this they would be
	// reported as unpriced even though they bill correctly.
	for name, expr := range billing_setting.GetBillingExprCopy() {
		if expr != "" {
			priced[name] = struct{}{}
		}
	}

	var unpriced []string
	for _, name := range models {
		if _, ok := priced[name]; !ok {
			unpriced = append(unpriced, name)
		}
	}
	if len(unpriced) == 0 {
		return []MissingPricingModel{}, nil
	}

	type usageRow struct {
		ModelName string
		Cnt       int64
		QuotaSum  int64
	}
	var rows []usageRow
	err := LOG_DB.Table("logs").
		Select("model_name, count(*) as cnt, sum(quota) as quota_sum").
		Where("type = ? AND model_name IN ?", LogTypeConsume, unpriced).
		Group("model_name").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	usage := make(map[string]usageRow, len(rows))
	for _, r := range rows {
		usage[r.ModelName] = r
	}

	result := make([]MissingPricingModel, 0, len(unpriced))
	for _, name := range unpriced {
		u := usage[name]
		result = append(result, MissingPricingModel{
			ModelName:    name,
			RequestCount: u.Cnt,
			TotalQuota:   u.QuotaSum,
		})
	}
	return result, nil
}
