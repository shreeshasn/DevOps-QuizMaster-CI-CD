import React, { useState } from 'react';
import { QuizGenerator } from './components/QuizGenerator';
import { QuizTaker } from './components/QuizTaker';
import { QuizResults } from './components/QuizResults';
import { History } from './components/History';
import { Difficulty, Quiz, QuizResult, ViewState } from './types';
import { generateQuiz } from './services/geminiService';
import { saveResult } from './services/storageService';
import { History as HistoryIcon, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('HOME');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateQuiz = async (topic: string, difficulty: Difficulty) => {
    setIsGenerating(true);
    setError(null);
    try {
      const newQuiz = await generateQuiz(topic, difficulty);
      setQuiz(newQuiz);
      setView('QUIZ');
    } catch (err) {
      setError("Failed to generate quiz. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuizComplete = (answers: { questionId: number; selectedOptionIndex: number; isCorrect: boolean }[]) => {
    if (!quiz) return;
    
    const score = answers.filter(a => a.isCorrect).length;
    const newResult: QuizResult = {
      quizId: quiz.id,
      quizTopic: quiz.topic,
      score,
      totalQuestions: quiz.questions.length,
      date: Date.now(),
      answers
    };

    setResult(newResult);
    saveResult(newResult);
    setView('RESULTS');
  };

  const renderView = () => {
    switch (view) {
      case 'HOME':
        return <QuizGenerator onGenerate={handleGenerateQuiz} isGenerating={isGenerating} />;
      case 'QUIZ':
        return quiz ? <QuizTaker quiz={quiz} onComplete={handleQuizComplete} /> : null;
      case 'RESULTS':
        return quiz && result ? (
          <QuizResults 
            quiz={quiz} 
            result={result} 
            onRetry={() => {
              setQuiz(null);
              setResult(null);
              setView('HOME');
            }}
            onHome={() => setView('HOME')}
          />
        ) : null;
      case 'HISTORY':
        return <History onBack={() => setView('HOME')} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => setView('HOME')}
            className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" fill="currentColor" />
            </div>
            <span className="hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">DevOps QuizMaster</span>
          </button>

          <div className="flex items-center gap-4">
             {view === 'HOME' && (
                <button 
                  onClick={() => setView('HISTORY')}
                  className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
                >
                  <HistoryIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">History</span>
                </button>
             )}
             <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
             <div className="text-xs text-slate-500 font-mono hidden sm:block">
               v1.0.4-build.291
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-start p-6 md:p-12 relative">
        {error && (
          <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-8 flex items-center gap-3">
             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
             {error}
          </div>
        )}
        
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/50 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} DevOps QuizMaster. CI/CD Pipeline Artifact.</p>
          <p className="mt-1 text-xs opacity-50">Powered by Google Gemini 2.5 Flash</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
