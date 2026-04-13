import { FileText } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

export default function DocumentsPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Documents"
        subtitle="Génération des convocations et tableaux de surveillance"
      />
      <EmptyState
        icon={<FileText size={32} />}
        message="La génération des documents sera disponible après validation de l'algorithme sur données réelles."
      />
    </div>
  )
}
