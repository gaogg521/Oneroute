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
import { useState, useEffect, useCallback, Fragment } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Trash2, Users, ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin-teamv3/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: AdminTeamV3Page,
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

type TeamMember = {
  id: number
  user_id: number
  role: string
  position: string
  quota_limit: number
  joined_at: number
  username: string
  display_name: string
  email: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: '创建者',
  admin: '管理员',
  member: '成员',
}

function formatQuota(q: number) {
  if (q <= 0) return '不限'
  return `$${(q / 500000).toFixed(4)}`
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('zh-CN')
}

function AdminTeamV3Page() {
  const [teams, setTeams] = useState<Team[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [disbandTarget, setDisbandTarget] = useState<Team | null>(null)
  const [disbanding, setDisbanding] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set())
  const [membersMap, setMembersMap] = useState<Record<number, TeamMember[]>>({})
  const [membersLoading, setMembersLoading] = useState<Set<number>>(new Set())

  const PAGE_SIZE = 20

  const fetchTeams = useCallback(async (p = page, kw = keyword) => {
    setLoading(true)
    try {
      const res = await api.get('/api/admin/teamv3', {
        params: { page: p, page_size: PAGE_SIZE, keyword: kw },
      })
      if (res.data.success) {
        setTeams(res.data.data.items || [])
        setTotal(res.data.data.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, keyword])

  useEffect(() => { fetchTeams() }, [])

  const handleSearch = () => {
    setPage(1)
    fetchTeams(1, keyword)
  }

  const toggleExpand = async (teamId: number) => {
    if (expandedTeams.has(teamId)) {
      setExpandedTeams(prev => { const s = new Set(prev); s.delete(teamId); return s })
      return
    }
    setExpandedTeams(prev => new Set(prev).add(teamId))
    if (!membersMap[teamId]) {
      setMembersLoading(prev => new Set(prev).add(teamId))
      try {
        const res = await api.get(`/api/admin/teamv3/${teamId}/members`)
        if (res.data.success) {
          setMembersMap(prev => ({ ...prev, [teamId]: res.data.data || [] }))
        }
      } finally {
        setMembersLoading(prev => { const s = new Set(prev); s.delete(teamId); return s })
      }
    }
  }

  const handleSetOwner = async (teamId: number, member: TeamMember) => {
    if (!confirm(`确定将「${member.display_name || member.username}」设为团队创建者吗？当前创建者将变为普通成员。`)) return
    try {
      const res = await api.post(`/api/admin/teamv3/${teamId}/transfer`, { new_owner_id: member.user_id }, { skipBusinessError: true } as any)
      if (res.data.success) {
        toast.success('创建者已更新')
        setMembersMap(prev => ({ ...prev, [teamId]: [] }))
        const newRes = await api.get(`/api/admin/teamv3/${teamId}/members`)
        if (newRes.data.success) {
          setMembersMap(prev => ({ ...prev, [teamId]: newRes.data.data || [] }))
        }
      } else {
        toast.error(res.data.message || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDisband = async () => {
    if (!disbandTarget) return
    setDisbanding(true)
    try {
      const res = await api.delete(`/api/admin/teamv3/${disbandTarget.id}`, { skipBusinessError: true } as any)
      if (res.data.success) {
        toast.success(`团队「${disbandTarget.name}」已解散`)
        setDisbandTarget(null)
        setExpandedTeams(prev => { const s = new Set(prev); s.delete(disbandTarget.id); return s })
        fetchTeams()
      } else {
        toast.error(res.data.message || '解散失败')
      }
    } finally {
      setDisbanding(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <div className="flex flex-col gap-1">
          <span>企业团队管理</span>
          <span className="text-xs font-normal text-muted-foreground">查看和管理系统内所有企业团队</span>
        </div>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-4'>
            <CardTitle className='text-base'>全部团队（{total}）</CardTitle>
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='搜索团队名称'
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className='pl-8 w-56'
                />
              </div>
              <Button variant='outline' size='sm' onClick={handleSearch}>搜索</Button>
              <Button variant='ghost' size='sm' onClick={() => fetchTeams()} title='刷新'>
                <RefreshCw className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8' />
                <TableHead>团队名称</TableHead>
                <TableHead>邀请码</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className='text-right'>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                    加载中…
                  </TableCell>
                </TableRow>
              ) : teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                    暂无企业团队
                  </TableCell>
                </TableRow>
              ) : teams.map(team => (
                <Fragment key={team.id}>
                  <TableRow className='cursor-pointer hover:bg-muted/40'>
                    <TableCell onClick={() => toggleExpand(team.id)}>
                      {expandedTeams.has(team.id)
                        ? <ChevronDown className='h-4 w-4 text-muted-foreground' />
                        : <ChevronRight className='h-4 w-4 text-muted-foreground' />}
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(team.id)} className='font-medium'>
                      {team.name}
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(team.id)}>
                      <code className='text-xs bg-muted px-1.5 py-0.5 rounded'>{team.invite_code}</code>
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(team.id)}>
                      <span className='flex items-center gap-1'>
                        <Users className='h-3.5 w-3.5 text-muted-foreground' />
                        {team.member_count}
                      </span>
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(team.id)} className='text-muted-foreground text-sm'>
                      {formatDate(team.created_at)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive h-7 w-7 p-0'
                        title='解散团队'
                        onClick={() => setDisbandTarget(team)}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedTeams.has(team.id) && (
                    <TableRow className='bg-muted/20 hover:bg-muted/20'>
                      <TableCell colSpan={6} className='p-0'>
                        <div className='px-6 py-3'>
                          {membersLoading.has(team.id) ? (
                            <p className='text-sm text-muted-foreground'>加载成员中…</p>
                          ) : (membersMap[team.id] || []).length === 0 ? (
                            <p className='text-sm text-muted-foreground'>暂无成员</p>
                          ) : (
                            <table className='w-full text-sm'>
                              <thead>
                                <tr className='text-muted-foreground border-b'>
                                  <th className='text-left font-normal pb-1.5 pr-4'>用户</th>
                                  <th className='text-left font-normal pb-1.5 pr-4'>角色</th>
                                  <th className='text-left font-normal pb-1.5 pr-4'>岗位</th>
                                  <th className='text-left font-normal pb-1.5 pr-4'>额度限制</th>
                                  <th className='text-left font-normal pb-1.5 pr-4'>加入时间</th>
                                  <th className='text-left font-normal pb-1.5'>操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(membersMap[team.id] || []).map(m => (
                                  <tr key={m.id} className='border-b border-muted last:border-0'>
                                    <td className='py-1.5 pr-4'>
                                      <span className='font-medium'>{m.display_name || m.username}</span>
                                      <span className='text-muted-foreground ml-1'>@{m.username}</span>
                                    </td>
                                    <td className='py-1.5 pr-4'>
                                      <Badge variant={m.role === 'owner' ? 'default' : m.role === 'admin' ? 'secondary' : 'outline'} className='text-xs'>
                                        {ROLE_LABELS[m.role] ?? m.role}
                                      </Badge>
                                    </td>
                                    <td className='py-1.5 pr-4 text-muted-foreground'>{m.position || '—'}</td>
                                    <td className='py-1.5 pr-4'>{formatQuota(m.quota_limit)}</td>
                                    <td className='py-1.5 pr-4 text-muted-foreground'>{formatDate(m.joined_at)}</td>
                                    <td className='py-1.5'>
                                      {m.role !== 'owner' && (
                                        <button
                                          onClick={() => handleSetOwner(team.id, m)}
                                          className='text-xs text-primary hover:underline'
                                        >
                                          设为创建者
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                onClick={() => { const p = page - 1; setPage(p); fetchTeams(p) }}
              >
                上一页
              </Button>
              <span className='text-sm text-muted-foreground'>第 {page} / {totalPages} 页</span>
              <Button
                variant='outline' size='sm'
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); fetchTeams(p) }}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disband confirmation */}
      <Dialog open={!!disbandTarget} onOpenChange={open => !open && setDisbandTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>解散团队</DialogTitle>
            <DialogDescription>
              确定要解散团队「<strong>{disbandTarget?.name}</strong>」吗？此操作不可恢复，团队内所有成员将被移除，团队 Token 将转为个人 Token。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDisbandTarget(null)}>取消</Button>
            <Button variant='destructive' onClick={handleDisband} disabled={disbanding}>
              {disbanding ? '解散中…' : '确认解散'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
