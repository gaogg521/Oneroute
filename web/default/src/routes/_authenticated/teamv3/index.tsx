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
import { useState, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Users, Settings, BarChart2, Key, Crown, Shield, UserMinus,
  Copy, RefreshCw, Trash2, Plus, LogOut, UserCog, Link, UserPlus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/teamv3/')({
  component: TeamV3,
})

type Team = {
  id: number
  name: string
  owner_id: number
  shared_quota: number
  invite_code: string
  status: number
  created_at: number
  member_count: number
}

type MyMember = {
  id: number
  team_id: number
  user_id: number
  role: string
  quota_limit: number
  joined_at: number
}

type TeamMember = {
  id: number
  team_id: number
  user_id: number
  role: string
  position: string
  quota_limit: number
  joined_at: number
  username: string
  display_name: string
  email: string
}

type TeamStats = {
  total_quota: number
  total_used: number
  total_members: number
  total_requests: number
}

type MemberUsage = {
  user_id: number
  username: string
  display_name: string
  role: string
  quota_limit: number
  used_quota: number
  request_count: number
}

type TeamToken = {
  id: number
  name: string
  key: string
  status: number
  team_id: number
  remain_quota: number
  used_quota: number
  expired_time: number
  unlimited_quota: boolean
  // enriched fields from GetTeamAllTokens
  owner_username?: string
  owner_display_name?: string
  is_personal?: boolean
  user_id?: number
}

type TeamMemberResult = {
  id: number
  team_id: number
  user_id: number
  role: string
  position: string
  quota_limit: number
  joined_at: number
  username: string
  display_name: string
  email: string
  tokens?: Array<{ id: number; name: string; key: string; status: number }>
}

type NewMemberResult = {
  id: number
  username: string
  display_name: string
  password: string
  api_key: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: '创建者',
  admin: '管理员',
  member: '成员',
}

const ROLE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
}

function formatQuota(q: number) {
  return (q / 500000).toFixed(4)
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('zh-CN')
}

// ────────── No Team State ──────────

