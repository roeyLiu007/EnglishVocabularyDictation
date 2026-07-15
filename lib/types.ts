export type PromptType = "audio" | "english" | "chinese";
export type PromptTypeWeights = Record<PromptType, number>;
export type RoomStatus = "active" | "completed" | "recorded" | "closed";
export type FieldName = "word" | "partOfSpeech" | "meaning";
export type FieldStatus = "correct" | "wrong" | "pending";

export type WordStats = {
  wrongCount: number;
  correctCount: number;
  fieldWrongCounts: Partial<Record<FieldName, number>>;
  lastWrongAt?: string;
  lastTestedAt?: string;
  consecutiveCorrect: number;
  proficiency?: "new" | "learning" | "review" | "mastered";
  nextReviewAt?: string;
  reviewIntervalDays?: number;
  mistakePeople?: Record<string, number>;
};

export type WordEntry = {
  id: string;
  entryType?: "word" | "phrase";
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  meaning: string;
  unit?: string;
  tags?: string[];
  notes?: string;
  stages?: string[];
  source?: "base" | "upload" | "custom";
  uploadBatchId?: string;
  uploadBatchName?: string;
  stats: WordStats;
  createdAt: string;
};

export type AnswerLine = {
  partOfSpeech: string;
  meaning: string;
};

export type Question = {
  id: string;
  wordId: string;
  entryType?: "word" | "phrase";
  promptType: PromptType;
  prompt: string;
  speechText?: string;
  targetFields: FieldName[];
  manualMistakeRecording?: boolean;
  dictationPerson?: string;
  answer: {
    entryType?: "word" | "phrase";
    word: string;
    partOfSpeech: string;
    meaning: string;
    lines?: AnswerLine[];
  };
};

export type DictationRoom = {
  id: string;
  parentToken: string;
  childToken: string;
  status: RoomStatus;
  totalCount: number;
  mistakeRatio: number;
  wordSource?: "all" | "stage" | "latestUpload";
  stage?: string;
  questionMode: "mixed" | "custom";
  promptTypeWeights?: PromptTypeWeights;
  dictationPerson?: string;
  questions: Question[];
  createdAt: string;
};

export type RoomTaskSummary = {
  id: string;
  status: RoomStatus;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  pendingCount: number;
  wordSource: DictationRoom["wordSource"];
  stage?: string;
  dictationPerson?: string;
  createdAt: string;
  lastSubmittedAt?: string;
  parentUrl: string;
  childUrl: string;
};

export type AnswerInput = {
  word?: string;
  partOfSpeech?: string;
  meaning?: string;
  lines?: AnswerLine[];
};

export type FieldVerdict = {
  status: FieldStatus;
  expected: string;
  received: string;
  note?: string;
};

export type AnswerVerdict = {
  overall: FieldStatus;
  fields: Partial<Record<FieldName, FieldVerdict>>;
};

export type SubmittedAnswer = {
  roomId: string;
  questionId: string;
  answer: AnswerInput;
  verdict: AnswerVerdict;
  durationSeconds?: number;
  submittedAt: string;
};

export type CreateRoomInput = {
  totalCount: number;
  mistakeRatio: number;
  wordSource?: "all" | "stage" | "latestUpload";
  stage?: string;
  promptTypeWeights?: PromptTypeWeights;
  dictationPerson?: string;
};

export type ImportPreviewWord = Pick<
  WordEntry,
  "entryType" | "word" | "phonetic" | "partOfSpeech" | "meaning" | "unit" | "tags" | "notes" | "stages"
>;
