const httpStatus = require("http-status");
const { abortIf } = require("../utils/responder");
const BankRepo = require("../repo/bank.repo");
const MemberRepo = require("../repo/member.repo");
const { getBanks, resolveBankAccount } = require("../utils/paystack.utils");

class BankService {
  // ===== LIST BANKS =====
  static async listBanks() {
    try {
      const result = await getBanks();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch banks");
      }

      return {
        success: true,
        message: "Banks retrieved successfully",
        data: result.data,
      };
    } catch (error) {
      throw new Error(`Failed to list banks: ${error.message}`);
    }
  }

  // ===== RESOLVE BANK ACCOUNT =====
  static async resolveBankAccount({ accountNumber, bankCode }) {
    try {
      // Validate inputs
      abortIf(
        !accountNumber,
        httpStatus.BAD_REQUEST,
        "Account number is required"
      );
      abortIf(!bankCode, httpStatus.BAD_REQUEST, "Bank code is required");

      const result = await resolveBankAccount(accountNumber, bankCode);

      if (!result.success) {
        throw new Error(result.error || "Failed to resolve bank account");
      }

      // Check if result.data exists and has the required properties
      if (!result.data || !result.data.data) {
        throw new Error("Invalid response from bank resolution service");
      }

      const bankData = result.data.data;

      // Additional validation for required fields
      if (
        !bankData.account_name ||
        !bankData.account_number ||
        !bankData.bank_id
      ) {
        throw new Error(
          "Incomplete bank account information received from Paystack"
        );
      }

      return {
        success: true,
        message: "Bank account resolved successfully",
        data: {
          accountName: bankData.account_name,
          accountNumber: bankData.account_number,
          bankId: bankData.bank_id,
        },
      };
    } catch (error) {
      throw new Error(`Failed to resolve bank account: ${error.message}`);
    }
  }

  // ===== ADD BANK TO MEMBER PROFILE =====
  static async addBankToMember({ memberId, bankData }) {
    try {
      const { bankCode, bankName, accountNumber, nameOnAccount } = bankData;

      // Validate inputs
      abortIf(!bankCode, httpStatus.BAD_REQUEST, "Bank code is required");
      abortIf(!bankName, httpStatus.BAD_REQUEST, "Bank name is required");
      abortIf(
        !accountNumber,
        httpStatus.BAD_REQUEST,
        "Account number is required"
      );
      abortIf(
        !nameOnAccount,
        httpStatus.BAD_REQUEST,
        "Account name is required"
      );

      // Verify member exists
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      // First, resolve the bank account to verify it's valid
      const resolveResult = await resolveBankAccount(accountNumber, bankCode);
      if (!resolveResult.success) {
        throw new Error(`Invalid bank account: ${resolveResult.error}`);
      }

      // Check if resolveResult.data exists and has the required properties
      if (!resolveResult.data || !resolveResult.data.data) {
        throw new Error("Invalid response from bank resolution service");
      }

      const bankData = resolveResult.data.data;

      // Additional validation for required fields
      if (
        !bankData.account_name ||
        !bankData.account_number ||
        !bankData.bank_id
      ) {
        throw new Error(
          "Incomplete bank account information received from Paystack"
        );
      }

      // Verify that the resolved account name matches the provided name
      if (bankData.account_name.toLowerCase() !== nameOnAccount.toLowerCase()) {
        throw new Error("Account name does not match the bank's records");
      }

      // Create or update bank record
      const bank = await BankRepo.createOrUpdateBankForMember(memberId, {
        bankCode,
        bankName,
        accountNumber,
        nameOnAccount: bankData.account_name, // Use the resolved name
        isVerified: true,
        updatedAt: new Date(),
      });

      // Update member's bank reference
      await MemberRepo.update(memberId, { bank: bank._id });

      return {
        success: true,
        message: "Bank account added successfully",
        data: {
          id: bank._id,
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          nameOnAccount: bank.nameOnAccount,
          isVerified: bank.isVerified,
          createdAt: bank.createdAt,
          updatedAt: bank.updatedAt,
        },
      };
    } catch (error) {
      throw new Error(`Failed to add bank to member: ${error.message}`);
    }
  }

  // ===== GET MEMBER'S BANK =====
  static async getMemberBank({ memberId }) {
    try {
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      if (!member.bank) {
        return {
          success: true,
          message: "No bank account found",
          data: null,
        };
      }

      const bank = await BankRepo.findById(member.bank);
      abortIf(!bank, httpStatus.NOT_FOUND, "Bank account not found");

      return {
        success: true,
        message: "Bank account retrieved successfully",
        data: {
          id: bank._id,
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          nameOnAccount: bank.nameOnAccount,
          isVerified: bank.isVerified,
          createdAt: bank.createdAt,
          updatedAt: bank.updatedAt,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get member bank: ${error.message}`);
    }
  }

  // ===== UPDATE MEMBER'S BANK =====
  static async updateMemberBank({ memberId, bankData }) {
    try {
      const { bankCode, bankName, accountNumber, nameOnAccount } = bankData;

      // Validate inputs
      abortIf(!bankCode, httpStatus.BAD_REQUEST, "Bank code is required");
      abortIf(!bankName, httpStatus.BAD_REQUEST, "Bank name is required");
      abortIf(
        !accountNumber,
        httpStatus.BAD_REQUEST,
        "Account number is required"
      );
      abortIf(
        !nameOnAccount,
        httpStatus.BAD_REQUEST,
        "Account name is required"
      );

      // Verify member exists
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      // First, resolve the bank account to verify it's valid
      const resolveResult = await resolveBankAccount(accountNumber, bankCode);
      if (!resolveResult.success) {
        throw new Error(`Invalid bank account: ${resolveResult.error}`);
      }

      // Check if resolveResult.data exists and has the required properties
      if (!resolveResult.data || !resolveResult.data.data) {
        throw new Error("Invalid response from bank resolution service");
      }

      const bankData = resolveResult.data.data;

      // Additional validation for required fields
      if (
        !bankData.account_name ||
        !bankData.account_number ||
        !bankData.bank_id
      ) {
        throw new Error(
          "Incomplete bank account information received from Paystack"
        );
      }

      // Verify that the resolved account name matches the provided name
      if (bankData.account_name.toLowerCase() !== nameOnAccount.toLowerCase()) {
        throw new Error("Account name does not match the bank's records");
      }

      // Update bank record
      const bank = await BankRepo.createOrUpdateBankForMember(memberId, {
        bankCode,
        bankName,
        accountNumber,
        nameOnAccount: bankData.account_name, // Use the resolved name
        isVerified: true,
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: "Bank account updated successfully",
        data: {
          id: bank._id,
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          nameOnAccount: bank.nameOnAccount,
          isVerified: bank.isVerified,
          createdAt: bank.createdAt,
          updatedAt: bank.updatedAt,
        },
      };
    } catch (error) {
      throw new Error(`Failed to update member bank: ${error.message}`);
    }
  }

  // ===== DELETE MEMBER'S BANK =====
  static async deleteMemberBank({ memberId }) {
    try {
      // Verify member exists
      const member = await MemberRepo.findById(memberId);
      abortIf(!member, httpStatus.NOT_FOUND, "Member not found");

      if (!member.bank) {
        return {
          success: true,
          message: "No bank account to delete",
          data: null,
        };
      }

      // Delete bank record
      await BankRepo.deleteBankForMember(memberId);

      // Remove bank reference from member
      await MemberRepo.update(memberId, { bank: null });

      return {
        success: true,
        message: "Bank account deleted successfully",
        data: null,
      };
    } catch (error) {
      throw new Error(`Failed to delete member bank: ${error.message}`);
    }
  }
}

module.exports = BankService;
