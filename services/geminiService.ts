import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Quiz, QuizResult } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "The question text" },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 4 possible answers"
          },
          correctAnswerIndex: { type: Type.INTEGER, description: "0-based index of the correct option" },
          explanation: { type: Type.STRING, description: "Brief explanation of why the answer is correct" }
        },
        required: ["id", "text", "options", "correctAnswerIndex", "explanation"]
      }
    }
  },
  required: ["questions"]
};

export const generateQuiz = async (topic: string, difficulty: Difficulty): Promise<Quiz> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `Create a challenging technical quiz about "${topic}".
  Difficulty Level: ${difficulty}.
  Generate exactly 5 multiple-choice questions.
  Ensure the questions are suitable for a ${difficulty} level software engineer or DevOps professional.
  The output must be valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUIZ_SCHEMA,
        systemInstruction: "You are a senior technical interviewer creating rigorous test questions.",
        temperature: 0.7, 
      }
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini.");
    }

    const data = JSON.parse(response.text);
    
    return {
      id: crypto.randomUUID(),
      topic,
      difficulty,
      questions: data.questions,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Gemini Quiz Generation Error:", error);
    throw error;
  }
};

export const analyzePerformance = async (result: QuizResult, quiz: Quiz): Promise<string> => {
  const model = "gemini-2.5-flash";

  // Construct a summary of performance
  const summary = result.answers.map(ans => {
    const q = quiz.questions.find(q => q.id === ans.questionId);
    return `Question: ${q?.text}
    User Answer: ${q?.options[ans.selectedOptionIndex]}
    Correct: ${ans.isCorrect ? "Yes" : "No"}
    `;
  }).join("\n");

  const prompt = `Analyze this quiz performance for the topic "${quiz.topic}".
  Score: ${result.score}/${result.totalQuestions}.
  
  Details:
  ${summary}
  
  Provide a brief, encouraging, but technical 3-sentence summary of their knowledge gaps or strengths. 
  Address the user directly as "You".`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "Could not generate AI analysis at this time.";
  }
};
