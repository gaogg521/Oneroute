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
import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, UserPlus, UserMinus, Search, X, Check, Clock, Eye, EyeOff,
  Copy, ChevronDown, ChevronRight, ChevronUp, RefreshCw
} from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { SectionPageLayout } from '@/components/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type MemberToken = {
  id: number
  name: string
  key: string
  used_quota: number
  remain_quota: number
  unlimited_quota: boolean
}

type TeamMember = {
  id: number
  username: string
  display_name: string
  email: string
  group: string
  created_at: number
  quota: number
  used_quota: number
  tokens: MemberToken[]
}

type TeamLeader = {
  id: number
  username: string
  display_name: string
  email: string
  member_count: number
  total_used_quota: number
}

function MaskedKeyCell({ tokens }: { tokens?: MemberToken[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!tokens || tokens.length === 0) return <span className='text-muted-foreground'>—</span>

  const shown = expanded ? tokens : tokens.slice(0, 1)
  const fmtQuota = (q: number) => (q / 500000).toFixed(4)

  return (
    <div className='space-y-1.5' onClick={e => e.stopPropagation()}>
      {shown.map(t => (
        <div key={t.id} className='space-y-0.5'>
          <div
            className='inline-flex items-center gap-1'
            title='该成员与您不在同一组织，为成员账号安全，禁止复制密钥'
          >
            <span className='cursor-not-allowed select-none font-mono text-xs text-muted-foreground'>
              {t.key}
            </span>
            {t.name && t.name !== '默认密钥' && (
              <span className='text-xs text-muted-foreground/60'>({t.name})</span>
            )}
          </div>
          <div className='flex gap-2 text-xs text-muted-foreground/70'>
            <span>已用 <span className='text-foreground/80'>${fmtQuota(t.used_quota)}</span></span>
            {t.unlimited_quota ? (
              <span>剩余 <span className='text-foreground/80'>不限</span></span>
            ) : (
              <span>剩余 <span className='text-foreground/80'>${fmtQuota(t.remain_quota)}</span></span>
            )}
          </div>
        </div>
      ))}
      {tokens.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          className='flex items-center gap-0.5 text-xs text-primary hover:underline cursor-pointer'
        >
          {expanded ? (
            <><ChevronUp className='h-3 w-3' />收起</>
          ) : (
            <><ChevronDown className='h-3 w-3' />展开全部 ({tokens.length})</>
          )}
        </button>
      )}
    </div>
  )
}

