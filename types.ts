export enum Difficulty {
  Beginner = "Beginner",
  Intermediate = "Intermediate",
  Advanced = "Advanced",
  Expert = "Expert"
}

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: Question[];
  createdAt: number;
}

export interface QuizResult {
  quizId: string;
  quizTopic: string;
  score: number;
  totalQuestions: number;
  date: number;
  answers: {
    questionId: number;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }[];
  aiFeedback?: string; // High-level feedback from AI
}

export type ViewState = 'HOME' | 'GENERATING' | 'QUIZ' | 'RESULTS' | 'HISTORY';
