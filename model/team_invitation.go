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
	TeamInvitationStatusPending  = 0
	TeamInvitationStatusAccepted = 1
	TeamInvitationStatusRejected = 2
)

type TeamInvitation struct {
	Id        int   `json:"id" gorm:"primarykey"`
	InviterId int   `json:"inviter_id" gorm:"type:int;index"`
	InviteeId int   `json:"invitee_id" gorm:"type:int;index"`
	Status    int   `json:"status" gorm:"type:int;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64 `json:"updated_at" gorm:"autoUpdateTime"`

	// Preloaded fields (not stored in DB)
	InviterName string `json:"inviter_name" gorm:"-"`
	InviteeName string `json:"invitee_name" gorm:"-"`
}

func CreateTeamInvitation(inviterId, inviteeId int) error {
	if inviterId == inviteeId {
		return errors.New("不能邀请自己")
	}
	// Check if invitee is already in a team
	invitee, err := GetUserById(inviteeId, false)
	if err != nil {
		return errors.New("用户不存在")
	}
	if invitee.InviterId != 0 {
		return errors.New("该用户已加入其他团队")
	}
	// Check if already pending
	var existing TeamInvitation
	err = DB.Where("inviter_id = ? AND invitee_id = ? AND status = ?",
		inviterId, inviteeId, TeamInvitationStatusPending).First(&existing).Error
	if err == nil {
		return errors.New("已发送过邀请，等待对方确认")
	}
	invitation := &TeamInvitation{
		InviterId: inviterId,
		InviteeId: inviteeId,
		Status:    TeamInvitationStatusPending,
	}
	return DB.Create(invitation).Error
}

// GetReceivedInvitations returns pending invitations received by userId
func GetReceivedInvitations(userId int) ([]*TeamInvitation, error) {
	var invitations []*TeamInvitation
	err := DB.Where("invitee_id = ? AND status = ?", userId, TeamInvitationStatusPending).
		Order("created_at desc").Find(&invitations).Error
	if err != nil {
		return nil, err
	}
	// Fill inviter names
	for _, inv := range invitations {
		if u, e := GetUserById(inv.InviterId, false); e == nil {
			inv.InviterName = u.DisplayName
			if inv.InviterName == "" {
				inv.InviterName = u.Username
			}
		}
	}
	return invitations, nil
}

// GetSentInvitations returns pending invitations sent by userId
func GetSentInvitations(userId int) ([]*TeamInvitation, error) {
	var invitations []*TeamInvitation
	err := DB.Where("inviter_id = ? AND status = ?", userId, TeamInvitationStatusPending).
		Order("created_at desc").Find(&invitations).Error
	if err != nil {
		return nil, err
	}
	// Fill invitee names
	for _, inv := range invitations {
		if u, e := GetUserById(inv.InviteeId, false); e == nil {
			inv.InviteeName = u.DisplayName
			if inv.InviteeName == "" {
				inv.InviteeName = u.Username
			}
		}
	}
	return invitations, nil
}

// AcceptInvitation accepts invitation and sets inviter_id on the invitee user
func AcceptInvitation(invitationId, inviteeId int) error {
	var inv TeamInvitation
	err := DB.Where("id = ? AND invitee_id = ? AND status = ?",
		invitationId, inviteeId, TeamInvitationStatusPending).First(&inv).Error
	if err != nil {
		return errors.New("邀请不存在或已处理")
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	// Update invitation status
	if err = tx.Model(&inv).Update("status", TeamInvitationStatusAccepted).Error; err != nil {
		tx.Rollback()
		return err
	}
	// Set inviter_id on the invitee
	if err = tx.Model(&User{}).Where("id = ?", inviteeId).Update("inviter_id", inv.InviterId).Error; err != nil {
		tx.Rollback()
		return err
	}
	// Reject all other pending invitations for this user
	tx.Model(&TeamInvitation{}).
		Where("invitee_id = ? AND status = ? AND id != ?", inviteeId, TeamInvitationStatusPending, invitationId).
		Update("status", TeamInvitationStatusRejected)
	return tx.Commit().Error
}

// RejectInvitation rejects a received invitation
func RejectInvitation(invitationId, inviteeId int) error {
	result := DB.Model(&TeamInvitation{}).
		Where("id = ? AND invitee_id = ? AND status = ?",
			invitationId, inviteeId, TeamInvitationStatusPending).
		Update("status", TeamInvitationStatusRejected)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("邀请不存在或已处理")
	}
	return nil
}

// CancelInvitation cancels a sent invitation (by the inviter)
func CancelInvitation(invitationId, inviterId int) error {
	result := DB.Where("id = ? AND inviter_id = ? AND status = ?",
		invitationId, inviterId, TeamInvitationStatusPending).
		Delete(&TeamInvitation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("邀请不存在")
	}
	return nil
}

// RemoveTeamMember sets inviter_id = 0, removing the user from the team
func RemoveTeamMember(inviterId, memberId int) error {
	// Verify the member actually belongs to this inviter's team
	var member User
	err := DB.Select("id, inviter_id").First(&member, memberId).Error
	if err != nil {
		return errors.New("用户不存在")
	}
	if member.InviterId != inviterId {
		return errors.New("该用户不在您的团队中")
	}
	return DB.Model(&User{}).Where("id = ?", memberId).Update("inviter_id", 0).Error
}

// SearchUsersForInvite searches users by username/display_name/email, excluding already-teamed users
func SearchUsersForInvite(query string, currentUserId int, limit int) ([]*User, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	var users []*User
	like := "%" + query + "%"
	err := DB.Select("id, username, display_name, email").
		Where("(username LIKE ? OR display_name LIKE ? OR email LIKE ?) AND id != ? AND inviter_id = 0 AND role = ?",
			like, like, like, currentUserId, common.RoleCommonUser).
		Limit(limit).
		Find(&users).Error
	return users, err
}
