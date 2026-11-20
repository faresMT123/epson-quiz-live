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
    prompt: 'Que signifie le sigle « DPI » utilisé pour les imprimantes ?',
    options: [
      'Dots Per Inch (points par pouce)',
      'Data Print Interface',
      'Digital Page Index',
    ],
    correctIndex: 0,
  },
  {
    id: 'q2',
    prompt: 'Combien de couleurs de base compose une impression CMJN ?',
    options: ['Trois', 'Quatre', 'Six'],
    correctIndex: 1,
  },
  {
    id: 'q3',
    prompt: "Quel format de fichier est le plus adapté à l'impression professionnelle ?",
    options: ['Le PDF', 'Le GIF', 'Le BMP'],
    correctIndex: 0,
  },
  {
    id: 'q4',
    prompt: "Quelle technologie projette de fines gouttelettes d'encre sur le papier ?",
    options: ['Le laser', "Le jet d'encre", 'Le thermique direct'],
    correctIndex: 1,
  },
  {
    id: 'q5',
    prompt: "Quel est l'intérêt principal d'une imprimante à réservoir d'encre rechargeable ?",
    options: [
      'Un coût à la page réduit',
      "Une vitesse d'impression doublée",
      'Une résolution supérieure au laser',
    ],
    correctIndex: 0,
  },
];
