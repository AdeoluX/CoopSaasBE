const httpStatus = require("http-status");
const { generateToken } = require("../utils/tokenManagement");
const { abortIf } = require("../utils/responder");
const { otpGenerator } = require("../utils/utils.utils");
const sendEmail = require("../utils/email.util");
const CooperativeRepo = require("../repo/cooperative.repo");
const MemberRepo = require("../repo/member.repo");
const OtpRepo = require("../repo/otp.repo");
const WalletRepo = require("../repo/wallet.repo");
const slugify = (name) =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

const userSignUp = async ({ email, password, confirmPassword, name }) => {
  const findCooperative = await CooperativeRepo.findOne({
    query: {
      "auth_credentials.email": email,
    },
  });
  abortIf(
    findCooperative,
    httpStatus.BAD_REQUEST,
    "Cooperative already exists"
  );
  abortIf(
    password !== confirmPassword,
    httpStatus.BAD_REQUEST,
    "Passwords do not match"
  );
  // Generate unique slug
  let baseSlug = slugify(name);
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (
    await CooperativeRepo.findOne({
      query: { slug: uniqueSlug },
    })
  ) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const createCooperative = await CooperativeRepo.create({
    name,
    slug: uniqueSlug,
    "auth_credentials.email": email,
    "auth_credentials.password": password,
  });
  const token = generateToken({ id: createCooperative._id, cooperative: true });
  return {
    ...createCooperative.toJSON(),
    token,
    cooperative: true,
  };
};

const searchCooperative = async ({ search }) => {
  const cooperative = await CooperativeRepo.findOne({
    query: {
      "auth_credentials.email": search,
    },
  });
  abortIf(!cooperative, httpStatus.BAD_REQUEST, "Cooperative not found");
  return cooperative;
};

const login = async ({ email, password, org_id }) => {
  let client, tenant;
  if (org_id) {
    client = await MemberRepo.findOne({
      query: {
        email,
        cooperativeId: org_id,
      },
      select: "+password",
    });
    // Fallback: if no member, try cooperative admin on the same tenant
    if (!client) {
      // Try cooperative by email (global search)
      const coopByEmail = await CooperativeRepo.findOne({
        query: { "auth_credentials.email": email },
      });
      abortIf(
        !coopByEmail,
        httpStatus.BAD_REQUEST,
        "Member not found and cooperative not found"
      );
      // Ensure the cooperative found by email matches the tenant slug/org_id
      abortIf(
        String(coopByEmail._id) !== String(org_id),
        httpStatus.BAD_REQUEST,
        "Cooperative email belongs to another tenant"
      );
      coopByEmail.cooperative = true;
      coopByEmail.role = "admin";
      tenant = coopByEmail;
    }
  } else {
    tenant = await CooperativeRepo.findOne({
      query: {
        "auth_credentials.email": email,
      },
    });
    abortIf(!tenant, httpStatus.BAD_REQUEST, "Cooperative not found");
    tenant.cooperative = true;
    tenant.role = "admin";
  }
  abortIf(
    !email || !password,
    httpStatus.BAD_REQUEST,
    "Please provide an email or a password"
  );
  abortIf(
    !client && !tenant,
    httpStatus.BAD_REQUEST,
    "email or password is wrong"
  );

  // Use model's comparePassword method
  let isPasswordValid;
  if (client) {
    isPasswordValid = await client.comparePassword(password);
  }
  if (tenant) {
    isPasswordValid = await tenant.comparePassword(password);
  }

  abortIf(
    !isPasswordValid,
    httpStatus.BAD_REQUEST,
    "email or password is wrong"
  );

  const user_data = client?.toJSON() || tenant?.toJSON(); // This will automatically remove sensitive data
  // abortIf(
  //   user_data.emailStatus === "unverified",
  //   httpStatus.BAD_REQUEST,

  //   "Please verify your email."
  // );

  const token = generateToken({
    id: client?._id || tenant?._id,
    cooperative: client?.cooperative || tenant?._id,
    // Ensure cooperativeId is always present: for members use their cooperativeId; for admins use tenant (cooperative) id
    cooperativeId: client?.cooperativeId || tenant?._id,
    role: client?.role || tenant?.role,
  });

  const userData = client?.toJSON() || tenant?.toJSON();
  const cooperative = client?.cooperative || tenant?.cooperative;

  // Check if member has no cooperative or cooperative is false/null
  const shouldRedirectToMemberDashboard =
    client && (!cooperative || cooperative === false || cooperative === null);

  return {
    ...userData,
    ...token,
    cooperative: cooperative,
    // Add flag to indicate if member should be redirected to member dashboard
    redirectToMemberDashboard: shouldRedirectToMemberDashboard,
  };
};

const activateAccount = async ({ id, otp }) => {
  let member;
  const token = await OtpRepo.findOne({
    query: {
      member: id,
      used: false,
      otp,
    },
  });
  abortIf(!token, httpStatus.BAD_REQUEST, "Invalid Otp");
  if (token.otp !== otp) {
    await OtpRepo.update(id, {
      used: true,
    });
    abortIf(true, httpStatus.BAD_REQUEST, "Invalid Otp");
  }
  if (token.otp === otp) {
    member = await MemberRepo.update(token.member, {
      emailStatus: "verified",
    });
    await OtpRepo.update(id, {
      used: true,
    });
  }
  const createWallet = await WalletRepo.create({
    member: id,
    currency: "NGN",
  });
  member.wallets.push(createWallet._id);
  await member.save();
  return {
    message: "Successful",
    user: member,
  };
};

const authenticate2FA = async ({ otp, email }) => {
  //find the User2FA
  const getUser = (
    await MemberRepo.findOne({
      query: { email },
    })
  ).toJSON();
  const twoFA = await OtpRepo.findOne({
    query: {
      otp,
      member: getUser._id,
      used: false,
    },
  });
  abortIf(
    !twoFA,
    httpStatus.BAD_REQUEST,
    "OTP has expired. Please Login again."
  );
  const token = generateToken({
    id: getUser._id,
    role: getUser.role,
    email,
  });
  await OtpRepo.update(twoFA._id, {
    used: true,
  });

  return {
    ...getUser,
    ...token,
  };
};

module.exports = {
  login,
  userSignUp,
  activateAccount,
  authenticate2FA,
  searchCooperative,
};
