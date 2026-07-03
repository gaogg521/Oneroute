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
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { TestConnectionResponse } from '../types'

/**
 * Shared "Test Connection" mutation + result state for a payment gateway
 * settings tab/section. Each gateway calls this once with its own test API
 * function; the returned `test` function should be invoked with that
 * gateway's request payload built from the current (possibly unsaved) form
 * values.
 */
export function useGatewayConnectionTest<TRequest>(
  mutationFn: (request: TRequest) => Promise<TestConnectionResponse>,
  t: (key: string) => string
) {
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data: TestConnectionResponse) => {
      setResult({ success: data.success, message: data.message })
      if (data.success) {
        toast.success(data.message || t('Connection succeeded'))
      } else {
        toast.error(data.message || t('Connection failed'))
      }
    },
    onError: (error: Error) => {
      const message = error.message || t('Connection failed')
      setResult({ success: false, message })
      toast.error(message)
    },
  })

  const test = (request: TRequest) => {
    setResult(null)
    mutation.mutate(request)
  }

  return { result, mutation, test }
}
