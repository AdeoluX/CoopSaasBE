const Joi = require("joi");

const bankValidators = {
  // Validation for resolving bank account
  resolveBankAccountValidator: Joi.object({
    accountNumber: Joi.string()
      .pattern(/^[0-9]{10,11}$/)
      .required()
      .messages({
        "string.pattern.base": "Account number must be 10-11 digits",
        "any.required": "Account number is required",
      }),
    bankCode: Joi.string().min(3).max(10).required().messages({
      "string.min": "Bank code must be at least 3 characters",
      "string.max": "Bank code must not exceed 10 characters",
      "any.required": "Bank code is required",
    }),
  }),

  // Validation for adding/updating bank account
  addBankAccountValidator: Joi.object({
    bankCode: Joi.string().min(3).max(10).required().messages({
      "string.min": "Bank code must be at least 3 characters",
      "string.max": "Bank code must not exceed 10 characters",
      "any.required": "Bank code is required",
    }),
    bankName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Bank name must be at least 2 characters",
      "string.max": "Bank name must not exceed 100 characters",
      "any.required": "Bank name is required",
    }),
    accountNumber: Joi.string()
      .pattern(/^[0-9]{10,11}$/)
      .required()
      .messages({
        "string.pattern.base": "Account number must be 10-11 digits",
        "any.required": "Account number is required",
      }),
    nameOnAccount: Joi.string().min(2).max(100).required().messages({
      "string.min": "Account name must be at least 2 characters",
      "string.max": "Account name must not exceed 100 characters",
      "any.required": "Account name is required",
    }),
  }),

  // Validation for query parameters (optional)
  bankQueryValidator: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

module.exports = bankValidators;