function NoTeamPanel({ onCreated, onJoined }: { onCreated: () => void; onJoined: () => void }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join')
    if (code) {
      setInviteCode(code)
      setJoinOpen(true)
    }
  }, [])
  const [previewTeam, setPreviewTeam] = useState<Team | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  const handleCreate = async () => {
    if (!teamName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/api/user/teamv3', { name: teamName.trim() }, { skipBusinessError: true })
      if (res.data.success) {
        toast.success('团队创建成功')
        setCreateOpen(false)
        onCreated()
      } else {
        toast.error(res.data.message || '创建失败')
      }
    } finally {
      setCreating(false)
    }
  }

  const handlePreviewJoin = async () => {
    if (!inviteCode.trim()) return
    try {
      const res = await api.get(`/api/teamv3/invite/${inviteCode.trim()}`, { skipBusinessError: true })
      if (res.data.success) {
        setPreviewTeam(res.data.data)
      } else {
        toast.error(res.data.message || '邀请码无效')
      }
    } catch {
      toast.error('邀请码无效')
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const res = await api.post(`/api/teamv3/join/${inviteCode.trim()}`, {}, { skipBusinessError: true })
      if (res.data.success) {
        toast.success('成功加入团队')
        setJoinOpen(false)
        onJoined()
      } else {
        toast.error(res.data.message || '加入失败')
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className='flex flex-col items-center justify-center py-16 text-center'>
      <Users className='mb-4 h-16 w-16 text-muted-foreground/50' />
      <h3 className='mb-2 text-xl font-semibold'>您还没有加入团队</h3>
      <p className='mb-8 text-sm text-muted-foreground'>创建一个新团队，或通过邀请码加入现有团队</p>
      <div className='flex gap-3'>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className='mr-2 h-4 w-4' />
          创建团队
        </Button>
        <Button variant='outline' onClick={() => setJoinOpen(true)}>
          加入团队
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>创建团队</DialogTitle>
            <DialogDescription>设置团队名称，您将成为团队创建者</DialogDescription>
          </DialogHeader>
          <Input
            placeholder='团队名称'
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={creating || !teamName.trim()} onClick={handleCreate}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Dialog */}
      <Dialog open={joinOpen} onOpenChange={(o) => { setJoinOpen(o); if (!o) setPreviewTeam(null) }}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>加入团队</DialogTitle>
            <DialogDescription>输入邀请码查看团队信息后加入</DialogDescription>
          </DialogHeader>
          <div className='flex gap-2'>
            <Input
              placeholder='邀请码'
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <Button variant='outline' onClick={handlePreviewJoin}>查询</Button>
          </div>
          {previewTeam && (
            <div className='rounded-lg border p-3 text-sm'>
              <p className='font-medium'>{previewTeam.name}</p>
              <p className='text-muted-foreground'>{previewTeam.member_count} 名成员</p>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setJoinOpen(false)}>取消</Button>
            <Button disabled={joining || !previewTeam} onClick={handleJoin}>
              {joining ? '加入中...' : '加入团队'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ────────── Team Dashboard ──────────

function TeamDashboard({
  team,
  myMember,
  onLeft,
  onTeamUpdate,
}: {
  team: Team
  myMember: MyMember
  onLeft: () => void
  onTeamUpdate: (t: Team) => void
}) {
  const [members, setMembers] = useState<TeamMemberResult[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [usage, setUsage] = useState<MemberUsage[]>([])
  const [tokens, setTokens] = useState<TeamToken[]>([])
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [disbandOpen, setDisbandOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [editName, setEditName] = useState(team.name)
  const [savingName, setSavingName] = useState(false)
  const [createTokenOpen, setCreateTokenOpen] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [creatingToken, setCreatingToken] = useState(false)
  const [newTokenKey, setNewTokenKey] = useState<string | null>(null)
  const [createMemberOpen, setCreateMemberOpen] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [newMemberDisplayName, setNewMemberDisplayName] = useState('')
  const [creatingMember, setCreatingMember] = useState(false)
  const [newMemberResult, setNewMemberResult] = useState<NewMemberResult | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamMemberResult | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<TeamMemberResult | null>(null)
  const [transferring, setTransferring] = useState(false)

  const isOwner = myMember.role === 'owner'
  const isAdmin = myMember.role === 'admin' || isOwner

  const fetchMembers = useCallback(async () => {
    const res = await api.get(`/api/teamv3/${team.id}/members`, { skipBusinessError: true })
    if (res.data.success) setMembers(res.data.data || [])
  }, [team.id])

  const fetchStats = useCallback(async () => {
    const res = await api.get(`/api/teamv3/${team.id}/stats`, { skipBusinessError: true })
    if (res.data.success) setStats(res.data.data)
  }, [team.id])

  const fetchUsage = useCallback(async () => {
    const res = await api.get(`/api/teamv3/${team.id}/members-usage`, { skipBusinessError: true })
    if (res.data.success) setUsage(res.data.data || [])
  }, [team.id])

  const fetchTokens = useCallback(async () => {
    const res = await api.get(`/api/teamv3/${team.id}/tokens`, { skipBusinessError: true })
    if (res.data.success) setTokens(res.data.data || [])
  }, [team.id])

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('请输入 Token 名称')
      return
    }
    setCreatingToken(true)
    try {
      const res = await api.post(`/api/teamv3/${team.id}/tokens`, {
        name: newTokenName.trim(),
      })
      if (res.data.success) {
        setNewTokenKey(res.data.data?.key || null)
        setCreateTokenOpen(false)
        setNewTokenName('')
        fetchTokens()
        toast.success('团队 Token 创建成功')
      } else {
        toast.error(res.data.message || '创建失败')
      }
    } finally {
      setCreatingToken(false)
    }
  }

  useEffect(() => {
    fetchMembers()
    fetchStats()
  }, [fetchMembers, fetchStats])

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(team.invite_code)
    toast.success('邀请码已复制')
  }

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/teamv3?join=${team.invite_code}`
    navigator.clipboard.writeText(link)
    toast.success('邀请链接已复制')
  }

  const handleCreateMember = async () => {
    if (!newMemberUsername.trim()) {
      toast.error('用户名不能为空')
      return
    }
    setCreatingMember(true)
    try {
      const res = await api.post(`/api/teamv3/${team.id}/members-create`, {
        username: newMemberUsername.trim(),
        display_name: newMemberDisplayName.trim() || undefined,
      }, { skipBusinessError: true })
      if (res.data.success) {
        setCreateMemberOpen(false)
        setNewMemberUsername('')
        setNewMemberDisplayName('')
        setNewMemberResult(res.data.data)
        fetchMembers()
      } else {
        toast.error(res.data.message || '创建失败')
      }
    } finally {
      setCreatingMember(false)
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferTarget) return
    setTransferring(true)
    try {
      const res = await api.post(`/api/teamv3/${team.id}/transfer`, {
        new_owner_id: transferTarget.user_id,
      }, { skipBusinessError: true })
      if (res.data.success) {
        toast.success(`团队已转让给 ${transferTarget.display_name || transferTarget.username}`)
        setTransferOpen(false)
        setTransferTarget(null)
        onLeft()
      } else {
        toast.error(res.data.message || '转让失败')
      }
    } finally {
      setTransferring(false)
    }
  }

  const handleRegenCode = async () => {
    const res = await api.post(`/api/teamv3/${team.id}/invite_code`, {}, { skipBusinessError: true })
    if (res.data.success) {
      toast.success('邀请码已更新')
      onTeamUpdate({ ...team, invite_code: res.data.data.invite_code })
    } else {
      toast.error(res.data.message)
    }
  }

  const handleSaveName = async () => {
    if (!editName.trim()) return
    setSavingName(true)
    try {
      const res = await api.put(`/api/teamv3/${team.id}`, { name: editName.trim() }, { skipBusinessError: true })
      if (res.data.success) {
        toast.success('团队名称已更新')
        onTeamUpdate({ ...team, name: editName.trim() })
      } else {
        toast.error(res.data.message)
      }
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdateMember = async (role: string, quotaLimit: number, position: string) => {
    if (!editMember) return
    const res = await api.put(
      `/api/teamv3/${team.id}/members/${editMember.user_id}`,
      { role, quota_limit: quotaLimit, position },
      { skipBusinessError: true }
    )
    if (res.data.success) {
      toast.success('成员信息已更新')
      setEditMember(null)
      fetchMembers()
    } else {
      toast.error(res.data.message)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    const res = await api.delete(`/api/teamv3/${team.id}/members/${userId}`, { skipBusinessError: true })
    if (res.data.success) {
      toast.success('成员已移除')
      setRemovingMember(null)
      fetchMembers()
    } else {
      toast.error(res.data.message)
    }
  }

  const handleLeave = async () => {
    const res = await api.delete(`/api/teamv3/${team.id}/members/${myMember.user_id}`, { skipBusinessError: true })
    if (res.data.success) {
      toast.success('已退出团队')
      setLeaveOpen(false)
      onLeft()
    } else {
      toast.error(res.data.message)
    }
  }

  const handleDisband = async () => {
    const res = await api.delete(`/api/teamv3/${team.id}`, { skipBusinessError: true })
    if (res.data.success) {
      toast.success('团队已解散')
      setDisbandOpen(false)
      onLeft()
    } else {
      toast.error(res.data.message)
    }
  }

  return (
    <div className='space-y-4'>
      {/* Header card */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Users className='h-5 w-5' />
                {team.name}
                <Badge variant={ROLE_BADGE_VARIANTS[myMember.role]}>
                  {ROLE_LABELS[myMember.role]}
                </Badge>
              </CardTitle>
              <CardDescription>
                {team.member_count} 名成员 · 适用于同一组织内的部门或大型团队，所有成员可互相查看，管理员可统一分配额度和权限
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              {!isOwner && (
                <Button variant='outline' size='sm' onClick={() => setLeaveOpen(true)}>
                  <LogOut className='mr-1 h-4 w-4' />
                  退出团队
                </Button>
              )}
              {isOwner && (
                <Button variant='outline' size='sm' onClick={() => setTransferOpen(true)}>
                  <Crown className='mr-1 h-4 w-4' />
                  转让团队
                </Button>
              )}
              {isOwner && (
                <Button variant='destructive' size='sm' onClick={() => setDisbandOpen(true)}>
                  <Trash2 className='mr-1 h-4 w-4' />
                  解散团队
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {stats && (
          <CardContent>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <div className='rounded-lg bg-muted/50 p-3 text-center'>
                <p className='text-2xl font-bold'>{stats.total_members}</p>
                <p className='text-xs text-muted-foreground'>成员数</p>
              </div>
              <div className='rounded-lg bg-muted/50 p-3 text-center'>
                <p className='text-2xl font-bold'>{formatQuota(stats.total_quota)} $</p>
                <p className='text-xs text-muted-foreground'>共享额度</p>
              </div>
              <div className='rounded-lg bg-muted/50 p-3 text-center'>
                <p className='text-2xl font-bold'>{formatQuota(stats.total_used)} $</p>
                <p className='text-xs text-muted-foreground'>已使用</p>
              </div>
              <div className='rounded-lg bg-muted/50 p-3 text-center'>
                <p className='text-2xl font-bold'>{stats.total_requests}</p>
                <p className='text-xs text-muted-foreground'>总请求数</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue='members'>
        <TabsList>
          <TabsTrigger value='members'>
            <Users className='mr-1 h-4 w-4' />
            成员管理
          </TabsTrigger>
          <TabsTrigger value='usage' onClick={() => fetchUsage()}>
            <BarChart2 className='mr-1 h-4 w-4' />
            用量统计
          </TabsTrigger>
          <TabsTrigger value='tokens' onClick={() => fetchTokens()}>
            <Key className='mr-1 h-4 w-4' />
            团队 Token
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value='settings'>
              <Settings className='mr-1 h-4 w-4' />
              设置
            </TabsTrigger>
          )}
        </TabsList>

        {/* Members Tab */}
        <TabsContent value='members'>
          <Card>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-base'>成员列表</CardTitle>
                {isAdmin && (
                  <Button size='sm' onClick={() => setCreateMemberOpen(true)}>
                    <UserPlus className='mr-1 h-4 w-4' />
                    新建成员
                  </Button>
                )}
              </div>
              {isAdmin && (
                <CardDescription className='flex items-center flex-wrap gap-1 pt-1'>
                  邀请码：
                  <span className='font-mono font-medium'>{team.invite_code}</span>
                  <Button variant='ghost' size='sm' className='h-6 px-2' onClick={handleCopyInviteCode} title='复制邀请码'>
                    <Copy className='h-3 w-3' />
                  </Button>
                  <Button variant='ghost' size='sm' className='h-6 px-2' onClick={handleCopyInviteLink} title='复制邀请链接'>
                    <Link className='h-3 w-3' />
                  </Button>
                  <Button variant='ghost' size='sm' className='h-6 px-2' onClick={handleRegenCode} title='重新生成邀请码'>
                    <RefreshCw className='h-3 w-3' />
                  </Button>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>岗位</TableHead>
                    {isAdmin && <TableHead>API Key</TableHead>}
                    <TableHead>限额</TableHead>
                    <TableHead>加入时间</TableHead>
                    {isAdmin && <TableHead>操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className='font-medium'>{m.display_name || m.username}</p>
                        <p className='text-xs text-muted-foreground'>@{m.username}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE_VARIANTS[m.role]}>
                          {ROLE_LABELS[m.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className='text-sm text-muted-foreground'>{m.position || '—'}</span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          {m.tokens && m.tokens.length > 0 ? (
                            <div className='flex flex-col gap-1'>
                              {m.tokens.map((t) => (
                                <div key={t.id} className='flex items-center gap-1'>
                                  <code className='text-xs text-muted-foreground'>{t.key}</code>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-5 w-5 p-0 shrink-0'
                                    title='复制 API Key'
                                    onClick={() => {
                                      navigator.clipboard.writeText(t.key)
                                      toast.success('已复制 API Key')
                                    }}
                                  >
                                    <Copy className='h-3 w-3' />
                                  </Button>
                                  <span className='text-xs text-muted-foreground/60'>({t.name})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className='text-xs text-muted-foreground'>暂无</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {m.quota_limit > 0 ? `${formatQuota(m.quota_limit)} $` : '不限'}
                      </TableCell>
                      <TableCell>{formatDate(m.joined_at)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {m.role !== 'owner' && (
                            <div className='flex gap-1'>
                              <Button size='sm' variant='ghost' onClick={() => setEditMember(m as unknown as TeamMember)}>
                                <UserCog className='h-4 w-4' />
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                className='text-destructive hover:text-destructive'
                                onClick={() => setRemovingMember(m)}
                              >
                                <UserMinus className='h-4 w-4' />
                              </Button>
                            </div>
                          )}
                          {m.role === 'owner' && <Crown className='h-4 w-4 text-yellow-500' />}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value='usage'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>成员用量统计</CardTitle>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <p className='py-8 text-center text-muted-foreground text-sm'>暂无数据，点击标签页加载</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>已用额度</TableHead>
                      <TableHead>请求次数</TableHead>
                      <TableHead>限额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <p className='font-medium'>{u.display_name || u.username}</p>
                          <p className='text-xs text-muted-foreground'>@{u.username}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ROLE_BADGE_VARIANTS[u.role]}>
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatQuota(u.used_quota)} $</TableCell>
                        <TableCell>{u.request_count}</TableCell>
                        <TableCell>
                          {u.quota_limit > 0 ? `${formatQuota(u.quota_limit)} $` : '不限'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tokens Tab */}
        <TabsContent value='tokens'>
          <Card>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-base'>团队 Token</CardTitle>
                  <CardDescription>团队共享 Key 及所有成员个人 Key</CardDescription>
                </div>
                {isAdmin && (
                  <Button size='sm' onClick={() => setCreateTokenOpen(true)}>
                    <Plus className='mr-1 h-4 w-4' />
                    创建团队 Token
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className='py-8 text-center text-sm text-muted-foreground'>
                  <p>暂无 Token</p>
                  {isAdmin && <p className='mt-1'>点击右上角「创建团队 Token」按钮创建团队共享 Key</p>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>归属</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>已用额度</TableHead>
                      <TableHead>剩余额度</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((tk) => (
                      <TableRow key={tk.id}>
                        <TableCell className='font-medium'>{tk.name}</TableCell>
                        <TableCell>
                          <div className='flex flex-col gap-0.5'>
                            <Badge variant={tk.is_personal ? 'outline' : 'secondary'} className='w-fit text-xs'>
                              {tk.is_personal ? '个人' : '团队'}
                            </Badge>
                            {tk.owner_display_name || tk.owner_username ? (
                              <span className='text-xs text-muted-foreground'>
                                {tk.owner_display_name || tk.owner_username}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className='font-mono text-xs'>{tk.key}</TableCell>
                        <TableCell>
                          <Badge variant={tk.status === 1 ? 'default' : 'secondary'}>
                            {tk.status === 1 ? '正常' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatQuota(tk.used_quota)} $</TableCell>
                        <TableCell>
                          {tk.unlimited_quota ? '不限' : `${formatQuota(tk.remain_quota)} $`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        {isAdmin && (
          <TabsContent value='settings'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-base'>团队设置</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex gap-2'>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder='团队名称'
                    className='max-w-xs'
                  />
                  <Button disabled={savingName || editName === team.name} onClick={handleSaveName}>
                    保存名称
                  </Button>
                </div>
                <div className='space-y-2'>
                  <p className='text-sm font-medium'>邀请码</p>
                  <div className='flex items-center gap-2'>
                    <code className='rounded bg-muted px-2 py-1 font-mono text-sm'>{team.invite_code}</code>
                    <Button variant='outline' size='sm' onClick={handleCopyInviteCode}>
                      <Copy className='mr-1 h-4 w-4' />
                      复制
                    </Button>
                    <Button variant='outline' size='sm' onClick={handleRegenCode}>
                      <RefreshCw className='mr-1 h-4 w-4' />
                      重新生成
                    </Button>
                  </div>
                </div>
                {isOwner && (
                  <div className='border-t pt-4'>
                    <p className='mb-2 text-sm font-medium text-destructive'>危险操作</p>
                    <Button variant='destructive' onClick={() => setDisbandOpen(true)}>
                      <Trash2 className='mr-2 h-4 w-4' />
                      解散团队
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit member dialog */}
      {editMember && (
        <EditMemberDialog
          member={editMember}
          onClose={() => setEditMember(null)}
          onSave={handleUpdateMember}
          isOwner={isOwner}
        />
      )}

      {/* Disband dialog */}
      <Dialog open={disbandOpen} onOpenChange={setDisbandOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>确认解散团队</DialogTitle>
            <DialogDescription>
              解散后所有成员将被移除，团队数据无法恢复。确定要解散「{team.name}」吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDisbandOpen(false)}>取消</Button>
            <Button variant='destructive' onClick={handleDisband}>确认解散</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer ownership dialog */}
      <Dialog open={transferOpen} onOpenChange={(open) => { setTransferOpen(open); if (!open) setTransferTarget(null) }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>转让团队创建者</DialogTitle>
            <DialogDescription>
              转让后您将成为普通成员，新创建者将获得全部管理权限。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2 py-2'>
            <p className='text-sm text-muted-foreground'>选择新创建者：</p>
            <div className='max-h-48 overflow-y-auto space-y-1'>
              {members.filter(m => m.user_id !== myMember.user_id).map(m => (
                <div
                  key={m.user_id}
                  onClick={() => setTransferTarget(m)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer border ${transferTarget?.user_id === m.user_id ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}
                >
                  <div>
                    <p className='text-sm font-medium'>{m.display_name || m.username}</p>
                    <p className='text-xs text-muted-foreground'>@{m.username} · {m.role === 'admin' ? '管理员' : '成员'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setTransferOpen(false)}>取消</Button>
            <Button
              variant='destructive'
              onClick={handleTransferOwnership}
              disabled={!transferTarget || transferring}
            >
              {transferring ? '转让中…' : `确认转让给 ${transferTarget?.display_name || transferTarget?.username || '…'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>确认退出团队</DialogTitle>
            <DialogDescription>退出后需要重新通过邀请码加入。确定要退出吗？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setLeaveOpen(false)}>取消</Button>
            <Button variant='destructive' onClick={handleLeave}>确认退出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation dialog */}
      <Dialog open={!!removingMember} onOpenChange={(o) => { if (!o) setRemovingMember(null) }}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>确认移除成员</DialogTitle>
            <DialogDescription>
              确定要将「{removingMember?.display_name || removingMember?.username}」移出团队吗？移除后需重新邀请才能加入。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRemovingMember(null)}>取消</Button>
            <Button variant='destructive' onClick={() => removingMember && handleRemoveMember(removingMember.user_id)}>
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Token dialog */}
      <Dialog open={createTokenOpen} onOpenChange={(open) => { setCreateTokenOpen(open); if (!open) setNewTokenName('') }}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>创建团队 Token</DialogTitle>
            <DialogDescription>Token 将绑定到本团队，所有成员均可查看。</DialogDescription>
          </DialogHeader>
          <div className='py-2'>
            <Input
              placeholder='Token 名称'
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateToken()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateTokenOpen(false)}>取消</Button>
            <Button onClick={handleCreateToken} disabled={creatingToken || !newTokenName.trim()}>
              {creatingToken ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create member dialog */}
      <Dialog open={createMemberOpen} onOpenChange={(open) => {
        setCreateMemberOpen(open)
        if (!open) { setNewMemberUsername(''); setNewMemberDisplayName('') }
      }}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>新建成员账号</DialogTitle>
            <DialogDescription>系统自动生成密码和 API Key，创建后一次性展示</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-3 py-2'>
            <Input
              placeholder='用户名（3-20 位）'
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              autoFocus
            />
            <Input
              placeholder='显示名称（可选，默认同用户名）'
              value={newMemberDisplayName}
              onChange={(e) => setNewMemberDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateMember()}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateMemberOpen(false)}>取消</Button>
            <Button onClick={handleCreateMember} disabled={creatingMember || !newMemberUsername.trim()}>
              {creatingMember ? '创建中…' : '创建账号'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New member result — one-time show of password + API key */}
      <Dialog open={!!newMemberResult} onOpenChange={(open) => { if (!open) setNewMemberResult(null) }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>账号创建成功 🎉</DialogTitle>
            <DialogDescription>请立即复制并安全发送给该成员，关闭后密码将无法再次查看</DialogDescription>
          </DialogHeader>
          {newMemberResult && (
            <div className='flex flex-col gap-3 py-1'>
              {[
                { label: '用户名', value: newMemberResult.username },
                { label: '登录密码', value: newMemberResult.password },
                { label: 'API Key', value: newMemberResult.api_key || '（生成失败，请在成员列表手动创建）' },
              ].map(({ label, value }) => (
                <div key={label} className='flex items-center gap-2 rounded-md bg-muted px-3 py-2'>
                  <span className='w-16 shrink-0 text-xs text-muted-foreground'>{label}</span>
                  <code className='flex-1 break-all text-xs'>{value}</code>
                  {value && !value.startsWith('（') && (
                    <Button variant='ghost' size='sm' className='h-6 px-2 shrink-0' onClick={() => {
                      navigator.clipboard.writeText(value)
                      toast.success(`${label}已复制`)
                    }}>
                      <Copy className='h-3 w-3' />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => {
              if (!newMemberResult) return
              const text = `用户名：${newMemberResult.username}\n登录密码：${newMemberResult.password}\nAPI Key：${newMemberResult.api_key}`
              navigator.clipboard.writeText(text)
              toast.success('已一键复制全部信息')
            }}>一键复制全部</Button>
            <Button onClick={() => setNewMemberResult(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show new token key dialog */}
      <Dialog open={!!newTokenKey} onOpenChange={(open) => { if (!open) setNewTokenKey(null) }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Token 创建成功</DialogTitle>
            <DialogDescription>请立即复制以下 Key，关闭后将无法再次查看完整 Key。</DialogDescription>
          </DialogHeader>
          <div className='rounded-md bg-muted px-3 py-2'>
            <code className='break-all text-xs'>{newTokenKey}</code>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => {
              if (newTokenKey) navigator.clipboard.writeText(newTokenKey)
              toast.success('已复制到剪贴板')
            }}>复制</Button>
            <Button onClick={() => setNewTokenKey(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditMemberDialog({
  member,
  onClose,
  onSave,
  isOwner,
}: {
  member: TeamMember
  onClose: () => void
  onSave: (role: string, quotaLimit: number, position: string) => void
  isOwner: boolean
}) {
  const [role, setRole] = useState(member.role)
  // quota_limit is stored in internal units; display/input in $ (1$ = 500000 units)
  const [quotaDollarStr, setQuotaDollarStr] = useState(
    member.quota_limit > 0 ? (member.quota_limit / 500000).toFixed(4) : ''
  )
  const [position, setPosition] = useState(member.position || '')

  const handleSave = () => {
    const dollars = parseFloat(quotaDollarStr)
    const quotaLimit = isNaN(dollars) || dollars <= 0 ? 0 : Math.round(dollars * 500000)
    onSave(role, quotaLimit, position)
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>编辑成员</DialogTitle>
          <DialogDescription>{member.display_name || member.username} (@{member.username})</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <div>
            <p className='mb-1 text-sm font-medium'>角色</p>
            <Select value={role} onValueChange={(val) => { if (val) setRole(val) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value='admin'>管理员</SelectItem>}
                <SelectItem value='member'>成员</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className='mb-1 text-sm font-medium'>岗位</p>
            <Input
              placeholder='如：前端工程师、产品经理'
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          <div>
            <p className='mb-1 text-sm font-medium'>额度限制（$ 美元，留空或 0 = 不限）</p>
            <div className='relative'>
              <Input
                type='number'
                min={0}
                step={0.0001}
                placeholder='0.0000'
                value={quotaDollarStr}
                onChange={(e) => setQuotaDollarStr(e.target.value)}
                className='pr-8'
              />
              <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>$</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────── Main Component ──────────

export function TeamV3() {
  const [team, setTeam] = useState<Team | null | undefined>(undefined)
  const [myMember, setMyMember] = useState<MyMember | null>(null)

  const fetchMyTeam = useCallback(async () => {
    const res = await api.get('/api/user/teamv3', { skipBusinessError: true })
    if (res.data.success) {
      if (res.data.data) {
        setTeam(res.data.data.team)
        setMyMember(res.data.data.member)
      } else {
        setTeam(null)
        setMyMember(null)
      }
    }
  }, [])

  useEffect(() => {
    fetchMyTeam()
  }, [fetchMyTeam])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <div className='flex items-center gap-2'>
          <Shield className='h-5 w-5' />
          企业团队管理
        </div>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {team === undefined ? (
          <div className='py-16 text-center text-muted-foreground'>加载中...</div>
        ) : team === null ? (
          <NoTeamPanel onCreated={fetchMyTeam} onJoined={fetchMyTeam} />
        ) : (
          <TeamDashboard team={team} myMember={myMember!} onLeft={fetchMyTeam} onTeamUpdate={setTeam} />
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
