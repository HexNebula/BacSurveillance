// ── Enums ────────────────────────────────────────────────────────────────────

export type LevelEnum = 'BAC1' | 'BAC2_NORMALE' | 'BAC2_RATTRAPAGE'
export type ShiftEnum = 'MORNING' | 'AFTERNOON'
export type ExamStatusEnum = 'DRAFT' | 'ACTIVE' | 'VALIDATED'
export type CandidateTypeEnum = 'OFFICIEL' | 'LIBRE'
export type GenderEnum = 'M' | 'F'
export type ExemptionTypeEnum = 'SLOT' | 'SHIFT' | 'DAY'
export type AssignmentStatusEnum = 'AUTO' | 'OVERRIDDEN'

// ── Center ───────────────────────────────────────────────────────────────────

export interface CenterSettings {
  id: number
  name_fr: string
  name_ar: string
  convocation_template: string | null
  supervisors_per_room: number
}

export interface Room {
  id: number
  name: string
  capacity: number | null
}

export interface Subject {
  id: number
  name_fr: string
  name_ar: string
}

export interface FiliereSubject {
  id: number
  filiere_id: number
  subject_id: number
  order: number
}

export interface Filiere {
  id: number
  name_fr: string
  name_ar: string
  candidate_type: CandidateTypeEnum
  level: 'BAC1' | 'BAC2' | null
  filiere_subjects: FiliereSubject[]
}

// ── Scheduling ───────────────────────────────────────────────────────────────

export interface Exam {
  id: number
  year: string
  name_fr: string
  name_ar: string
  level: LevelEnum
  start_date: string   // ISO date "YYYY-MM-DD"
  end_date: string
  supervisor_arrival_delay: number
  student_arrival_delay: number
  supervisors_per_room: number
  max_reserves: number
  status: ExamStatusEnum
}

export interface ExamFiliere {
  id: number
  exam_id: number
  filiere_id: number
  room_count: number
}

export interface ExamSlot {
  id: number
  exam_id: number
  exam_filiere_id: number
  subject_id: number
  day: number          // ordinal: 1, 2, 3…
  shift: ShiftEnum
  slot_order: number   // 1 = S1, 2 = S2
  is_active: boolean
  reserve_count: number | null
}

export interface RoomSlotAssignment {
  id: number
  exam_slot_id: number
  room_id: number
  supervisors_override: number | null
}

export interface ExamFiliereRoom {
  id: number
  exam_filiere_id: number
  room_id: number
  supervisors_override: number | null
}

// ── Assignment ───────────────────────────────────────────────────────────────

export interface Teacher {
  id: number
  name_fr: string
  name_ar: string
  gender: GenderEnum
  cin: string
  som: string | null
  school: string | null
  subject_id: number | null
  ordinal: number | null
}

export interface ExamTeacher {
  id: number
  exam_id: number
  teacher_id: number
}

export interface TeacherExemption {
  id: number
  teacher_id: number
  exam_id: number
  exemption_type: ExemptionTypeEnum
  ref_value: string
}

export interface RoomAssignment {
  id: number
  room_slot_assignment_id: number
  room_id: number
  room_name: string
  exam_slot_id: number
  day: number
  shift: 'MORNING' | 'AFTERNOON'
  slot_order: number
  exam_filiere_id: number
  filiere_name: string
  supervisor_1_id: number | null
  supervisor_2_id: number | null
  status: AssignmentStatusEnum
  is_validated: boolean
}

// ── Teacher schedule ──────────────────────────────────────────────────────────

export interface TeacherSlotCell {
  slot_id: number
  day: number
  shift: 'MORNING' | 'AFTERNOON'
  slot_order: number
  filiere_name: string
  role: 'SUPERVISOR' | 'RESERVE' | 'MADAOUM' | null
  room_name: string | null
}

export interface TeacherScheduleRow {
  teacher_id: number
  name_fr: string
  ordinal: number | null
  cin: string
  cells: TeacherSlotCell[]
  total_supervisor: number
  total_reserve: number
  total_madaoum: number
}

export interface TeacherSchedule {
  teachers: TeacherScheduleRow[]
}

// ── WorkloadLedger ────────────────────────────────────────────────────────────

export interface WorkloadLedger {
  id: number
  cin: string
  year: string
  total_count: number
  bac1_count: number
  bac2_count: number
  morning_count: number
  afternoon_count: number
}

// ── Algorithm result ──────────────────────────────────────────────────────────

export interface AssignmentWarning {
  type: string
  code: string
  message: string
  context: Record<string, unknown>
}

export interface AssignmentResult {
  room_assignments: RoomAssignment[]
  warnings: AssignmentWarning[]
  total_activities: number
  fair_target_floor: number
  fair_target_ceil: number
}
