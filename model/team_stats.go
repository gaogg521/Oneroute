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

type TeamStats struct {
	TotalQuota     int `json:"total_quota"`
	TotalUsed      int `json:"total_used"`
	TotalMembers   int `json:"total_members"`
	TotalRequests  int `json:"total_requests"`
}

type MemberUsage struct {
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	QuotaLimit  int    `json:"quota_limit"`
	UsedQuota   int    `json:"used_quota"`
	RequestCount int   `json:"request_count"`
}

// GetTeamStats returns aggregated usage stats for a team
func GetTeamStats(teamId int) (*TeamStats, error) {
	members, err := GetTeamMembers(teamId, true)
	if err != nil {
		return nil, err
	}

	stats := &TeamStats{
		TotalMembers: len(members),
	}

	// Get team quota info
	var team Team
	if err := DB.First(&team, teamId).Error; err == nil {
		stats.TotalQuota = team.SharedQuota
	}

	// Sum used quota and requests from all member users
	if len(members) > 0 {
		userIds := make([]int, len(members))
		for i, m := range members {
			userIds[i] = m.UserId
		}
		var result struct {
			TotalUsed     int
			TotalRequests int
		}
		LOG_DB.Model(&Log{}).
			Select("COALESCE(SUM(quota), 0) as total_used, COUNT(*) as total_requests").
			Where("user_id IN ? AND type = ?", userIds, LogTypeConsume).
			Scan(&result)
		stats.TotalUsed = result.TotalUsed
		stats.TotalRequests = result.TotalRequests
	}

	return stats, nil
}

// GetTeamMembersUsage returns per-member usage stats
func GetTeamMembersUsage(teamId int) ([]*MemberUsage, error) {
	members, err := GetTeamMembers(teamId, true)
	if err != nil {
		return nil, err
	}

	result := make([]*MemberUsage, 0, len(members))
	for _, m := range members {
		usage := &MemberUsage{
			UserId:      m.UserId,
			Username:    m.Username,
			DisplayName: m.DisplayName,
			Role:        m.Role,
			QuotaLimit:  m.QuotaLimit,
		}
		var stats struct {
			Used     int
			Requests int
		}
		LOG_DB.Model(&Log{}).
			Select("COALESCE(SUM(quota), 0) as used, COUNT(*) as requests").
			Where("user_id = ? AND type = ?", m.UserId, LogTypeConsume).
			Scan(&stats)
		usage.UsedQuota = stats.Used
		usage.RequestCount = stats.Requests
		result = append(result, usage)
	}
	return result, nil
}
