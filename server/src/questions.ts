/**
 * Questions du quiz.
 *
 * Chaque question possède entre 2 et 5 propositions et un seul index correct.
 * L'organisateur peut les modifier depuis l'interface admin (elles sont alors
 * conservées en mémoire pour les rooms suivantes).
 *
 * `correctIndex` n'est JAMAIS transmis au joueur : seule une projection sans
 * la correction est envoyée sur le réseau.
 */

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/** Quiz proposé au démarrage du serveur. */
export const QUESTIONS: readonly Question[] = [
  {
    id: 'q1',
    prompt: 'Les imprimantes Epson AM Series sont destinées principalement à quel environnement ?',
    options: ['Domestique', 'Bureau / entreprise', 'Industriel'],
    correctIndex: 1,
  },
  {
    id: 'q2',
    prompt: "Quel type de technologie utilisent les vidéoprojecteurs Epson ?",
    options: ['LED', '3LCD', 'DLP'],
    correctIndex: 1,
  },
  {
    id: 'q3',
    prompt:
      'Sur le segment A3, quelle est la plage de vitesses d’impression proposée par Epson pour ses modèles couleur Business Professionnelles?',
    options: ['De 10 à 50 pages par minute', 'De 25 à 100 pages par minute', 'De 30 à 80 pages par minute'],
    correctIndex: 1,
  },
];
