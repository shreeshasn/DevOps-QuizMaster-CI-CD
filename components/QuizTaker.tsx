import React, { useState } from 'react';
import { Quiz } from '../types';
import { Button } from './Button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface QuizTakerProps {
  quiz: Quiz;
  onComplete: (answers: { questionId: number; selectedOptionIndex: number; isCorrect: boolean }[]) => void;
}

export const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ questionId: number; selectedOptionIndex: number; isCorrect: boolean }[]>([]);

  const currentQuestion = quiz.questions[currentIdx];
  const progress = ((currentIdx + 1) / quiz.questions.length) * 100;

  const handleNext = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === currentQuestion.correctAnswerIndex;
    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        selectedOptionIndex: selectedOption,
        isCorrect
      }
    ];

    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Question {currentIdx + 1} of {quiz.questions.length}</span>
          <span>{quiz.topic} • {quiz.difficulty}</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <h2 className="text-2xl font-semibold text-white mb-8 leading-relaxed relative z-10">
          {currentQuestion.text}
        </h2>

        <div className="space-y-3 relative z-10">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedOption(idx)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center group ${
                selectedOption === idx
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors ${
                selectedOption === idx ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600 group-hover:border-slate-500'
              }`}>
                {selectedOption === idx && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-lg">{option}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleNext} 
            disabled={selectedOption === null}
            className="w-full md:w-auto"
            icon={currentIdx === quiz.questions.length - 1 ? <CheckCircle2 className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          >
            {currentIdx === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </Button>
        </div>
      </div>
    </div>
  );
};
