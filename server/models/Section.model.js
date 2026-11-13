import mongoose from 'mongoose';

const { Schema } = mongoose;

const sectionSchema = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    order: {
      type: Number,
      required: [true, 'Order is required'],
      min: [0, 'Order cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Guarantees deterministic chapter ordering per course and prevents two
// sections from racing into the same slot on concurrent inserts.
sectionSchema.index({ courseId: 1, order: 1 }, { unique: true });

// Lessons live in a sibling collection. Surfacing them as a virtual keeps
// `section.populate('lessons')` ergonomic without hard-coding the sort
// order in every controller.
sectionSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'sectionId',
  options: { sort: { order: 1 } },
});

export const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema);

export default Section;
