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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type teamMemberTokenBrief struct {
	Id              int    `json:"id"`
	Name            string `json:"name"`
	Key             string `json:"key"`
	UsedQuota       int    `json:"used_quota"`
	RemainQuota     int    `json:"remain_quota"`
	UnlimitedQuota  bool   `json:"unlimited_quota"`
}

type teamMemberResp struct {
	Id          int                    `json:"id"`
	Username    string                 `json:"username"`
	DisplayName string                 `json:"display_name"`
	Email       string                 `json:"email"`
	Group       string                 `json:"group"`
	CreatedAt   int64                  `json:"created_at"`
	Quota       int                    `json:"quota"`
	UsedQuota   int                    `json:"used_quota"`
	Tokens      []teamMemberTokenBrief `json:"tokens"`
}

// GetMyTeam returns team members (users with inviter_id = current user) plus role/settings info
func GetMyTeam(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	// Check if the current user is a super admin / admin (role >= 10)
	me, err := model.GetUserById(userId, false)
	if err == nil && me != nil && me.Role >= common.RoleAdminUser {
		// Super Admin sees all team leaders (all invited relationships across the system)
		keyword := c.Query("keyword")
		leaders, total, err := model.AdminGetTeamLeaders(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.ApiError(c, err)
			return
		}
		pageInfo.SetTotal(int(total))
		pageInfo.SetItems(leaders)

		common.ApiSuccess(c, gin.H{
			"page":            pageInfo,
			"is_leader":       true,
			"is_admin":        true,
			"members_visible": true,
		})
		return
	}

	users, total, err := model.GetSubordinateUsers(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	enriched := make([]*teamMemberResp, 0, len(users))
	for _, u := range users {
		r := &teamMemberResp{
			Id:          u.Id,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			Email:       u.Email,
			Group:       u.Group,
			CreatedAt:   u.CreatedAt,
			Quota:       u.Quota,
			UsedQuota:   u.UsedQuota,
			Tokens:      []teamMemberTokenBrief{},
		}
		var tokens []*model.Token
		model.DB.Where("user_id = ? AND team_id = 0 AND status = 1", u.Id).
			Order("created_time desc").
			Select("id", "name", "key", "used_quota", "remain_quota", "unlimited_quota").
			Find(&tokens)
		for _, t := range tokens {
			r.Tokens = append(r.Tokens, teamMemberTokenBrief{
				Id:             t.Id,
				Name:           t.Name,
				Key:            model.MaskTokenKey(t.Key),
				UsedQuota:      t.UsedQuota,
				RemainQuota:    t.RemainQuota,
				UnlimitedQuota: t.UnlimitedQuota,
			})
		}
		enriched = append(enriched, r)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(enriched)

	// Return leader's own members_visible setting
	me, err = model.GetUserById(userId, false)
	membersVisible := false
	if err == nil && me != nil {
		membersVisible = me.GetSetting().TeamMembersVisible
	}
	common.ApiSuccess(c, gin.H{
		"page":            pageInfo,
		"is_leader":       true,
		"members_visible": membersVisible,
	})
}

// GetTeamSettings returns team visibility settings for the current user
// Works for both leaders (own setting) and members (leader's setting)
func GetTeamSettings(c *gin.Context) {
	userId := c.GetInt("id")
	me, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// If the user has subordinates they are a leader (even if they also have an inviter).
	var subordinateCount int64
	model.DB.Model(&model.User{}).Where("inviter_id = ?", userId).Count(&subordinateCount)
	if subordinateCount > 0 {
		common.ApiSuccess(c, gin.H{
			"members_visible": me.GetSetting().TeamMembersVisible,
			"is_leader":       true,
		})
		return
	}
	// If I have an inviter and no subordinates, I'm a pure member — return leader's setting
	if me.InviterId != 0 {
		leader, err := model.GetUserById(me.InviterId, false)
		if err != nil || leader == nil {
			common.ApiSuccess(c, gin.H{"members_visible": false, "is_leader": false})
			return
		}
		common.ApiSuccess(c, gin.H{
			"members_visible": leader.GetSetting().TeamMembersVisible,
			"is_leader":       false,
		})
		return
	}
	// Root user with no subordinates — still a leader (empty team)
	common.ApiSuccess(c, gin.H{
		"members_visible": me.GetSetting().TeamMembersVisible,
		"is_leader":       true,
	})
}

// UpdateTeamSettings updates team_members_visible for the current user (leader only)
func UpdateTeamSettings(c *gin.Context) {
	userId := c.GetInt("id")
	var body struct {
		MembersVisible bool `json:"members_visible"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	me, err := model.GetUserById(userId, false)
	if err != nil || me == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}
	setting := me.GetSetting()
	setting.TeamMembersVisible = body.MembersVisible
	me.SetSetting(setting)
	if err := model.DB.Model(&model.User{}).Where("id = ?", userId).Update("setting", me.Setting).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GetTeamCoMembers returns fellow members for a member (when leader enables visibility)
func GetTeamCoMembers(c *gin.Context) {
	userId := c.GetInt("id")
	me, err := model.GetUserById(userId, false)
	if err != nil || me == nil || me.InviterId == 0 {
		common.ApiSuccess(c, []interface{}{})
		return
	}
	leader, err := model.GetUserById(me.InviterId, false)
	if err != nil || leader == nil || !leader.GetSetting().TeamMembersVisible {
		common.ApiSuccess(c, []interface{}{})
		return
	}
	pageInfo := common.GetPageQuery(c)
	users, total, err := model.GetSubordinateUsers(me.InviterId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	enriched := make([]*teamMemberResp, 0, len(users))
	for _, u := range users {
		r := &teamMemberResp{
			Id:          u.Id,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			Email:       u.Email,
			Group:       u.Group,
			CreatedAt:   u.CreatedAt,
			Quota:       u.Quota,
			UsedQuota:   u.UsedQuota,
			Tokens:      []teamMemberTokenBrief{},
		}
		var tokens []*model.Token
		model.DB.Where("user_id = ? AND team_id = 0 AND status = 1", u.Id).
			Order("created_time desc").
			Select("id", "name", "key", "used_quota", "remain_quota", "unlimited_quota").
			Find(&tokens)
		for _, t := range tokens {
			r.Tokens = append(r.Tokens, teamMemberTokenBrief{
				Id:             t.Id,
				Name:           t.Name,
				Key:            model.MaskTokenKey(t.Key),
				UsedQuota:      t.UsedQuota,
				RemainQuota:    t.RemainQuota,
				UnlimitedQuota: t.UnlimitedQuota,
			})
		}
		enriched = append(enriched, r)
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(enriched)
	common.ApiSuccess(c, gin.H{
		"page":            pageInfo,
		"is_leader":       false,
		"members_visible": true,
	})
}

// ensure dto is used
var _ = dto.UserSetting{}

// SearchUsersForInvite searches users that can be invited
func SearchUsersForInvite(c *gin.Context) {
	userId := c.GetInt("id")
	query := c.Query("q")
	if query == "" {
		common.ApiSuccess(c, []*model.User{})
		return
	}
	users, err := model.SearchUsersForInvite(query, userId, 10)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, users)
}

// SendTeamInvitation sends an invitation to another user
func SendTeamInvitation(c *gin.Context) {
	inviterId := c.GetInt("id")
	var body struct {
		InviteeId int `json:"invitee_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.CreateTeamInvitation(inviterId, body.InviteeId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GetReceivedInvitations returns pending invitations received by current user
func GetReceivedInvitations(c *gin.Context) {
	userId := c.GetInt("id")
	invitations, err := model.GetReceivedInvitations(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invitations)
}

// GetSentInvitations returns pending invitations sent by current user
func GetSentInvitations(c *gin.Context) {
	userId := c.GetInt("id")
	invitations, err := model.GetSentInvitations(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invitations)
}

// RespondToInvitation accepts or rejects a received invitation
func RespondToInvitation(c *gin.Context) {
	userId := c.GetInt("id")
	invitationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	var body struct {
		Action string `json:"action" binding:"required"` // "accept" or "reject"
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	switch body.Action {
	case "accept":
		if err := model.AcceptInvitation(invitationId, userId); err != nil {
			common.ApiError(c, err)
			return
		}
	case "reject":
		if err := model.RejectInvitation(invitationId, userId); err != nil {
			common.ApiError(c, err)
			return
		}
	default:
		common.ApiErrorMsg(c, "无效操作")
		return
	}
	common.ApiSuccess(c, nil)
}

// CancelInvitation cancels a pending sent invitation
func CancelInvitation(c *gin.Context) {
	userId := c.GetInt("id")
	invitationId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.CancelInvitation(invitationId, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RemoveTeamMember kicks a user out of the team
func RemoveTeamMember(c *gin.Context) {
	userId := c.GetInt("id")
	memberId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.RemoveTeamMember(userId, memberId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}



// AdminGetTeamMembers lists all subordinate members under a specific team leader (admin only)
func AdminGetTeamMembers(c *gin.Context) {
	leaderId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	pageInfo := &common.PageInfo{Page: 1, PageSize: 1000}
	users, _, err := model.GetSubordinateUsers(leaderId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	enriched := make([]*teamMemberResp, 0, len(users))
	for _, u := range users {
		r := &teamMemberResp{
			Id:          u.Id,
			Username:    u.Username,
			DisplayName: u.DisplayName,
			Email:       u.Email,
			Group:       u.Group,
			CreatedAt:   u.CreatedAt,
			Quota:       u.Quota,
			UsedQuota:   u.UsedQuota,
			Tokens:      []teamMemberTokenBrief{},
		}
		var tokens []*model.Token
		model.DB.Where("user_id = ? AND team_id = 0 AND status = 1", u.Id).
			Order("created_time desc").
			Select("id", "name", "key", "used_quota", "remain_quota", "unlimited_quota").
			Find(&tokens)
		for _, t := range tokens {
			r.Tokens = append(r.Tokens, teamMemberTokenBrief{
				Id:             t.Id,
				Name:           t.Name,
				Key:            model.MaskTokenKey(t.Key),
				UsedQuota:      t.UsedQuota,
				RemainQuota:    t.RemainQuota,
				UnlimitedQuota: t.UnlimitedQuota,
			})
		}
		enriched = append(enriched, r)
	}
	common.ApiSuccess(c, enriched)
}

// AdminRemoveTeamMember kicks a subordinate user out of a team (admin only)
func AdminRemoveTeamMember(c *gin.Context) {
	memberId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	err = model.DB.Model(&model.User{}).Where("id = ?", memberId).Update("inviter_id", 0).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
