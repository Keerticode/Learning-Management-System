 import mongoose from 'mongoose';

import { computeProgress } from '../utils/computeProgress.js';

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedLessons: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
      default: [],
    },
    lastAccessedLesson: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    certificateIssuedAt: {
      type: Date,
      default: null,
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Race-safe guarantee that a (user, course) pair can only enroll once.
// Application-level checks would still allow duplicates under concurrent
// POSTs; the database is the only layer that prevents that.
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Common dashboard query: list a user's enrollments newest-first.
enrollmentSchema.index({ userId: 1, enrolledAt: -1 });

/**
 * Recompute `progressPercent` and stamp `completedAt` whenever the
 * lesson set changes. Doing this in a hook (rather than only in the
 * controller) means scripts, seeders, and admin tools that mutate
 * `completedLessons` directly still produce correct denormalized state.
 *
 * The course's `totalLessons` counter is the canonical denominator: it
 * is already kept fresh by the Lesson model's post-save / post-delete
 * hooks, so we don't need a live `Lesson.countDocuments` round-trip.
 */
enrollmentSchema.pre('save', async function () {
  if (this.isNew && !this.enrolledAt) {
    this.enrolledAt = new Date();
  }

  if (!this.isNew && !this.isModified('completedLessons')) return;

  const Course = mongoose.models.Course;
  if (!Course) return;

  const course = await Course.findById(this.courseId, 'totalLessons').lean();
  const totalLessons = course?.totalLessons ?? 0;

  const { percent, isComplete } = computeProgress(
    this.completedLessons?.length ?? 0,
    totalLessons,
  );

  this.progressPercent = percent;

  if (isComplete && !this.completedAt) {
    this.completedAt = new Date();
  } else if (!isComplete && this.completedAt) {
    // Lesson removed (e.g. instructor deleted it) — drop the stale stamp
    // so the certificate flow doesn't re-fire on the next 100%.
    this.completedAt = null;
  }
});

/**
 * Keep `Course.enrollmentCount` in sync. New documents bump the
 * counter; deletions decrement it. We resolve `Course` lazily through
 * `mongoose.models` so isolated unit tests that load only the
 * Enrollment model don't crash on startup.
 */
enrollmentSchema.pre('save', function () {
  this.$locals.wasNew = this.isNew;
});

enrollmentSchema.post('save', async function (doc) {
  if (!doc.$locals?.wasNew) return;

  const Course = mongoose.models.Course;
  if (!Course) return;

  await Course.updateOne({ _id: doc.courseId }, { $inc: { enrollmentCount: 1 } });
});

const cascadeOnDelete = async (doc) => {
  if (!doc) return;

  const Course = mongoose.models.Course;
  if (!Course) return;

  await Course.updateOne({ _id: doc.courseId }, { $inc: { enrollmentCount: -1 } });
};

enrollmentSchema.post('deleteOne', { document: true, query: false }, async function () {
  await cascadeOnDelete(this);
});

enrollmentSchema.post('findOneAndDelete', async function (doc) {
  await cascadeOnDelete(doc);
});

export const Enrollment =
  mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);

export default Enrollment;
