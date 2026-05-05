# Système de Gestion de la Surveillance des Examens

Une plateforme web complète conçue pour automatiser l'affectation des enseignants aux tâches de surveillance des examens. Le système optimise la répartition équitable de la charge de travail tout en respectant les contraintes académiques, les exclusions par matière et les préférences administratives.

## Caractéristiques Principales

### Moteur d'Affectation Automatisé
Le système utilise un algorithme glouton (greedy) sophistiqué avec retour sur trace (backtracking) pour gérer des exigences de planification complexes :
*   Répartition équitable de la charge de travail basée sur les données historiques de l'année académique.
*   Exclusion automatique des enseignants de la surveillance de leur propre matière.
*   Logique intelligente de jumelage des enseignants pour éviter les répétitions de duos dans les mêmes salles ou créneaux.
*   Prise en charge des affectations "Permanancier" (experts en la matière) et des pools de surveillants de réserve.

### Gestion de la Charge de Travail
*   Registre de Charge de Travail (Workload Ledger) : Suit le nombre d'activités de surveillance par enseignant sur plusieurs périodes d'examen (1Bac, 2Bac Normale, 2Bac Rattrapage).
*   Équilibrage des Activités : Surveille la répartition entre les sessions du matin et de l'après-midi pour garantir l'équité.
*   Système d'Exemption : Gestion flexible des exemptions d'enseignants par créneau spécifique, par jour ou par session.

### Outils Administratifs
*   Gestion du Cycle de Vie des Examens : Création et configuration des sessions d'examen avec durées personnalisées, délais d'arrivée et besoins en surveillants.
*   Registre Central des Ressources : Gestion centralisée des enseignants, des matières, des filières et des salles physiques.
*   Planification : Interface visuelle pour organiser les créneaux d'examen, les matières et les affectations de salles.

### Rapports et Documents
*   Exports Multi-formats : Génération de feuilles d'affectation officielles et d'emplois du temps aux formats Microsoft Word (.docx) et Excel (.xlsx).
*   Interface Multilingue : Support complet des langues arabe et française, répondant aux normes administratives régionales.

## Pile Technique

### Backend
*   Framework : FastAPI (Python 3.12+)
*   Base de données : PostgreSQL avec l'ORM SQLAlchemy 2.0
*   Migrations : Alembic
*   Génération de documents : python-docx, openpyxl
*   Validation : Pydantic v2

### Frontend
*   Framework : React 19 (TypeScript)
*   Outil de build : Vite
*   Stylisation : Tailwind CSS
*   Gestion d'état : TanStack Query (React Query)
*   Composants UI : Primitives Radix UI
*   Internationalisation : i18next (support Arabe et Français)

## Architecture

Le projet suit une architecture modulaire :

### Structure Backend
*   app/core : Configuration de la base de données, sécurité et paramètres globaux.
*   app/modules/assignment : Logique centrale pour l'allocation des surveillants et le suivi de la charge de travail.
*   app/modules/scheduling : Gestion des sessions d'examen, des créneaux et des matières.
*   app/modules/center : Gestion de l'infrastructure (salles, départements, etc.).
*   app/modules/document : Logique de génération des rapports administratifs.

### Structure Frontend
*   src/pages : Composants de page basés sur les fonctionnalités (Examens, Enseignants, Tableau de bord, etc.).
*   src/components : Composants UI réutilisables basés sur Radix UI.
*   src/hooks : Hooks React personnalisés pour la récupération de données et la logique d'état.
*   src/context : État global de l'application (ex: contexte de l'examen actif).

## Mise en Route

### Prérequis
*   Docker et Docker Compose
*   Node.js 20+
*   Python 3.12+

### Option A — Lancement avec Docker (recommandé)

La méthode la plus simple pour lancer l'ensemble de la pile :

```bash
git clone <repository-url>
cd exam-surveillance
docker-compose up --build
```

L'application sera disponible aux adresses suivantes :
*   Frontend : http://localhost:5173
*   API Backend : http://localhost:8000
*   Documentation API : http://localhost:8000/docs

### Option B — Installation manuelle

1. Cloner le dépôt :
```bash
git clone https://github.com/HexNebula/BacSurveillance
cd exam-surveillance
```

2. Configuration du Backend :
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Sur Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configurez vos accès à la base de données
```

3. Configuration du Frontend :
```bash
cd frontend
npm install
```

## Licence
Ce projet est propriétaire et destiné à un usage institutionnel interne.
