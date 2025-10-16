const mongoose = require('mongoose');


const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  attachmentType: {
    type: String,
    required: true,
    enum: ['asset', 'docs'], // Add other types as needed
  },
  // asset_id: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Asset',
  //   required: true
  // },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Attachment = mongoose.model('Attachment', attachmentSchema);

module.exports = Attachment