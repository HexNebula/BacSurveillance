import axios from 'axios'
import type {
  CenterSettings, Room, Subject, Filiere, FiliereSubject,
  Exam, ExamFiliere, ExamSlot, RoomSlotAssignment, ExamFiliereRoom,
  Teacher, ExamTeacher, TeacherExemption, RoomAssignment, WorkloadLedger, TeacherSchedule,
} from '../types'

const http = axios.create({ baseURL: '/api/v1', timeout: 60_000 })

// ── Center ────────────────────────────────────────────────────────────────────

export const centerApi = {
  getSettings: () =>
    http.get<CenterSettings>('/center/settings').then(r => r.data),

  updateSettings: (data: Partial<Pick<CenterSettings, 'name_fr' | 'name_ar' | 'convocation_template' | 'supervisors_per_room'>>) =>
    http.patch<CenterSettings>('/center/settings', data).then(r => r.data),

  // Rooms
  getRooms: () =>
    http.get<Room[]>('/center/rooms').then(r => r.data),

  createRoom: (data: { name: string; capacity?: number }) =>
    http.post<Room>('/center/rooms', data).then(r => r.data),

  updateRoom: (id: number, data: { name?: string; capacity?: number }) =>
    http.patch<Room>(`/center/rooms/${id}`, data).then(r => r.data),

  deleteRoom: (id: number) =>
    http.delete(`/center/rooms/${id}`),

  // Subjects
  getSubjects: () =>
    http.get<Subject[]>('/center/subjects').then(r => r.data),

  createSubject: (data: { name_fr: string; name_ar?: string }) =>
    http.post<Subject>('/center/subjects', data).then(r => r.data),

  updateSubject: (id: number, data: { name_fr?: string; name_ar?: string }) =>
    http.patch<Subject>(`/center/subjects/${id}`, data).then(r => r.data),

  deleteSubject: (id: number) =>
    http.delete(`/center/subjects/${id}`),

  // Filieres
  getFilieres: (level?: string) =>
    http.get<Filiere[]>('/center/filieres', { params: level ? { level } : undefined }).then(r => r.data),

  createFiliere: (data: { name_fr: string; name_ar?: string; candidate_type?: string }) =>
    http.post<Filiere>('/center/filieres', data).then(r => r.data),

  updateFiliere: (id: number, data: { name_fr?: string; name_ar?: string; candidate_type?: string }) =>
    http.patch<Filiere>(`/center/filieres/${id}`, data).then(r => r.data),

  deleteFiliere: (id: number) =>
    http.delete(`/center/filieres/${id}`),

  addFiliereSubject: (filiereId: number, data: { subject_id: number; order?: number }) =>
    http.post<FiliereSubject>(`/center/filieres/${filiereId}/subjects`, data).then(r => r.data),

  removeFiliereSubject: (fsId: number) =>
    http.delete(`/center/filiere-subjects/${fsId}`),

  copyFiliereSubjects: (targetId: number, sourceId: number) =>
    http.post<{ added: number }>(`/center/filieres/${targetId}/copy-subjects-from`, { source_filiere_id: sourceId }).then(r => r.data),
}

// ── Scheduling ────────────────────────────────────────────────────────────────

