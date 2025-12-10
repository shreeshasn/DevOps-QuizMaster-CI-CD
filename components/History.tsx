import React from 'react';
import { QuizResult } from '../types';
import { getHistory, clearHistory } from '../services/storageService';
import { Button } from './Button';
import { Calendar, Trash2, ArrowLeft } from 'lucide-react';

interface HistoryProps {
  onBack: () => void;
}

export const History: React.FC<HistoryProps> = ({ onBack }) => {
  const [history, setHistory] = React.useState<QuizResult[]>([]);

  React.useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClear = () => {
    if (confirm("Are you sure you want to delete all quiz history?")) {
      clearHistory();
      setHistory([]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        <h2 className="text-2xl font-bold text-white">Quiz History</h2>
        <Button variant="danger" onClick={handleClear} disabled={history.length === 0} icon={<Trash2 className="w-4 h-4" />}>
          Clear
        </Button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
          <p className="text-slate-500 text-lg">No history found. Take a quiz to see results here!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item, idx) => (
            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-500 transition-colors">
              <div>
                <div className="flex items-center gap-3 mb-1">
                   <span className="text-lg font-semibold text-white">{item.quizTopic}</span>
                   <span className={`px-2 py-0.5 text-xs rounded-full ${
                     (item.score / item.totalQuestions) >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                   }`}>
                     {Math.round((item.score / item.totalQuestions) * 100)}% Score
                   </span>
                </div>
                <div className="flex items-center text-slate-400 text-sm gap-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString()}
                  </span>
                  <span>{item.score}/{item.totalQuestions} Correct</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
