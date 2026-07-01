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
package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"github.com/gin-gonic/gin"
)

// CreateTeamTokenV3 creates a token bound to the team and returns the full key (only shown once)
func CreateTeamTokenV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	member, err := model.GetTeamMemberForAuth(teamId, userId)
	if err != nil {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	if member.Role != model.TeamRoleOwner && member.Role != model.TeamRoleAdmin {
		common.ApiErrorMsg(c, "权限不足，仅管理员可创建团队 Token")
		return
	}
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "请输入 Token 名称")
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorMsg(c, "生成 Token 失败")
		return
	}
	token := &model.Token{
		UserId:         userId,
		Name:           body.Name,
		Key:            key,
		TeamId:         teamId,
		UnlimitedQuota: true,
		ExpiredTime:    -1,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
	}
	if err := token.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"key": key, "name": token.Name})
}

// CreateTeamV3 creates a new team
func CreateTeamV3(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误：团队名称不能为空")
		return
	}
	team, err := model.CreateTeam(body.Name, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, team)
}

// GetMyTeamV3 returns the team the current user belongs to
func GetMyTeamV3(c *gin.Context) {
	userId := c.GetInt("id")
	team, member, err := model.GetUserTeam(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if team == nil {
		common.ApiSuccess(c, nil)
		return
	}
	common.ApiSuccess(c, gin.H{
		"team":   team,
		"member": member,
	})
}

// GetTeamInfoV3 returns team detail (only for members)
func GetTeamInfoV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !model.IsTeamMember(teamId, userId) {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	team, err := model.GetTeamById(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, team)
}

// UpdateTeamV3 updates team info
func UpdateTeamV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var body struct {
		Name        string `json:"name"`
		SharedQuota int    `json:"shared_quota"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.UpdateTeam(teamId, userId, body.Name, body.SharedQuota); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RegenerateInviteCodeV3 generates a new invite code
func RegenerateInviteCodeV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	code, err := model.RegenerateInviteCode(teamId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"invite_code": code})
}

// DisbandTeamV3 deletes the team (owner only)
func DisbandTeamV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.DisbandTeam(teamId, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// JoinTeamByCodeV3 lets a user join a team via invite code
func JoinTeamByCodeV3(c *gin.Context) {
	userId := c.GetInt("id")
	inviteCode := c.Param("code")
	team, err := model.JoinTeamByCode(inviteCode, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, team)
}

// GetTeamByInviteCodeV3 returns team info for an invite code (preview before joining)
func GetTeamByInviteCodeV3(c *gin.Context) {
	inviteCode := c.Param("code")
	team, err := model.GetTeamByInviteCode(inviteCode)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, team)
}

// GetTeamMembersV3 returns all members of a team
func GetTeamMembersV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	myMember, err := model.GetTeamMemberForAuth(teamId, userId)
	if err != nil {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	isAdmin := myMember.Role == model.TeamRoleOwner || myMember.Role == model.TeamRoleAdmin
	members, err := model.GetTeamMembers(teamId, !isAdmin)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

// UpdateTeamMemberV3 updates role or quota_limit for a team member
func UpdateTeamMemberV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	targetUserId, err := strconv.Atoi(c.Param("uid"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var body struct {
		Role       string `json:"role"`
		QuotaLimit int    `json:"quota_limit"`
		Position   string `json:"position"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.UpdateTeamMember(teamId, userId, targetUserId, body.Role, body.QuotaLimit, body.Position); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RemoveTeamMemberV3 removes a member from the team
func RemoveTeamMemberV3Handler(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	targetUserId, err := strconv.Atoi(c.Param("uid"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.RemoveTeamMemberV3(teamId, userId, targetUserId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GetTeamTokensV3 returns tokens belonging to the team
func GetTeamTokensV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !model.IsTeamMember(teamId, userId) {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	tokens, err := model.GetTeamAllTokens(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tokens)
}

// GetTeamStatsV3 returns aggregated usage stats for a team
func GetTeamStatsV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !model.IsTeamMember(teamId, userId) {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	stats, err := model.GetTeamStats(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

// AdminListTeamsV3 lists all enterprise teams (admin only)
func AdminListTeamsV3(c *gin.Context) {
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	teams, total, err := model.AdminGetAllTeams(keyword, offset, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": teams,
		"total": total,
		"page":  page,
	})
}

// AdminDisbandTeamV3 forcefully disbands any team (admin only)
func AdminDisbandTeamV3(c *gin.Context) {
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.AdminDisbandTeam(teamId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// TransferOwnershipV3 lets the current owner transfer ownership to another member
func TransferOwnershipV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var body struct {
		NewOwnerId int `json:"new_owner_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "请指定新创建者")
		return
	}
	if err := model.TransferOwnership(teamId, userId, body.NewOwnerId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminTransferOwnershipV3 lets super-admin forcefully set any member as owner
func AdminTransferOwnershipV3(c *gin.Context) {
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var body struct {
		NewOwnerId int `json:"new_owner_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "请指定新创建者")
		return
	}
	if err := model.TransferOwnership(teamId, -1, body.NewOwnerId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminGetTeamMembersV3 returns members of any team (admin only)
func AdminGetTeamMembersV3(c *gin.Context) {
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	members, err := model.GetTeamMembers(teamId, false) // super-admin sees full keys
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, members)
}

// GetTeamMembersUsageV3 returns usage stats broken down by member
func GetTeamMembersUsageV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if !model.IsTeamMember(teamId, userId) {
		common.ApiErrorMsg(c, "您不是该团队成员")
		return
	}
	usage, err := model.GetTeamMembersUsage(teamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, usage)
}

// CreateTeamMemberV3 creates a new user account, auto-generates password + API key, adds to team
func CreateTeamMemberV3(c *gin.Context) {
	userId := c.GetInt("id")
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	member, err := model.GetTeamMemberForAuth(teamId, userId)
	if err != nil || (member.Role != model.TeamRoleOwner && member.Role != model.TeamRoleAdmin) {
		common.ApiErrorMsg(c, "权限不足")
		return
	}
	var body struct {
		Username    string `json:"username" binding:"required"`
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "用户名不能为空")
		return
	}
	if len(body.Username) < 3 || len(body.Username) > 20 {
		common.ApiErrorMsg(c, "用户名长度需在 3-20 位之间")
		return
	}
	// Auto-generate a 16-char alphanumeric password
	password, err := common.GenerateRandomCharsKey(16)
	if err != nil {
		common.ApiErrorMsg(c, "生成密码失败")
		return
	}
	displayName := body.DisplayName
	if displayName == "" {
		displayName = body.Username
	}
	// Generate the API key before starting the transaction to avoid slow crypto-random work inside DB lock
	apiKey, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorMsg(c, "生成默认密钥失败")
		return
	}

	newUser := &model.User{
		Username:    body.Username,
		Password:    password,
		DisplayName: displayName,
		Role:        1,
	}

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		// Step 1: Create user with Tx
		if err := newUser.InsertWithTx(tx, userId); err != nil {
			return err
		}
		// Step 2: Add the new user to the team with Tx
		teamMember := &model.TeamMember{
			TeamId: teamId,
			UserId: newUser.Id,
			Role:   model.TeamRoleMember,
		}
		if err := tx.Create(teamMember).Error; err != nil {
			return err
		}
		// Step 3: Create the default API Key (Token) with Tx
		token := &model.Token{
			UserId:         newUser.Id,
			Name:           "默认密钥",
			Key:            apiKey,
			TeamId:         0,
			UnlimitedQuota: true,
			ExpiredTime:    -1,
			CreatedTime:    common.GetTimestamp(),
			AccessedTime:   common.GetTimestamp(),
		}
		if err := tx.Create(token).Error; err != nil {
			return err
		}
		return nil
	})

	if txErr != nil {
		common.ApiError(c, txErr)
		return
	}

	// Transaction committed successfully, run post-commit side effects (sidebar, logs, inviter quota)
	newUser.FinalizeOAuthUserCreation(userId)

	common.ApiSuccess(c, gin.H{
		"id":           newUser.Id,
		"username":     newUser.Username,
		"display_name": displayName,
		"password":     password,
		"api_key":      apiKey,
	})
}
