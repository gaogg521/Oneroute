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
package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

const (
	TeamRoleOwner  = "owner"
	TeamRoleAdmin  = "admin"
	TeamRoleMember = "member"
)

type Team struct {
	Id          int    `json:"id" gorm:"primarykey"`
	Name        string `json:"name" gorm:"type:varchar(100);not null"`
	OwnerId     int    `json:"owner_id" gorm:"type:int;index"`
	SharedQuota int    `json:"shared_quota" gorm:"type:int;default:0"`
	InviteCode  string `json:"invite_code" gorm:"type:varchar(32);uniqueIndex"`
	Status      int    `json:"status" gorm:"type:int;default:1"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   int64  `json:"updated_at" gorm:"autoUpdateTime"`

	// Preloaded
	MemberCount int           `json:"member_count,omitempty" gorm:"-"`
	Members     []*TeamMember `json:"members,omitempty" gorm:"-"`
}

type TeamMember struct {
	Id         int    `json:"id" gorm:"primarykey"`
	TeamId     int    `json:"team_id" gorm:"type:int;index"`
	UserId     int    `json:"user_id" gorm:"type:int;index"`
	Role       string `json:"role" gorm:"type:varchar(20);default:'member'"`
	Position   string `json:"position" gorm:"type:varchar(100);default:''"`
	QuotaLimit int    `json:"quota_limit" gorm:"type:int;default:0"`
	JoinedAt   int64  `json:"joined_at" gorm:"autoCreateTime"`

	// Preloaded
	Username    string   `json:"username,omitempty" gorm:"-"`
	DisplayName string   `json:"display_name,omitempty" gorm:"-"`
	Email       string   `json:"email,omitempty" gorm:"-"`
	Tokens      []*Token `json:"tokens,omitempty" gorm:"-"` // personal tokens (masked)
}

// TeamTokenWithOwner wraps a Token with owner info for the team token list
type TeamTokenWithOwner struct {
	Token
	OwnerUsername    string `json:"owner_username,omitempty"`
	OwnerDisplayName string `json:"owner_display_name,omitempty"`
	IsPersonal       bool   `json:"is_personal"` // true = member's own token, false = team-bound token
}

type TeamMemberWithUsage struct {
	TeamMember
	UsedQuota int `json:"used_quota"`
}

// CreateTeam creates a new team and adds the creator as owner
func CreateTeam(name string, ownerId int) (*Team, error) {
	// Check if user already has a team (is owner)
	var existing Team
	if err := DB.Where("owner_id = ?", ownerId).First(&existing).Error; err == nil {
		return nil, errors.New("您已经创建了一个团队")
	}
	// Check if user is already in a team
	var existingMember TeamMember
	if err := DB.Where("user_id = ?", ownerId).First(&existingMember).Error; err == nil {
		return nil, errors.New("您已经加入了一个团队，请先退出")
	}

	team := &Team{
		Name:       name,
		OwnerId:    ownerId,
		InviteCode: common.GetUUID()[:16],
		Status:     1,
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	if err := tx.Create(team).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	member := &TeamMember{
		TeamId: team.Id,
		UserId: ownerId,
		Role:   TeamRoleOwner,
	}
	if err := tx.Create(member).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	return team, tx.Commit().Error
}

// GetTeamById returns team by id
func GetTeamById(teamId int) (*Team, error) {
	var team Team
	err := DB.First(&team, teamId).Error
	if err != nil {
		return nil, errors.New("团队不存在")
	}
	// Fill member count
	var count int64
	DB.Model(&TeamMember{}).Where("team_id = ?", teamId).Count(&count)
	team.MemberCount = int(count)
	return &team, nil
}

// GetUserTeam returns the team the user belongs to (either as owner or member)
func GetUserTeam(userId int) (*Team, *TeamMember, error) {
	var member TeamMember
	if err := DB.Where("user_id = ?", userId).First(&member).Error; err != nil {
		return nil, nil, nil // not in any team
	}
	var team Team
	if err := DB.First(&team, member.TeamId).Error; err != nil {
		return nil, nil, errors.New("团队不存在")
	}
	var count int64
	DB.Model(&TeamMember{}).Where("team_id = ?", team.Id).Count(&count)
	team.MemberCount = int(count)
	return &team, &member, nil
}

// UpdateTeam updates team name and/or shared quota (owner/admin only)
func UpdateTeam(teamId, userId int, name string, sharedQuota int) error {
	member, err := getTeamMember(teamId, userId)
	if err != nil {
		return err
	}
	if member.Role != TeamRoleOwner && member.Role != TeamRoleAdmin {
		return errors.New("权限不足")
	}
	updates := map[string]interface{}{}
	if name != "" {
		updates["name"] = name
	}
	if sharedQuota >= 0 {
		updates["shared_quota"] = sharedQuota
	}
	return DB.Model(&Team{}).Where("id = ?", teamId).Updates(updates).Error
}

// RegenerateInviteCode generates a new invite code for the team
func RegenerateInviteCode(teamId, userId int) (string, error) {
	member, err := getTeamMember(teamId, userId)
	if err != nil {
		return "", err
	}
	if member.Role != TeamRoleOwner && member.Role != TeamRoleAdmin {
		return "", errors.New("权限不足")
	}
	code := common.GetUUID()[:16]
	err = DB.Model(&Team{}).Where("id = ?", teamId).Update("invite_code", code).Error
	return code, err
}

// DisbandTeam deletes team and all its members (owner only)
func DisbandTeam(teamId, userId int) error {
	var team Team
	if err := DB.First(&team, teamId).Error; err != nil {
		return errors.New("团队不存在")
	}
	if team.OwnerId != userId {
		return errors.New("只有团队创建者可以解散团队")
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	if err := tx.Where("team_id = ?", teamId).Delete(&TeamMember{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	// Reset all team tokens to personal
	tx.Model(&Token{}).Where("team_id = ?", teamId).Update("team_id", 0)
	if err := tx.Delete(&team).Error; err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

// JoinTeamByCode adds a user to a team using invite code
func JoinTeamByCode(inviteCode string, userId int) (*Team, error) {
	// Check if user is already in a team
	var existingMember TeamMember
	if err := DB.Where("user_id = ?", userId).First(&existingMember).Error; err == nil {
		return nil, errors.New("您已经加入了一个团队")
	}
	var team Team
	if err := DB.Where("invite_code = ? AND status = 1", inviteCode).First(&team).Error; err != nil {
		return nil, errors.New("邀请码无效或团队不存在")
	}
	member := &TeamMember{
		TeamId: team.Id,
		UserId: userId,
		Role:   TeamRoleMember,
	}
	return &team, DB.Create(member).Error
}

// GetTeamMembers returns all members of a team with user info and their personal tokens.
// maskKeys=true for regular members (obscure other members' keys); false for owners/admins/super-admins.
func GetTeamMembers(teamId int, maskKeys bool) ([]*TeamMember, error) {
	var members []*TeamMember
	if err := DB.Where("team_id = ?", teamId).Order("joined_at asc").Find(&members).Error; err != nil {
		return nil, err
	}
	for _, m := range members {
		if u, err := GetUserById(m.UserId, false); err == nil {
			m.Username = u.Username
			m.DisplayName = u.DisplayName
			m.Email = u.Email
		}
		var personalTokens []*Token
		DB.Where("user_id = ? AND team_id = 0 AND status = 1", m.UserId).Order("created_time desc").Find(&personalTokens)
		if maskKeys {
			for _, t := range personalTokens {
				t.Key = MaskTokenKey(t.Key)
			}
		}
		m.Tokens = personalTokens
	}
	return members, nil
}

// GetTeamAllTokens returns team-bound tokens plus all personal tokens of team members
func GetTeamAllTokens(teamId int) ([]*TeamTokenWithOwner, error) {
	var members []*TeamMember
	DB.Where("team_id = ?", teamId).Find(&members)

	userInfo := map[int][2]string{} // userId -> [username, display_name]
	userIds := make([]int, 0, len(members))
	for _, m := range members {
		if u, err := GetUserById(m.UserId, false); err == nil {
			userInfo[m.UserId] = [2]string{u.Username, u.DisplayName}
		}
		userIds = append(userIds, m.UserId)
	}

	var teamTokens []*Token
	DB.Where("team_id = ?", teamId).Find(&teamTokens)

	var personalTokens []*Token
	if len(userIds) > 0 {
		DB.Where("user_id IN ? AND team_id = 0", userIds).Find(&personalTokens)
	}

	result := make([]*TeamTokenWithOwner, 0, len(teamTokens)+len(personalTokens))
	for _, t := range teamTokens {
		tw := &TeamTokenWithOwner{Token: *t, IsPersonal: false}
		tw.Key = MaskTokenKey(tw.Key)
		if info, ok := userInfo[t.UserId]; ok {
			tw.OwnerUsername = info[0]
			tw.OwnerDisplayName = info[1]
		}
		result = append(result, tw)
	}
	for _, t := range personalTokens {
		tw := &TeamTokenWithOwner{Token: *t, IsPersonal: true}
		tw.Key = MaskTokenKey(tw.Key)
		if info, ok := userInfo[t.UserId]; ok {
			tw.OwnerUsername = info[0]
			tw.OwnerDisplayName = info[1]
		}
		result = append(result, tw)
	}
	return result, nil
}

// UpdateTeamMember updates role, quota_limit, or position for a member (owner/admin only)
func UpdateTeamMember(teamId, operatorId, targetUserId int, role string, quotaLimit int, position string) error {
	operator, err := getTeamMember(teamId, operatorId)
	if err != nil {
		return err
	}
	if operator.Role != TeamRoleOwner && operator.Role != TeamRoleAdmin {
		return errors.New("权限不足")
	}
	target, err := getTeamMember(teamId, targetUserId)
	if err != nil {
		return errors.New("成员不存在")
	}
	// Cannot change owner's role
	if target.Role == TeamRoleOwner {
		return errors.New("不能修改创建者的角色")
	}
	// Admin cannot set another admin
	if operator.Role == TeamRoleAdmin && role == TeamRoleAdmin {
		return errors.New("管理员不能设置其他管理员")
	}
	updates := map[string]interface{}{}
	if role != "" {
		updates["role"] = role
	}
	if quotaLimit >= 0 {
		updates["quota_limit"] = quotaLimit
	}
	updates["position"] = position
	return DB.Model(&TeamMember{}).Where("id = ?", target.Id).Updates(updates).Error
}

// RemoveTeamMemberV3 removes a member from the team (owner/admin only, or self-leave)
func RemoveTeamMemberV3(teamId, operatorId, targetUserId int) error {
	// Allow self-leave
	if operatorId != targetUserId {
		operator, err := getTeamMember(teamId, operatorId)
		if err != nil {
			return err
		}
		if operator.Role != TeamRoleOwner && operator.Role != TeamRoleAdmin {
			return errors.New("权限不足")
		}
	}
	target, err := getTeamMember(teamId, targetUserId)
	if err != nil {
		return errors.New("成员不存在")
	}
	if target.Role == TeamRoleOwner {
		return errors.New("创建者不能被移除，请使用解散团队")
	}
	return DB.Delete(target).Error
}

// GetTeamByInviteCode returns team info by invite code (for preview before joining)
func GetTeamByInviteCode(inviteCode string) (*Team, error) {
	var team Team
	if err := DB.Where("invite_code = ? AND status = 1", inviteCode).First(&team).Error; err != nil {
		return nil, errors.New("邀请码无效")
	}
	var count int64
	DB.Model(&TeamMember{}).Where("team_id = ?", team.Id).Count(&count)
	team.MemberCount = int(count)
	return &team, nil
}

// GetTeamTokens returns tokens belonging to a team
func GetTeamTokens(teamId int) ([]*Token, error) {
	var tokens []*Token
	err := DB.Where("team_id = ?", teamId).Find(&tokens).Error
	for _, t := range tokens {
		t.Key = MaskTokenKey(t.Key)
	}
	return tokens, err
}

func getTeamMember(teamId, userId int) (*TeamMember, error) {
	var member TeamMember
	if err := DB.Where("team_id = ? AND user_id = ?", teamId, userId).First(&member).Error; err != nil {
		return nil, errors.New("您不是该团队成员")
	}
	return &member, nil
}

// GetTeamMemberForAuth is the exported version of getTeamMember for use in controllers.
func GetTeamMemberForAuth(teamId, userId int) (*TeamMember, error) {
	return getTeamMember(teamId, userId)
}

// GetTeamOwnerForMember returns the team owner's userId and this member's QuotaLimit.
// Returns found=false when the user is not in any team.
// Used by relay billing to redirect wallet deductions to the team owner.
func GetTeamOwnerForMember(userId int) (ownerId int, quotaLimit int, found bool) {
	var member TeamMember
	if err := DB.Select("team_id", "quota_limit").Where("user_id = ?", userId).First(&member).Error; err != nil {
		return 0, 0, false
	}
	var team Team
	if err := DB.Select("owner_id").First(&team, member.TeamId).Error; err != nil {
		return 0, 0, false
	}
	return team.OwnerId, member.QuotaLimit, true
}

// GetMemberUsedQuota returns total quota consumed by a user (for team quota-limit enforcement).
func GetMemberUsedQuota(userId int) int {
	var result struct{ Used int }
	LOG_DB.Model(&Log{}).
		Select("COALESCE(SUM(quota), 0) as used").
		Where("user_id = ? AND type = ?", userId, LogTypeConsume).
		Scan(&result)
	return result.Used
}

// AdminGetAllTeams returns all teams with member counts and owner info (for admin use).
func AdminGetAllTeams(keyword string, offset, limit int) ([]*Team, int64, error) {
	query := DB.Model(&Team{})
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var teams []*Team
	if err := query.Order("id desc").Offset(offset).Limit(limit).Find(&teams).Error; err != nil {
		return nil, 0, err
	}
	for _, t := range teams {
		var count int64
		DB.Model(&TeamMember{}).Where("team_id = ?", t.Id).Count(&count)
		t.MemberCount = int(count)
	}
	return teams, total, nil
}

// AdminDisbandTeam forcefully disbands any team (admin override, no owner check).
func AdminDisbandTeam(teamId int) error {
	var team Team
	if err := DB.First(&team, teamId).Error; err != nil {
		return errors.New("团队不存在")
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	if err := tx.Where("team_id = ?", teamId).Delete(&TeamMember{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Model(&Token{}).Where("team_id = ?", teamId).Update("team_id", 0)
	if err := tx.Delete(&team).Error; err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

// IsTeamMember checks if userId is in teamId
func IsTeamMember(teamId, userId int) bool {
	var count int64
	DB.Model(&TeamMember{}).Where("team_id = ? AND user_id = ?", teamId, userId).Count(&count)
	return count > 0
}

// TransferOwnership transfers team ownership from operatorId to newOwnerId.
// Pass operatorId=-1 to skip operator validation (admin-only use).
func TransferOwnership(teamId, operatorId, newOwnerId int) error {
	if operatorId != -1 {
		op, err := getTeamMember(teamId, operatorId)
		if err != nil {
			return err
		}
		if op.Role != TeamRoleOwner {
			return errors.New("只有创建者才能转让团队")
		}
		if operatorId == newOwnerId {
			return errors.New("不能转让给自己")
		}
	}
	newOwner, err := getTeamMember(teamId, newOwnerId)
	if err != nil {
		return errors.New("目标用户不是团队成员")
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	// Demote old owner to member
	if operatorId != -1 {
		if err := tx.Model(&TeamMember{}).
			Where("team_id = ? AND user_id = ? AND role = ?", teamId, operatorId, TeamRoleOwner).
			Update("role", TeamRoleMember).Error; err != nil {
			tx.Rollback()
			return err
		}
	} else {
		// Find current owner and demote
		if err := tx.Model(&TeamMember{}).
			Where("team_id = ? AND role = ?", teamId, TeamRoleOwner).
			Update("role", TeamRoleMember).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	// Promote new owner
	if err := tx.Model(&TeamMember{}).Where("id = ?", newOwner.Id).
		Update("role", TeamRoleOwner).Error; err != nil {
		tx.Rollback()
		return err
	}
	// Update teams.owner_id
	if err := tx.Model(&Team{}).Where("id = ?", teamId).
		Update("owner_id", newOwnerId).Error; err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}
