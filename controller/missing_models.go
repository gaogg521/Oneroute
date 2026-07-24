package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetMissingModels returns the list of model names that are referenced by channels
// but do not have corresponding records in the models meta table.
// This helps administrators quickly discover models that need configuration.
func GetMissingModels(c *gin.Context) {
	missing, err := model.GetMissingModels()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    missing,
	})
}

// GetEnabledModelNames returns the deduplicated list of model names currently
// routable through some enabled channel (abilities table). Used by the
// pricing UI to distinguish "a channel actually uses this" from "this is
// just a built-in default price entry no channel references".
func GetEnabledModelNames(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    model.GetEnabledModels(),
	})
}

// GetMissingPricingModels returns enabled models that have no configured
// price (neither ModelRatio nor ModelPrice), along with real usage stats so
// admins can prioritize models that are actually being billed at the
// fallback ratio.
func GetMissingPricingModels(c *gin.Context) {
	missing, err := model.GetMissingPricingModels()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    missing,
	})
}