function CopyableKey({ token }: { token: MemberToken }) {
  const [copied, setCopied] = useState(false)
  const fmtQuota = (q: number) => (q / 500000).toFixed(4)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent table row collapse
    try {
      await navigator.clipboard.writeText(token.key)
      setCopied(true)
      toast.success('复制成功')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  return (
    <div className='space-y-0.5' onClick={e => e.stopPropagation()}>
      <div className='inline-flex items-center gap-1.5'>
        <span className='font-mono text-xs text-muted-foreground select-all'>
          {token.key}
        </span>
        {token.name && token.name !== '默认密钥' && (
          <span className='text-xs text-muted-foreground/60'>({token.name})</span>
        )}
        <button
          onClick={handleCopy}
          className='text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer'
          title='作为系统超管，允许复制和管理密钥'
        >
          {copied ? <Check className='h-3 w-3 text-green-500' /> : <Copy className='h-3 w-3' />}
        </button>
      </div>
      <div className='flex gap-2 text-xs text-muted-foreground/70'>
        <span>已用 <span className='text-foreground/80'>${fmtQuota(token.used_quota)}</span></span>
        {token.unlimited_quota ? (
          <span>剩余 <span className='text-foreground/80'>不限</span></span>
        ) : (
          <span>剩余 <span className='text-foreground/80'>${fmtQuota(token.remain_quota)}</span></span>
        )}
      </div>
    </div>
  )
}

type Invitation = {
  id: number
  inviter_id: number
  invitee_id: number
  status: number
  created_at: number
  inviter_name: string
  invitee_name: string
}

type SearchUser = {
  id: number
  username: string
  display_name: string
  email: string
}

export const Route = createFileRoute('/_authenticated/team/')({
  component: Team,
})

export function Team() {
  const { t } = useTranslation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [leaders, setLeaders] = useState<TeamLeader[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isLeader, setIsLeader] = useState(false)
  const [membersVisible, setMembersVisible] = useState(false)
  const [togglingVisible, setTogglingVisible] = useState(false)
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([])
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  // Dialog States
  const [kickConfirmMember, setKickConfirmMember] = useState<TeamMember | null>(null)
  const [kickTargetAdmin, setKickTargetAdmin] = useState<{ member: TeamMember, leaderId: number } | null>(null)
  const [kickingAdmin, setKickingAdmin] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState<number | null>(null)
  const [kicking, setKicking] = useState<number | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Super Admin States
  const [expandedLeaders, setExpandedLeaders] = useState<Set<number>>(new Set())
  const [membersMap, setMembersMap] = useState<Record<number, TeamMember[]>>({})
  const [membersLoading, setMembersLoading] = useState<Set<number>>(new Set())

  const PAGE_SIZE = 20

  const fetchAll = useCallback(async (p = page, kw = keyword) => {
    setLoading(true)
    try {
      const [settingsRes, receivedRes, sentRes] = await Promise.all([
        api.get('/api/user/team/settings', { skipBusinessError: true }),
        api.get('/api/user/team/invitations/received', { skipBusinessError: true }),
        api.get('/api/user/team/invitations/sent', { skipBusinessError: true }),
      ])

      if (settingsRes.data.success) {
        const s = settingsRes.data.data
        setIsLeader(s.is_leader)
        setMembersVisible(s.members_visible)
      }

      if (receivedRes.data.success) setReceivedInvitations(receivedRes.data.data || [])
      if (sentRes.data.success) setSentInvitations(sentRes.data.data || [])

      // Fetch members depending on role
      if (settingsRes.data.data?.is_leader) {
        const teamRes = await api.get('/api/user/team', {
          params: { page: p, page_size: PAGE_SIZE, keyword: kw },
          skipBusinessError: true
        })
        if (teamRes.data.success && teamRes.data.data) {
          const isUserAdmin = teamRes.data.data.is_admin || false
          setIsAdmin(isUserAdmin)
          if (isUserAdmin) {
            setLeaders(teamRes.data.data.page?.items || [])
            setTotal(teamRes.data.data.page?.total || 0)
          } else {
            setMembers(teamRes.data.data.page?.items || [])
            setTotal(teamRes.data.data.page?.total || 0)
          }
        }
      } else if (settingsRes.data.data?.members_visible) {
        const coRes = await api.get('/api/user/team/co-members', { params: { p: 1, page_size: 100 }, skipBusinessError: true })
        if (coRes.data.success && coRes.data.data) {
          setIsAdmin(false)
          setMembers(coRes.data.data.page?.items || [])
          setTotal(coRes.data.data.page?.total || 0)
        }
      } else {
        setIsAdmin(false)
        setMembers([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  const handleToggleVisible = async () => {
    setTogglingVisible(true)
    try {
      const res = await api.put('/api/user/team/settings', { members_visible: !membersVisible }, { skipBusinessError: true })
      if (res.data.success) {
        setMembersVisible(!membersVisible)
        toast.success(!membersVisible ? '已开启成员互见' : '已关闭成员互见')
      } else {
        toast.error(res.data.message || '操作失败')
      }
    } finally {
      setTogglingVisible(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleSearch = () => {
    setPage(1)
    fetchAll(1, keyword)
  }

  // Debounced user search
  useEffect(() => {
    if (!inviteOpen) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get('/api/user/team/search', {
          params: { q: searchQuery },
          skipBusinessError: true,
        })
        if (res.data.success) setSearchResults(res.data.data || [])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQuery, inviteOpen])

  const handleInvite = async (userId: number) => {
    setInviting(userId)
    try {
      const res = await api.post('/api/user/team/invite', { invitee_id: userId }, { skipBusinessError: true })
      if (res.data.success) {
        toast.success(t('Invitation sent'))
        setSearchResults((prev) => prev.filter((u) => u.id !== userId))
        fetchAll()
      } else {
        toast.error(res.data.message || t('Failed to send invitation'))
      }
    } finally {
      setInviting(null)
    }
  }

  const handleRespond = async (invitationId: number, action: 'accept' | 'reject') => {
    const res = await api.post(
      `/api/user/team/invitations/${invitationId}/respond`,
      { action },
      { skipBusinessError: true }
    )
    if (res.data.success) {
      toast.success(action === 'accept' ? t('Invitation accepted') : t('Invitation rejected'))
      fetchAll()
    } else {
      toast.error(res.data.message)
    }
  }

  const handleCancelInvitation = async (invitationId: number) => {
    const res = await api.delete(`/api/user/team/invitations/${invitationId}`, { skipBusinessError: true })
    if (res.data.success) {
      toast.success(t('Invitation cancelled'))
      fetchAll()
    } else {
      toast.error(res.data.message)
    }
  }

  const handleKick = async (member: TeamMember) => {
    setKickConfirmMember(member)
  }

  const confirmKick = async () => {
    if (!kickConfirmMember) return
    const memberId = kickConfirmMember.id
    setKickConfirmMember(null)
    setKicking(memberId)
    try {
      const res = await api.delete(`/api/user/team/members/${memberId}`, { skipBusinessError: true })
      if (res.data.success) {
        toast.success(t('Member removed'))
        fetchAll()
      } else {
        toast.error(res.data.message)
      }
    } finally {
      setKicking(null)
    }
  }

  // Super Admin Expand & Kick
  const toggleLeaderExpand = async (leaderId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (expandedLeaders.has(leaderId)) {
      setExpandedLeaders(prev => { const s = new Set(prev); s.delete(leaderId); return s })
      return
    }
    setExpandedLeaders(prev => new Set(prev).add(leaderId))
    if (!membersMap[leaderId]) {
      setMembersLoading(prev => new Set(prev).add(leaderId))
      try {
        const res = await api.get(`/api/admin/team/${leaderId}/members`)
        if (res?.data?.success) {
          setMembersMap(prev => ({ ...prev, [leaderId]: res.data.data || [] }))
        }
      } finally {
        setMembersLoading(prev => { const s = new Set(prev); s.delete(leaderId); return s })
      }
    }
  }

  const handleAdminKick = async () => {
    if (!kickTargetAdmin) return
    setKickingAdmin(true)
    try {
      const res = await api.delete(`/api/admin/team/members/${kickTargetAdmin.member.id}`, { skipBusinessError: true } as any)
      if (res?.data?.success) {
        toast.success(`成员「${kickTargetAdmin.member.display_name || kickTargetAdmin.member.username}」已移除`)
        setKickTargetAdmin(null)
        // Refresh members list for this leader
        const updatedRes = await api.get(`/api/admin/team/${kickTargetAdmin.leaderId}/members`)
        if (updatedRes?.data?.success) {
          setMembersMap(prev => ({ ...prev, [kickTargetAdmin.leaderId]: updatedRes.data.data || [] }))
        }
        fetchAll()
      } else {
        toast.error(res?.data?.message || '移除失败')
      }
    } finally {
      setKickingAdmin(false)
    }
  }

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString()
  const formatQuota = (q: number) => (q / 500000).toFixed(2)
  const displayName = (u: SearchUser | TeamMember) =>
    ('display_name' in u && u.display_name) ? u.display_name : u.username

  const sentUserIds = new Set(sentInvitations.map((i) => i.invitee_id))
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5' />
            {t('Team Management')}
          </div>
        </SectionPageLayout.Title>
        {isLeader && !isAdmin && (
          <SectionPageLayout.Actions>
            <Button onClick={() => { setInviteOpen(true); setSearchQuery(''); setSearchResults([]) }}>
              <UserPlus className='mr-2 h-4 w-4' />
              {t('Invite Member')}
            </Button>
          </SectionPageLayout.Actions>
        )}
        <SectionPageLayout.Content>
          <div className='space-y-4'>
            {/* Pending received invitations (Only for non-admin users) */}
            {!isAdmin && receivedInvitations.length > 0 && (
              <Card className='border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <Clock className='h-4 w-4 text-blue-500' />
                    {t('Pending Invitations')}
                    <Badge variant='secondary'>{receivedInvitations.length}</Badge>
                  </CardTitle>
                  <CardDescription>{t('You have pending team invitations')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    {receivedInvitations.map((inv) => (
                      <div key={inv.id} className='flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-gray-900'>
                        <span className='text-sm'>
                          <span className='font-medium'>{inv.inviter_name}</span>
                          {' '}{t('invited you to join their team')}
                        </span>
                        <div className='flex gap-2'>
                          <Button size='sm' onClick={() => handleRespond(inv.id, 'accept')}>
                            <Check className='mr-1 h-3 w-3' />
                            {t('Accept')}
                          </Button>
                          <Button size='sm' variant='outline' onClick={() => handleRespond(inv.id, 'reject')}>
                            <X className='mr-1 h-3 w-3' />
                            {t('Reject')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Table Card (Conditional Dual Rendering) */}
            <Card>
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <CardTitle>{t('Team Members')}</CardTitle>
                    <CardDescription className='mt-1 text-sm text-muted-foreground/90'>
                      {isAdmin
                        ? '您作为超级管理员正在以全局视图对账，查看和管理系统内所有邀请制团队长、其团队规模和总累计已用额度。'
                        : '适用于不在同一组织或者大家用各自账号做同一件事的团队管理，比如全球分布式办公做同一件事情，团队长可以查看和管理您邀请的团队成员。'}
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <div className='flex items-center gap-2 shrink-0'>
                      <div className='relative'>
                        <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          placeholder='搜索团队长用户名 / 邮箱'
                          value={keyword}
                          onChange={e => setKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          className='pl-8 h-8 w-52 text-xs'
                        />
                      </div>
                      <Button size='sm' variant='outline' className='h-8' onClick={handleSearch}>搜索</Button>
                      <Button size='sm' variant='ghost' className='h-8 w-8 p-0' onClick={() => fetchAll()} title='刷新'>
                        <RefreshCw className='h-4 w-4' />
                      </Button>
                    </div>
                  )}
                  {isLeader && !isAdmin && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={handleToggleVisible}
                      disabled={togglingVisible}
                      className='shrink-0'
                    >
                      {membersVisible ? (
                        <><Eye className='mr-1 h-4 w-4' />成员互见：开</>
                      ) : (
                        <><EyeOff className='mr-1 h-4 w-4' />成员互见：关</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className={isAdmin ? 'p-0' : ''}>
                {loading && (
                  <div className='py-12 text-center text-muted-foreground'>加载大盘数据中…</div>
                )}

                {/* 1. Super Admin View (Leaders and expandable members) */}
                {!loading && isAdmin && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-8' />
                          <TableHead>团队长</TableHead>
                          <TableHead>邮箱</TableHead>
                          <TableHead>团队人数</TableHead>
                          <TableHead>团队成员总已用额度</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className='text-center py-8 text-muted-foreground'>
                              暂无团队长信息
                            </TableCell>
                          </TableRow>
                        ) : leaders.map(leader => (
                          <Fragment key={leader.id}>
                            <TableRow className='cursor-pointer hover:bg-muted/40' onClick={(e) => toggleLeaderExpand(leader.id, e)}>
                              <TableCell>
                                {expandedLeaders.has(leader.id)
                                  ? <ChevronDown className='h-4 w-4 text-muted-foreground' />
                                  : <ChevronRight className='h-4 w-4 text-muted-foreground' />}
                              </TableCell>
                              <TableCell className='font-medium'>
                                <span>{leader.display_name || leader.username}</span>
                                <span className='text-muted-foreground ml-1 text-xs'>@{leader.username}</span>
                              </TableCell>
                              <TableCell>{leader.email || '—'}</TableCell>
                              <TableCell>
                                <span className='flex items-center gap-1 text-sm'>
                                  <Users className='h-3.5 w-3.5 text-muted-foreground' />
                                  {leader.member_count}
                                </span>
                              </TableCell>
                              <TableCell className='font-medium text-foreground/90'>
                                ${formatQuota(leader.total_used_quota)}
                              </TableCell>
                            </TableRow>
                            {expandedLeaders.has(leader.id) && (
                              <TableRow className='bg-muted/20 hover:bg-muted/20'>
                                <TableCell colSpan={5} className='p-0'>
                                  <div className='px-6 py-3'>
                                    {membersLoading.has(leader.id) ? (
                                      <p className='text-xs text-muted-foreground'>加载团队成员中…</p>
                                    ) : (membersMap[leader.id] || []).length === 0 ? (
                                      <p className='text-xs text-muted-foreground'>暂无下属成员</p>
                                    ) : (
                                      <Table className='w-full text-xs border-0'>
                                        <TableHeader>
                                          <TableRow className='border-b bg-transparent hover:bg-transparent'>
                                            <TableHead className='font-normal pb-1 text-muted-foreground'>成员</TableHead>
                                            <TableHead className='font-normal pb-1 text-muted-foreground'>分组</TableHead>
                                            <TableHead className='font-normal pb-1 text-muted-foreground'>API 密钥 (API Keys)</TableHead>
                                            <TableHead className='font-normal pb-1 text-muted-foreground'>额度 / 消耗</TableHead>
                                            <TableHead className='font-normal pb-1 text-right text-muted-foreground'>操作</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {(membersMap[leader.id] || []).map(m => (
                                            <TableRow key={m.id} className='border-b border-muted last:border-0 hover:bg-transparent'>
                                              <TableCell className='py-1.5 pr-4 font-medium'>
                                                <span>{m.display_name || m.username}</span>
                                                <span className='text-muted-foreground block text-2xs font-normal'>@{m.username}</span>
                                              </TableCell>
                                              <TableCell className='py-1.5 pr-4'>
                                                <Badge variant='outline' className='text-2xs'>{m.group}</Badge>
                                              </TableCell>
                                              <TableCell className='py-1.5 pr-4'>
                                                {m.tokens && m.tokens.length > 0 ? (
                                                  <div className='space-y-1.5'>
                                                    {m.tokens.map(tok => (
                                                      <CopyableKey key={tok.id} token={tok} />
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className='text-muted-foreground text-xs'>—</span>
                                                )}
                                              </TableCell>
                                              <TableCell className='py-1.5 pr-4 text-xs'>
                                                <div className='space-y-0.5'>
                                                  <div>额度: <span className='font-medium'>${formatQuota(m.quota)}</span></div>
                                                  <div className='text-2xs text-muted-foreground'>已用: ${formatQuota(m.used_quota)}</div>
                                                </div>
                                              </TableCell>
                                              <TableCell className='py-1.5 text-right'>
                                                <Button
                                                  variant='ghost'
                                                  size='sm'
                                                  className='text-destructive hover:text-destructive h-6 w-6 p-0 cursor-pointer'
                                                  title='踢出成员'
                                                  onClick={(ev) => { ev.stopPropagation(); setKickTargetAdmin({ member: m, leaderId: leader.id }) }}
                                                >
                                                  <UserMinus className='h-3.5 w-3.5' />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>

                    {totalPages > 1 && (
                      <div className='flex items-center justify-center gap-2 py-4 border-t'>
                        <Button
                          variant='outline' size='sm'
                          disabled={page <= 1}
                          onClick={() => { const p = page - 1; setPage(p); fetchAll(p) }}
                        >
                          上一页
                        </Button>
                        <span className='text-sm text-muted-foreground'>第 {page} / {totalPages} 页</span>
                        <Button
                          variant='outline' size='sm'
                          disabled={page >= totalPages}
                          onClick={() => { const p = page + 1; setPage(p); fetchAll(p) }}
                        >
                          下一页
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* 2. Regular User View (Personal Members List) */}
                {!loading && !isAdmin && (
                  members.length === 0 ? (
                    <div className='py-8 text-center text-muted-foreground'>
                      {isLeader
                        ? t('No team members yet. Click "Invite Member" to invite users.')
                        : membersVisible
                          ? '暂无其他团队成员'
                          : '团队长未开启成员互见，暂时无法查看其他成员'
                      }
                    </div>
                  ) : (
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('Username')}</TableHead>
                            <TableHead>{t('Email')}</TableHead>
                            <TableHead>{t('Group')}</TableHead>
                            <TableHead>API 密钥</TableHead>
                            <TableHead>{t('Quota')}</TableHead>
                            <TableHead>{t('Used Quota')}</TableHead>
                            <TableHead>{t('Joined At')}</TableHead>
                            {isLeader && <TableHead>{t('Actions')}</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell className='font-medium'>
                                {member.display_name || member.username}
                              </TableCell>
                              <TableCell>{member.email || '—'}</TableCell>
                              <TableCell>{member.group || 'default'}</TableCell>
                              <TableCell>
                                <MaskedKeyCell tokens={member.tokens} />
                              </TableCell>
                              <TableCell>{formatQuota(member.quota)} $</TableCell>
                              <TableCell>{formatQuota(member.used_quota)} $</TableCell>
                              <TableCell>{formatDate(member.created_at)}</TableCell>
                              {isLeader && (
                                <TableCell>
                                  <Button
                                    size='sm'
                                    variant='destructive'
                                    disabled={kicking === member.id}
                                    onClick={() => handleKick(member)}
                                  >
                                    <UserMinus className='mr-1 h-3 w-3' />
                                    {t('Kick')}
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className='mt-4 text-sm text-muted-foreground'>
                        {t('Total')} {total} {t('members')}
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Sent invitations (pending) - Only for Leader, not for Admin */}
            {!isAdmin && sentInvitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>{t('Sent Invitations')}</CardTitle>
                  <CardDescription>{t('Pending invitations you sent')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    {sentInvitations.map((inv) => (
                      <div key={inv.id} className='flex items-center justify-between rounded-lg border p-3'>
                        <span className='text-sm'>
                          {t('Waiting for')} <span className='font-medium'>{inv.invitee_name}</span> {t('to respond')}
                        </span>
                        <Button
                          size='sm'
                          variant='ghost'
                          onClick={() => handleCancelInvitation(inv.id)}
                        >
                          <X className='mr-1 h-3 w-3' />
                          {t('Cancel')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {/* 1. Kick confirmation dialog (For Leader) */}
      <Dialog open={!!kickConfirmMember} onOpenChange={(open) => { if (!open) setKickConfirmMember(null) }}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>确认踢出</DialogTitle>
            <DialogDescription>
              确定要将 <span className='font-medium'>{kickConfirmMember?.display_name || kickConfirmMember?.username}</span> 移出团队吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setKickConfirmMember(null)}>{t('Cancel')}</Button>
            <Button variant='destructive' onClick={confirmKick}>
              <UserMinus className='mr-1 h-4 w-4' />
              {t('Kick')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Kick confirmation dialog (For Admin) */}
      <Dialog open={!!kickTargetAdmin} onOpenChange={open => !open && setKickTargetAdmin(null)}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>踢出成员（管理员）</DialogTitle>
            <DialogDescription>
              确定要将成员「<strong>{kickTargetAdmin?.member.display_name || kickTargetAdmin?.member.username}</strong>」从该团队中踢出吗？此操作会清除他们的邀请推荐关系。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' size='sm' onClick={() => setKickTargetAdmin(null)}>取消</Button>
            <Button variant='destructive' size='sm' onClick={handleAdminKick} disabled={kickingAdmin}>
              {kickingAdmin ? '移除中…' : '确认踢出'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog (For Leader) */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Invite Member')}</DialogTitle>
            <DialogDescription>
              {t('Search by username, display name or email')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                className='pl-9'
                placeholder={t('Search users...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className='max-h-72 space-y-1 overflow-y-auto'>
              {searching && (
                <div className='py-4 text-center text-sm text-muted-foreground'>{t('Searching...')}</div>
              )}
              {!searching && searchQuery && searchResults.length === 0 && (
                <div className='py-4 text-center text-sm text-muted-foreground'>{t('No users found')}</div>
              )}
              {!searching && searchResults.map((user) => {
                const alreadyInvited = sentUserIds.has(user.id)
                const alreadyMember = members.some((m) => m.id === user.id)
                return (
                  <div key={user.id} className='flex items-center justify-between rounded-lg border p-2.5'>
                    <div>
                      <p className='text-sm font-medium'>{displayName(user)}</p>
                      <p className='text-xs text-muted-foreground'>@{user.username}{user.email ? ` · ${user.email}` : ''}</p>
                    </div>
                    {alreadyMember ? (
                      <Badge variant='secondary'>{t('Already in team')}</Badge>
                    ) : alreadyInvited ? (
                      <Badge variant='outline'>{t('Invited')}</Badge>
                    ) : (
                      <Button
                        size='sm'
                        disabled={inviting === user.id}
                        onClick={() => handleInvite(user.id)}
                      >
                        {t('Invite')}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
