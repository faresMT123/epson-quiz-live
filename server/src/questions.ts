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
    prompt: 'Le volume de la gamme Home est réduit de :',
    options: ['10%', '20%', '40%'],
    correctIndex: 1,
  },
  {
    id: 'q2',
    prompt: "La durabilité d'impression de la nouvelle gamme Home :",
    options: ['30 000 pages', '50 000 pages', '100 000 pages'],
    correctIndex: 1,
  },
  {
    id: 'q3',
    prompt:
      'Quel modèle est équipé de la fonction de numérisation et de copie recto-verso automatique ?',
    options: ['L5390', 'L6370', 'L4360'],
    correctIndex: 1,
  },
  {
    id: 'q4',
    prompt:
      "Quel est le rendement en pages de la bouteille d'encre noire incluse avec les nouveaux modèles ?",
    options: ['7 500 pages', '5 500 pages', '15 100 pages'],
    correctIndex: 2,
  },
  {
    id: 'q5',
    prompt: "Quel est le cycle d'utilisation de la L6370 ?",
    options: ['30 000 pages', '50 000 pages', '100 000 pages'],
    correctIndex: 2,
  },
];
