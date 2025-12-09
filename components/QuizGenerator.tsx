import React, { useState } from 'react';
import { BrainCircuit, Sparkles, Terminal } from 'lucide-react';
import { Difficulty } from '../types';
import { Button } from './Button';

interface QuizGeneratorProps {
  onGenerate: (topic: string, difficulty: Difficulty) => void;
  isGenerating: boolean;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({ onGenerate, isGenerating }) => {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Intermediate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onGenerate(topic, difficulty);
    }
  };

  const suggestions = [
    "Kubernetes Pod Lifecycle",
    "Docker Multi-stage Builds",
    "Jenkins Groovy Pipelines",
    "Terraform State Management",
    "Git Branching Strategies"
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4">
          <BrainCircuit className="w-12 h-12 text-indigo-400" />
        </div>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          DevOps QuizMaster
        </h1>
        <p className="text-slate-400 text-lg">
          Generate AI-powered quizzes to validate your pipeline knowledge.
        </p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Quiz Topic</label>
            <div className="relative">
              <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Kubernetes Networking"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Difficulty Level</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.values(Difficulty).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    difficulty === diff
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400/50'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full text-lg h-14" 
            isLoading={isGenerating}
            disabled={!topic.trim()}
            icon={<Sparkles className="w-5 h-5" />}
          >
            {isGenerating ? 'Generating Quiz...' : 'Generate Quiz'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Popular Topics</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-slate-600/50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
