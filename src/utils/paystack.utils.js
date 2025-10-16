const { axiosPOST, axiosGET, axiosPUT } = require("./request");

// Paystack API base URL
const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Initiate a Paystack transaction
 * @param {Object} params - Transaction parameters
 * @param {number} params.amount - Amount in kobo (multiply by 100)
 * @param {string} params.email - Customer email
 * @param {string} params.reference - Unique transaction reference
 * @param {string} params.callback_url - Callback URL after payment
 * @param {Object} params.metadata - Additional metadata
 * @returns {Object} Transaction initialization response
 */
const initiateTransaction = async ({
  amount,
  email,
  reference,
  callback_url,
  metadata = {},
}) => {
  try {
    const data = {
      amount: amount * 100, // Convert to kobo
      email,
      reference,
      callback_url,
      metadata,
      currency: "NGN",
    };

    const response = await axiosPOST(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      data,
      {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    );

    return {
      success: true,
      data: response.data,
      authorization_url: response.data.authorization_url,
      access_code: response.data.access_code,
      reference: response.data.reference,
    };
  } catch (error) {
    console.error(
      "Paystack transaction initiation error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Verify a Paystack transaction
 * @param {string} reference - Transaction reference to verify
 * @returns {Object} Transaction verification response
 */
const verifyTransaction = async (reference) => {
  try {
    const response = await axiosGET(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    );

    const transaction = response.data;

    return {
      success: true,
      data: transaction,
      status: transaction.status,
      amount: transaction.amount / 100, // Convert from kobo to naira
      reference: transaction.reference,
      gateway_response: transaction.gateway_response,
      channel: transaction.channel,
      paid_at: transaction.paid_at,
      customer: transaction.customer,
      metadata: transaction.metadata,
    };
  } catch (error) {
    console.error(
      "Paystack transaction verification error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Resolve bank account details
 * @param {string} account_number - Bank account number
 * @param {string} bank_code - Bank code (from getBanks list)
 * @returns {Object} Bank account resolution response
 */
const resolveBankAccount = async (account_number, bank_code) => {
  try {
    const response = await axiosGET(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    );

    // Check if the response has the expected structure
    if (!response.data || !response.data.data) {
      return {
        success: false,
        error: "Invalid response from bank resolution service",
        status: 500,
      };
    }

    const bankData = response.data;

    // Check if required fields exist
    if (
      !bankData.account_name ||
      !bankData.account_number ||
      !bankData.bank_id
    ) {
      return {
        success: false,
        error: "Incomplete bank account information received",
        status: 500,
      };
    }

    return {
      success: true,
      data: response.data,
      account_name: bankData.account_name,
      account_number: bankData.account_number,
      bank_id: bankData.bank_id,
    };
  } catch (error) {
    console.error(
      "Paystack bank resolution error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Get list of banks
 * @returns {Object} List of banks
 */
const getBanks = async () => {
  try {
    const response = await axiosGET(`${PAYSTACK_BASE_URL}/bank`, {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    });

    return {
      success: true,
      data: response.data,
      banks: response.data.data,
    };
  } catch (error) {
    console.error(
      "Paystack get banks error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Transfer to bank account
 * @param {Object} params - Transfer parameters
 * @param {number} params.amount - Amount in kobo
 * @param {string} params.recipient - Recipient code (from createRecipient)
 * @param {string} params.reason - Transfer reason
 * @returns {Object} Transfer response
 */
const transferToBank = async ({ amount, recipient, reason }) => {
  try {
    const data = {
      source: "balance",
      amount: amount * 100, // Convert to kobo
      recipient,
      reason,
    };

    const response = await axiosPOST(`${PAYSTACK_BASE_URL}/transfer`, data, {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    });

    return {
      success: true,
      data: response.data,
      transfer_code: response.data.data.transfer_code,
      reference: response.data.data.reference,
      status: response.data.data.status,
    };
  } catch (error) {
    console.error(
      "Paystack transfer error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Create transfer recipient
 * @param {Object} params - Recipient parameters
 * @param {string} params.type - Recipient type (nuban, mobile_money, etc.)
 * @param {string} params.name - Recipient name
 * @param {string} params.account_number - Account number
 * @param {string} params.bank_code - Bank code
 * @returns {Object} Recipient creation response
 */
const createRecipient = async ({ type, name, account_number, bank_code }) => {
  try {
    const data = {
      type,
      name,
      account_number,
      bank_code,
      currency: "NGN",
    };

    const response = await axiosPOST(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      data,
      {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    );

    return {
      success: true,
      data: response.data,
      recipient_code: response.data.data.recipient_code,
      account_number: response.data.data.details.account_number,
      account_name: response.data.data.details.account_name,
    };
  } catch (error) {
    console.error(
      "Paystack create recipient error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Create a Paystack subaccount
 * @param {Object} params - Subaccount parameters
 * @param {string} params.business_name - Business name
 * @param {string} params.settlement_bank - Settlement bank code
 * @param {string} params.account_number - Settlement account number
 * @param {string} params.account_name - Settlement account name
 * @param {string} params.percentage_charge - Percentage charge (optional)
 * @param {string} params.description - Description (optional)
 * @param {string} params.primary_contact_email - Primary contact email (optional)
 * @param {string} params.primary_contact_name - Primary contact name (optional)
 * @param {string} params.primary_contact_phone - Primary contact phone (optional)
 * @param {string} params.metadata - Additional metadata (optional)
 * @returns {Object} Subaccount creation response
 */
const createSubAccount = async ({
  business_name,
  settlement_bank,
  account_number,
  account_name,
  percentage_charge = "0",
  description = "",
  primary_contact_email = "",
  primary_contact_name = "",
  primary_contact_phone = "",
  metadata = {},
}) => {
  try {
    const data = {
      business_name,
      settlement_bank,
      account_number,
      account_name,
      percentage_charge,
      description,
      primary_contact_email,
      primary_contact_name,
      primary_contact_phone,
      metadata,
    };

    const response = await axiosPOST(`${PAYSTACK_BASE_URL}/subaccount`, data, {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    });

    return {
      success: true,
      data: response.data,
      subaccount_code: response.data.data.subaccount_code,
      business_name: response.data.data.business_name,
      settlement_bank: response.data.data.settlement_bank,
      account_number: response.data.data.account_number,
      account_name: response.data.data.account_name,
      percentage_charge: response.data.data.percentage_charge,
      is_verified: response.data.data.is_verified,
      active: response.data.data.active,
    };
  } catch (error) {
    console.error(
      "Paystack create subaccount error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Get all subaccounts
 * @param {Object} params - Query parameters
 * @param {number} params.perPage - Number of records per page (default: 50)
 * @param {number} params.page - Page number (default: 1)
 * @param {boolean} params.active - Filter by active status (optional)
 * @returns {Object} List of subaccounts
 */
const getSubAccounts = async ({ perPage = 50, page = 1, active = null }) => {
  try {
    let url = `${PAYSTACK_BASE_URL}/subaccount?perPage=${perPage}&page=${page}`;
    if (active !== null) {
      url += `&active=${active}`;
    }

    const response = await axiosGET(url, {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    });

    return {
      success: true,
      data: response.data,
      subaccounts: response.data.data,
      meta: response.data.meta,
    };
  } catch (error) {
    console.error(
      "Paystack get subaccounts error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Update a subaccount
 * @param {string} subaccount_code - Subaccount code to update
 * @param {Object} params - Update parameters
 * @param {string} params.business_name - Business name (optional)
 * @param {string} params.settlement_bank - Settlement bank code (optional)
 * @param {string} params.account_number - Settlement account number (optional)
 * @param {string} params.account_name - Settlement account name (optional)
 * @param {string} params.percentage_charge - Percentage charge (optional)
 * @param {string} params.description - Description (optional)
 * @param {string} params.primary_contact_email - Primary contact email (optional)
 * @param {string} params.primary_contact_name - Primary contact name (optional)
 * @param {string} params.primary_contact_phone - Primary contact phone (optional)
 * @param {string} params.metadata - Additional metadata (optional)
 * @returns {Object} Subaccount update response
 */
const updateSubAccount = async (subaccount_code, updateData) => {
  try {
    const response = await axiosPUT(
      `${PAYSTACK_BASE_URL}/subaccount/${subaccount_code}`,
      updateData,
      {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      }
    );

    return {
      success: true,
      data: response.data,
      subaccount_code: response.data.data.subaccount_code,
      business_name: response.data.data.business_name,
      settlement_bank: response.data.data.settlement_bank,
      account_number: response.data.data.account_number,
      account_name: response.data.data.account_name,
      percentage_charge: response.data.data.percentage_charge,
      is_verified: response.data.data.is_verified,
      active: response.data.data.active,
    };
  } catch (error) {
    console.error(
      "Paystack update subaccount error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    };
  }
};

module.exports = {
  initiateTransaction,
  verifyTransaction,
  resolveBankAccount,
  getBanks,
  transferToBank,
  createRecipient,
  createSubAccount,
  getSubAccounts,
  updateSubAccount,
};
