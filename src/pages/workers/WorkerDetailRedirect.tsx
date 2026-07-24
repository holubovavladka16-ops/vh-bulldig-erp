import { Navigate, useParams } from 'react-router-dom'

export function WorkerDetailRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/delnici/${id}/osobni-karta`} replace />
}
