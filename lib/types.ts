export type PromptType = "audio" | "english" | "chinese";
export type RoomStatus = "active" | "completed";
export type FieldName = "word" | "partOfSpeech" | "meaning";
export type FieldStatus = "correct" | "wrong" | "pending";

export type WordStats = {
  wrongCount: number;
  correctCount: number;
  fieldWrongCounts: Partial<Record<FieldName, number>>;
  lastWrongAt?: string;
  lastTestedAt?: string;
  consecutiveCorrect: number;
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
  questionMode: "mixed";
  questions: Question[];
  createdAt: string;
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
  submittedAt: string;
};

export type CreateRoomInput = {
  totalCount: number;
  mistakeRatio: number;
  wordSource?: "all" | "stage" | "latestUpload";
  stage?: string;
};

export type ImportPreviewWord = Pick<
  WordEntry,
  "entryType" | "word" | "phonetic" | "partOfSpeech" | "meaning" | "unit" | "tags" | "notes" | "stages"
>;
