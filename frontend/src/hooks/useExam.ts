import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schedulingApi } from '../lib/api'
import type { Exam } from '../types'

// ── Exams ─────────────────────────────────────────────────────────────────────

export function useExams() {
  return useQuery({
    queryKey: ['exams'],
    queryFn: schedulingApi.getExams,
  })
}

export function useExam(id: number) {
  return useQuery({
    queryKey: ['exams', id],
    queryFn: () => schedulingApi.getExam(id),
    enabled: !!id,
  })
}

export function useCreateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Exam, 'id' | 'status'>) => schedulingApi.createExam(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })
}

export function useUpdateExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Exam, 'id' | 'level'>> }) =>
      schedulingApi.updateExam(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['exams'] })
      qc.invalidateQueries({ queryKey: ['exams', id] })
    },
  })
}

export function useDeleteExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulingApi.deleteExam,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  })
}

// ── ExamFilieres ──────────────────────────────────────────────────────────────

export function useExamFilieres(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'filieres'],
    queryFn: () => schedulingApi.getExamFilieres(examId),
    enabled: !!examId,
  })
}

export function useEnrollFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { exam_id: number; filiere_id: number; room_count: number }) =>
      schedulingApi.createExamFiliere(data),
    onSuccess: (_, { exam_id }) =>
      qc.invalidateQueries({ queryKey: ['exams', exam_id, 'filieres'] }),
  })
}

export function useUpdateExamFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { room_count?: number }; examId: number }) =>
      schedulingApi.updateExamFiliere(id, data),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['exams', vars.examId, 'filieres'] }),
  })
}

export function useRemoveExamFiliere() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number; examId: number }) =>
      schedulingApi.deleteExamFiliere(id),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['exams', vars.examId, 'filieres'] }),
  })
}

// ── ExamSlots ─────────────────────────────────────────────────────────────────

export function useExamSlots(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'slots'],
    queryFn: () => schedulingApi.getExamSlots(examId),
    enabled: !!examId,
  })
}

export function useCreateExamSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulingApi.createExamSlot,
    onSuccess: (slot) =>
      qc.invalidateQueries({ queryKey: ['exams', slot.exam_id, 'slots'] }),
  })
}

export function useUpdateExamSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { subject_id?: number; is_active?: boolean; reserve_count?: number }; examId: number }) =>
      schedulingApi.updateExamSlot(id, data),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['exams', vars.examId, 'slots'] }),
  })
}

export function useDeleteExamSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number; examId: number }) =>
      schedulingApi.deleteExamSlot(id),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['exams', vars.examId, 'slots'] }),
  })
}

// ── Room-Slot Assignments ─────────────────────────────────────────────────────

export function useRoomSlotAssignments(slotId: number) {
  return useQuery({
    queryKey: ['slots', slotId, 'rooms'],
    queryFn: () => schedulingApi.getRoomSlotAssignments(slotId),
    enabled: !!slotId,
  })
}

export function useAssignRoomToSlot(examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulingApi.assignRoomToSlot,
    onSuccess: (rsa) => {
      qc.invalidateQueries({ queryKey: ['slots', rsa.exam_slot_id, 'rooms'] })
      qc.invalidateQueries({ queryKey: ['exams', examId, 'slots'] })
    },
  })
}

export function useDeleteRoomSlotAssignment(slotId: number, examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulingApi.deleteRoomSlotAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots', slotId, 'rooms'] })
      qc.invalidateQueries({ queryKey: ['exams', examId, 'slots'] })
    },
  })
}

// ── Filière Rooms ─────────────────────────────────────────────────────────────

export function useFiliereRooms(examFiliereId: number) {
  return useQuery({
    queryKey: ['exam-filieres', examFiliereId, 'rooms'],
    queryFn: () => schedulingApi.getFiliereRooms(examFiliereId),
    enabled: !!examFiliereId,
  })
}

export function useAddFiliereRoom(examFiliereId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { room_id: number; supervisors_override?: number }) =>
      schedulingApi.addFiliereRoom(examFiliereId, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['exam-filieres', examFiliereId, 'rooms'] }),
  })
}

export function useRemoveFiliereRoom(examFiliereId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: schedulingApi.removeFiliereRoom,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['exam-filieres', examFiliereId, 'rooms'] }),
  })
}
