const { axiosPOST } = require("./request")

const initiateCharge = async ({amount, reference, meta, email}) => {
    const {order_id, customer_id,} = meta
    const data = {
        tx_ref: reference,
        amount,
        customer: {
            email,
        },
        currency: "NGN",
        redirect_url: `${process.env.BASEURL}/api/v1/pay/call-back`,
        meta
    }
    console.log(data)
    const call = await axiosPOST(`${process.env.PAYMENT_API}/payments`, data, {
        Authorization: `Bearer ${process.env.PAYMENT_SEC_KEY}`
    })
    return call?.data?.link
}

module.exports = {
    initiateCharge
}