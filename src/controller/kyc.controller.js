const catchAsync = require("../utils/catchAsync");
const {
    KycService
} = require("../services");
const { successResponse, abortIf } = require("../utils/responder");
const httpStatus = require("http-status");

class KycController {
    verifyNIN = catchAsync(async (req, res, next) => {
        const create = await KycService.prototype.verifyNIN(req.body)
        return successResponse(res, create);
    });
}

module.exports = KycController