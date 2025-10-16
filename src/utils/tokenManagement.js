require("dotenv").config();
const jwt = require("jsonwebtoken");
const { token_secret } = require("../../keys");

const generateToken = (data) => {
  const access_token = jwt.sign(data, token_secret, {
    expiresIn: "6h",
  });
  const refresh_token = jwt.sign(data, token_secret, {
    expiresIn: "1d",
  });
  return {
    access_token,
    refresh_token,
  };
};

const generateAdminToken = (data) => {
  const access_token = jwt.sign(data, token_secret, {
    expiresIn: "6h",
  });
  const refresh_token = jwt.sign(data, token_secret, {
    expiresIn: "1d",
  });
  return {
    access_token,
    refresh_token,
  };
};

const verifyToken = (token) => {
  try {
    const data = jwt.verify(token, token_secret);
    return data;
  } catch (error) {
    // Return null for any JWT verification errors
    // This will be caught by abortIf(!data, ...) in the middleware
    return null;
  }
};

module.exports = {
  generateToken,
  generateAdminToken,
  verifyToken,
};
