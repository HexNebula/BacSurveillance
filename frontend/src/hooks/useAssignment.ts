import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assignmentApi } from '../lib/api'
import type { Teacher } from '../types'

// ── Global Teachers ───────────────────────────────────────────────────────────

export function useAllTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: assignmentApi.getAllTeachers,
  })
}

export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Teacher, 'id'>) => assignmentApi.createTeacher(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  })
}

export function useBulkCreateTeachers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignmentApi.bulkCreateTeachers,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  })
}

export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Teacher, 'id'>> }) =>
      assignmentApi.updateTeacher(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      // Also invalidate any exam-teacher queries since name/details may have changed
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

export function useDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignmentApi.deleteTeacher,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers'] }),
  })
}

// ── Exam Teacher Enrollment ───────────────────────────────────────────────────

export function useExamTeachers(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'teachers'],
    queryFn: () => assignmentApi.getExamTeachers(examId),
    enabled: !!examId,
  })
}

export function useEnrollTeacher(examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teacherId: number) => assignmentApi.enrollTeacher(examId, teacherId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams', examId, 'teachers'] }),
  })
}

export function useRemoveExamTeacher(examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teacherId: number) => assignmentApi.removeExamTeacher({ examId, teacherId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams', examId, 'teachers'] }),
  })
}

// ── Exemptions ────────────────────────────────────────────────────────────────

export function useExemptions(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'exemptions'],
    queryFn: () => assignmentApi.getExemptions(examId),
    enabled: !!examId,
  })
}

export function useCreateExemption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignmentApi.createExemption,
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['exams', vars.exam_id, 'exemptions'] }),
  })
}

export function useDeleteExemption(examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignmentApi.deleteExemption,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['exams', examId, 'exemptions'] }),
  })
}

// ── Distribution ──────────────────────────────────────────────────────────────

export function useRunAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignmentApi.runAssignment,
    onSuccess: (_, examId) => {
      qc.invalidateQueries({ queryKey: ['exams', examId, 'room-assignments'] })
    },
  })
}

export function useRoomAssignments(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'room-assignments'],
    queryFn: () => assignmentApi.getRoomAssignments(examId),
    enabled: !!examId,
  })
}

export function useUpdateRoomAssignment(examId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { supervisor_1_id?: number; supervisor_2_id?: number; is_validated?: boolean } }) =>
      assignmentApi.updateRoomAssignment(id, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['exams', examId, 'room-assignments'] }),
  })
}

export function useTeacherSchedule(examId: number) {
  return useQuery({
    queryKey: ['exams', examId, 'teacher-schedule'],
    queryFn: () => assignmentApi.getTeacherSchedule(examId),
    enabled: !!examId,
  })
}

// ── Workload ──────────────────────────────────────────────────────────────────

export function useWorkload(year: string) {
  return useQuery({
    queryKey: ['workload', year],
    queryFn: () => assignmentApi.getWorkload(year),
    enabled: !!year,
  })
}
