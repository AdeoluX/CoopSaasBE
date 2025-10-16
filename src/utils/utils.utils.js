const { Members, Otp } = require("../models");
function generateRandomString(length, type = "alpha") {
  let characters = "";
  if (type === "alpha" || type === "alpha-numeric") {
    characters =
      characters + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  }
  if (type === "numeric" || type === "alpha-numeric") {
    characters = characters + "1234567890";
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

const paginateOptions = (req) => {
  const page = req?.query.page || 1;
  const perPage = req?.query.perPage || 15;
  return {
    page,
    limit: perPage,
    offset: (page - 1) * perPage,
  };
};

const otpGenerator = async ({ member: { _id } }) => {
  const otp = generateRandomString(6, "numeric");
  // console.log(_id._id)
  //log on otp table
  const otpInstance = new Otp({
    member: _id,
    otp,
  });
  // Save the OTP to the database
  const savedOTP = await otpInstance.save();
  let members = await Members.findById(_id);
  members.otps = [savedOTP._id];
  await members.save();
  return { otp, otpInstance };
};

module.exports = { generateRandomString, paginateOptions, otpGenerator };
