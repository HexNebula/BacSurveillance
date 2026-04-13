import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { centerApi } from '../lib/api'

export function useCenterSettings() {
  return useQuery({
    queryKey: ['center', 'settings'],
    queryFn: centerApi.getSettings,
  })
}

export function useUpdateCenterSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'settings'] }),
  })
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export function useRooms() {
  return useQuery({
    queryKey: ['center', 'rooms'],
    queryFn: centerApi.getRooms,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.createRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'rooms'] }),
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; capacity?: number } }) =>
      centerApi.updateRoom(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'rooms'] }),
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.deleteRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'rooms'] }),
  })
}

// ── Subjects ──────────────────────────────────────────────────────────────────

export function useSubjects() {
  return useQuery({
    queryKey: ['center', 'subjects'],
    queryFn: centerApi.getSubjects,
  })
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.createSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'subjects'] }),
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name_fr?: string; name_ar?: string } }) =>
      centerApi.updateSubject(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'subjects'] }),
  })
}

export function useDeleteSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'subjects'] }),
  })
}

// ── Filieres ──────────────────────────────────────────────────────────────────

export function useFilieres() {
  return useQuery({
    queryKey: ['center', 'filieres'],
    queryFn: centerApi.getFilieres,
  })
}

export function useCreateFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.createFiliere,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'filieres'] }),
  })
}

export function useUpdateFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name_fr?: string; name_ar?: string; candidate_type?: string } }) =>
      centerApi.updateFiliere(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'filieres'] }),
  })
}

export function useDeleteFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.deleteFiliere,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'filieres'] }),
  })
}

export function useAddFiliereSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ filiereId, subject_id, order }: { filiereId: number; subject_id: number; order?: number }) =>
      centerApi.addFiliereSubject(filiereId, { subject_id, order }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'filieres'] }),
  })
}

export function useRemoveFiliereSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: centerApi.removeFiliereSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['center', 'filieres'] }),
  })
}
