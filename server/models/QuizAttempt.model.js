import mongoose from 'mongoose';

const { Schema } = mongoose;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

const quizAttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    quizId: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required'],
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    answers: {
      type: [Number],
      required: [true, 'Answers are required'],
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length > 0 && value.every((n) => Number.isInteger(n)),
        message: 'Answers must be a non-empty array of integer option indices.',
      },
    },
    score: {
      type: Number,
      required: true,
      default: 0,
      min: [SCORE_MIN, `Score cannot be below ${SCORE_MIN}`],
      max: [SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`],
    },
    correctCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Correct count cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Correct count must be an integer.',
      },
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total questions cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Total questions must be an integer.',
      },
    },
    passed: {
      type: Boolean,
      required: true,
      default: false,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: [0, 'Time spent cannot be negative'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Time spent must be an integer number of seconds.',
      },
    },
   
    tabSwitches: {
      type: Number,
      default: 0,
      min: [0, 'Tab switch count cannot be negative'],
      max: [9999, 'Tab switch count looks bogus (> 9999) — likely a forged payload.'],
      validate: {
        validator: (value) => Number.isInteger(value),
        message: 'Tab switch count must be an integer.',
      },
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

quizAttemptSchema.index({ userId: 1, quizId: 1, attemptedAt: -1 });

quizAttemptSchema.index({ userId: 1, quizId: 1, score: -1 });


quizAttemptSchema.pre('validate', async function () {
  if (!this.isNew && !this.isModified('answers')) return;

  const Quiz = mongoose.models.Quiz;
  if (!Quiz) {
    throw new Error('Quiz model is not registered — cannot score attempt.');
  }

  const quiz = await Quiz.findById(this.quizId, 'questions passingScore timeLimitSeconds courseId').lean();
  if (!quiz) {
    throw new Error('Quiz not found — cannot score attempt.');
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;
  const answers = Array.isArray(this.answers) ? this.answers : [];

  if (answers.length !== totalQuestions) {
    throw new Error(
      `Answer count (${answers.length}) does not match question count (${totalQuestions}).`,
    );
  }

  let correctCount = 0;
  for (let i = 0; i < totalQuestions; i += 1) {
    const submitted = answers[i];
    const optionCount = Array.isArray(questions[i]?.options) ? questions[i].options.length : 0;

    if (
      Number.isInteger(submitted) &&
      submitted >= 0 &&
      submitted < optionCount &&
      submitted === questions[i].correctIndex
    ) {
      correctCount += 1;
    }
  }

  const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);

  this.totalQuestions = totalQuestions;
  this.correctCount = correctCount;
  this.score = score;
  this.passed = score >= quiz.passingScore;

  if (quiz.timeLimitSeconds > 0) {
    const reported = Number.isInteger(this.timeSpentSeconds) ? this.timeSpentSeconds : 0;
    this.timeSpentSeconds = Math.max(0, Math.min(reported, quiz.timeLimitSeconds));
  } else if (!Number.isInteger(this.timeSpentSeconds) || this.timeSpentSeconds < 0) {
    this.timeSpentSeconds = 0;
  }

  if (quiz.courseId) {
    this.courseId = quiz.courseId;
  }

  if (this.isNew && !this.attemptedAt) {
    this.attemptedAt = new Date();
  }
});

export const QUIZ_ATTEMPT_SCORE_MIN = SCORE_MIN;
export const QUIZ_ATTEMPT_SCORE_MAX = SCORE_MAX;

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);

export default QuizAttempt;
