import { createContext, useContext } from 'react'

interface ActiveExamContextValue {
  examId: number
}

export const ActiveExamContext = createContext<ActiveExamContextValue>({ examId: 0 })

export function useActiveExam() {
  return useContext(ActiveExamContext)
}
