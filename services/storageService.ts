import { QuizResult } from "../types";

const HISTORY_KEY = "quiz_app_history_v1";

export const saveResult = (result: QuizResult): void => {
  try {
    const existing = getHistory();
    const updated = [result, ...existing];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
};

export const getHistory = (): QuizResult[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read from local storage", e);
    return [];
  }
};

export const clearHistory = (): void => {
  localStorage.removeItem(HISTORY_KEY);
};
