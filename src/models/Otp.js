const mongoose = require('mongoose');

const { Schema } = mongoose;

const OtpSchema = new Schema({
    member: {
        type: Schema.Types.ObjectId,
        ref: 'Member',
        required: true
      },
    otp: {
        type: String,
    },
    used: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
    },
);

const Otp = mongoose.model('Otp', OtpSchema);

module.exports = Otp;