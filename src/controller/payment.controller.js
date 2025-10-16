const catchAsync = require("../utils/catchAsync");
const { PaymentService } = require("../services");
const { successResponse } = require("../utils/responder");

class PaymentController {
    static fundWallet = catchAsync(async (req, res, next) => {
        const {auth} = req
        const {amount, currency} = req.body
        const create = await PaymentService.fundWallet({auth, amount, currency})
        return successResponse(res, create);
    });

    static buyToken = catchAsync(async (req, res, next) => {
        const {auth} = req
        const {tokens, currency} = req.body
        const {asset_id} = req.params
        const create = await PaymentService.buyToken({auth, tokens, currency, asset_id})
        return successResponse(res, create);
    });
}

module.exports = PaymentController