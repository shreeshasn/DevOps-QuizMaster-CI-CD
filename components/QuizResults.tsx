import React, { useEffect, useState } from 'react';
import { Quiz, QuizResult } from '../types';
import { analyzePerformance } from '../services/geminiService';
import { Button } from './Button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, Check, Home, RotateCcw } from 'lucide-react';

interface QuizResultsProps {
  quiz: Quiz;
  result: QuizResult;
  onRetry: () => void;
  onHome: () => void;
}

export const QuizResults: React.FC<QuizResultsProps> = ({ quiz, result, onRetry, onHome }) => {
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      const feedback = await analyzePerformance(result, quiz);
      setAiFeedback(feedback);
      setLoadingFeedback(false);
    };
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  const data = [
    { name: 'Correct', value: result.score },
    { name: 'Incorrect', value: result.totalQuestions - result.score },
  ];
  const COLORS = ['#10b981', '#ef4444'];

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in space-y-6">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-white mb-2">Quiz Complete!</h2>
            <p className="text-slate-400 mb-6">Topic: <span className="text-indigo-400">{quiz.topic}</span></p>
            
            <div className="flex items-center gap-4">
               <div className="text-5xl font-extrabold text-white">{percentage}%</div>
               <div className="text-sm text-slate-400">
                  <p>Score: {result.score} / {result.totalQuestions}</p>
                  <p className="text-emerald-400">{percentage >= 70 ? 'Great Job!' : 'Keep Practicing'}</p>
               </div>
            </div>
            
            {/* AI Feedback Section */}
            <div className="mt-6 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
               <h3 className="text-indigo-300 text-sm font-semibold mb-2 uppercase tracking-wide">AI Performance Analysis</h3>
               {loadingFeedback ? (
                 <div className="h-6 w-3/4 bg-indigo-500/20 animate-pulse rounded"></div>
               ) : (
                 <p className="text-slate-300 text-sm leading-relaxed">{aiFeedback}</p>
               )}
            </div>
        </div>

        {/* Chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[250px]">
           <h3 className="text-slate-400 text-sm font-medium mb-2">Accuracy Breakdown</h3>
           <div className="w-full h-[180px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={data}
                   cx="50%"
                   cy="50%"
                   innerRadius={50}
                   outerRadius={70}
                   fill="#8884d8"
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {data.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                 />
               </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Correct</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Incorrect</div>
           </div>
        </div>
      </div>

      {/* Question Breakdown */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Detailed Breakdown</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {quiz.questions.map((q, idx) => {
            const userAnswer = result.answers.find(a => a.questionId === q.id);
            const isCorrect = userAnswer?.isCorrect;
            
            return (
              <div key={q.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                    isCorrect ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                    {isCorrect ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="font-medium text-slate-200">{idx + 1}. {q.text}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className={`p-3 rounded-lg border ${
                        isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                      }`}>
                         <span className="text-xs uppercase opacity-70 block mb-1">Your Answer</span>
                         <span className={isCorrect ? 'text-emerald-300' : 'text-red-300'}>
                            {q.options[userAnswer!.selectedOptionIndex]}
                         </span>
                      </div>
                      
                      {!isCorrect && (
                         <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                            <span className="text-xs uppercase opacity-70 block mb-1">Correct Answer</span>
                            <span className="text-emerald-300">{q.options[q.correctAnswerIndex]}</span>
                         </div>
                      )}
                    </div>
                    
                    <div className="mt-2 text-sm text-slate-400 italic border-l-2 border-slate-600 pl-3">
                      Explanation: {q.explanation}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 pb-12">
        <Button variant="secondary" onClick={onHome} icon={<Home className="w-4 h-4"/>}>
          Back to Dashboard
        </Button>
        <Button onClick={onRetry} icon={<RotateCcw className="w-4 h-4"/>}>
          New Quiz on {quiz.topic}
        </Button>
      </div>
    </div>
  );
};