export const schedulingApi = {
  // Exams
  getExams: () =>
    http.get<Exam[]>('/scheduling/exams').then(r => r.data),

  getExam: (id: number) =>
    http.get<Exam>(`/scheduling/exams/${id}`).then(r => r.data),

  createExam: (data: Omit<Exam, 'id' | 'status'>) =>
    http.post<Exam>('/scheduling/exams', data).then(r => r.data),

  updateExam: (id: number, data: Partial<Omit<Exam, 'id' | 'level'>>) =>
    http.patch<Exam>(`/scheduling/exams/${id}`, data).then(r => r.data),

  deleteExam: (id: number) =>
    http.delete(`/scheduling/exams/${id}`),

  // ExamFilieres
  getExamFilieres: (examId: number) =>
    http.get<ExamFiliere[]>(`/scheduling/exams/${examId}/filieres`).then(r => r.data),

  createExamFiliere: (data: { exam_id: number; filiere_id: number; room_count: number }) =>
    http.post<ExamFiliere>('/scheduling/exam-filieres', data).then(r => r.data),

  updateExamFiliere: (id: number, data: { room_count?: number }) =>
    http.patch<ExamFiliere>(`/scheduling/exam-filieres/${id}`, data).then(r => r.data),

  deleteExamFiliere: (id: number) =>
    http.delete(`/scheduling/exam-filieres/${id}`),

  // Exam slots
  getExamSlots: (examId: number) =>
    http.get<ExamSlot[]>(`/scheduling/exams/${examId}/slots`).then(r => r.data),

  createExamSlot: (data: {
    exam_id: number; exam_filiere_id: number; subject_id: number
    day: number; shift: string; slot_order: number
  }) =>
    http.post<ExamSlot>('/scheduling/exam-slots', data).then(r => r.data),

  updateExamSlot: (id: number, data: { subject_id?: number; is_active?: boolean; reserve_count?: number }) =>
    http.patch<ExamSlot>(`/scheduling/exam-slots/${id}`, data).then(r => r.data),

  deleteExamSlot: (id: number) =>
    http.delete(`/scheduling/exam-slots/${id}`),

  copySlots: (targetEfId: number, sourceEfId: number) =>
    http.post<ExamSlot[]>(`/scheduling/exam-filieres/${targetEfId}/copy-slots-from`, { source_ef_id: sourceEfId }).then(r => r.data),

  // ExamFiliereRooms — rooms assigned once per filière
  getFiliereRooms: (efId: number) =>
    http.get<ExamFiliereRoom[]>(`/scheduling/exam-filieres/${efId}/rooms`).then(r => r.data),

  addFiliereRoom: (efId: number, data: { room_id: number; supervisors_override?: number }) =>
    http.post<ExamFiliereRoom>(`/scheduling/exam-filieres/${efId}/rooms`, data).then(r => r.data),

  removeFiliereRoom: (id: number) =>
    http.delete(`/scheduling/exam-filiere-rooms/${id}`),

  // Room-slot assignments
  getRoomSlotAssignments: (slotId: number) =>
    http.get<RoomSlotAssignment[]>(`/scheduling/exam-slots/${slotId}/rooms`).then(r => r.data),

  assignRoomToSlot: (data: { exam_slot_id: number; room_id: number; supervisors_override?: number }) =>
    http.post<RoomSlotAssignment>('/scheduling/room-slot-assignments', data).then(r => r.data),

  deleteRoomSlotAssignment: (id: number) =>
    http.delete(`/scheduling/room-slot-assignments/${id}`),
}

// ── Assignment ────────────────────────────────────────────────────────────────

export const assignmentApi = {
  // Global teachers
  getAllTeachers: () =>
    http.get<Teacher[]>('/assignment/teachers').then(r => r.data),

  createTeacher: (data: Omit<Teacher, 'id'>) =>
    http.post<Teacher>('/assignment/teachers', data).then(r => r.data),

  bulkCreateTeachers: (teachers: Array<Omit<Teacher, 'id'>>) =>
    http.post<Teacher[]>('/assignment/teachers/bulk', teachers).then(r => r.data),

  updateTeacher: (id: number, data: Partial<Omit<Teacher, 'id'>>) =>
    http.patch<Teacher>(`/assignment/teachers/${id}`, data).then(r => r.data),

  deleteTeacher: (id: number) =>
    http.delete(`/assignment/teachers/${id}`),

  // Exam enrollment
  getExamTeachers: (examId: number) =>
    http.get<Teacher[]>(`/assignment/exams/${examId}/teachers`).then(r => r.data),

  enrollTeacher: (examId: number, teacherId: number) =>
    http.post<ExamTeacher>(`/assignment/exams/${examId}/teachers`, { teacher_id: teacherId }).then(r => r.data),

  removeExamTeacher: ({ examId, teacherId }: { examId: number; teacherId: number }) =>
    http.delete(`/assignment/exams/${examId}/teachers/${teacherId}`),

  // Exemptions
  getExemptions: (examId: number) =>
    http.get<TeacherExemption[]>(`/assignment/exams/${examId}/exemptions`).then(r => r.data),

  createExemption: (data: { teacher_id: number; exam_id: number; exemption_type: string; ref_value: string }) =>
    http.post<TeacherExemption>('/assignment/exemptions', data).then(r => r.data),

  deleteExemption: (id: number) =>
    http.delete(`/assignment/exemptions/${id}`),

  // Distribution
  runAssignment: (examId: number) =>
    http.post<{
      room_assignments: RoomAssignment[]
      warnings: Array<{ type: string; code: string; message: string; context: Record<string, unknown> }>
      total_activities: number
      fair_target_floor: number
      fair_target_ceil: number
    }>(`/assignment/exams/${examId}/run`).then(r => r.data),

  resetAssignment: (examId: number) =>
    http.post(`/assignment/exams/${examId}/reset`).then(r => r.data),

  getRoomAssignments: (examId: number) =>
    http.get<RoomAssignment[]>(`/assignment/exams/${examId}/room-assignments`).then(r => r.data),

  updateRoomAssignment: (id: number, data: { supervisor_1_id?: number; supervisor_2_id?: number; is_validated?: boolean }) =>
    http.patch<RoomAssignment>(`/assignment/room-assignments/${id}`, data).then(r => r.data),

  getTeacherSchedule: (examId: number) =>
    http.get<TeacherSchedule>(`/assignment/exams/${examId}/teacher-schedule`).then(r => r.data),

  // Workload
  getWorkload: (year: string) =>
    http.get<WorkloadLedger[]>(`/assignment/workload/${year}`).then(r => r.data),
}
