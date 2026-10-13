import mongoose from 'mongoose';

export const SCAN_STATUSES = Object.freeze(['queued', 'running', 'completed', 'failed']);

const checkSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    status: { type: String, enum: ['pass', 'warn', 'fail'] },
    points: Number,
    maxPoints: Number,
    value: String,
    message: String,
    fix: String,
  },
  { _id: false },
);

const scanSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, maxlength: 2048 },
    // Canonical form used for caching and history lookups.
    key: { type: String, required: true, maxlength: 2048 },
    hostname: { type: String, required: true },
    status: { type: String, enum: SCAN_STATUSES, default: 'queued' },
    grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F', null], default: null },
    score: { type: Number, default: null },
    checks: { type: [checkSchema], default: [] },
    finalUrl: String,
    statusCode: Number,
    redirects: { type: [{ url: String, statusCode: Number, _id: false }], default: [] },
    httpsAvailable: Boolean,
    httpRedirectsToHttps: { type: Boolean, default: null },
    httpsError: String,
    headers: { type: Map, of: String },
    error: String,
    durationMs: Number,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

scanSchema.index({ key: 1, createdAt: -1 });
scanSchema.index({ createdAt: -1 });

scanSchema.set('toJSON', {
  versionKey: false,
  flattenMaps: true,
  transform: (doc, ret) => {
    const { _id, ...rest } = ret;
    return { id: _id.toString(), ...rest };
  },
});

export default mongoose.model('Scan', scanSchema);
