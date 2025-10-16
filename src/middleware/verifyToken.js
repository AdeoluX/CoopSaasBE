const httpStatus = require("http-status");
const { abortIf } = require("../utils/responder");
const { verifyToken } = require("../utils/tokenManagement");

const verify = (role) => {
  return (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    abortIf(!token || token == "", httpStatus.FORBIDDEN, "You shall not pass");
    const data = verifyToken(token);
    abortIf(!data, httpStatus.FORBIDDEN, "You shall not pass");
    abortIf(
      !data.role || (!data.role.includes(role) && role !== "*"),
      httpStatus.FORBIDDEN,
      "You shall not pass"
    );
    req.auth = data;
    // req.auth.routeRole = role || 'user'
    next();
  };
};

const verifyAdmin = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  abortIf(!token || token == "", httpStatus.FORBIDDEN, "You shall not pass");
  const data = verifyToken(token);
  abortIf(!data, httpStatus.FORBIDDEN, "You shall not pass");
  abortIf(
    !data.role || data.role !== "admin" || !data.cooperative,
    httpStatus.FORBIDDEN,
    "You shall not pass"
  );
  req.auth = data;
  next();
};

module.exports = {
  verify,
  verifyAdmin,
};
