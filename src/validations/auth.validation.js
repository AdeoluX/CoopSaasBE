const Joi = require("joi");

const signUpValidator = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().min(7),
    confirmPassword: Joi.string().required().min(7),
    name: Joi.string().required(),
  }),
};

const signInValidator = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().min(7),
  }),
};

const verifyEmailValidator = {
  body: Joi.object().keys({
    otp: Joi.string().required(),
    id: Joi.string().required(),
  }),
};

module.exports = {
  signUpValidator,
  signInValidator,
  verifyEmailValidator,
};
