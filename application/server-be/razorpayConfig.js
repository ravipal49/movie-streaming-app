const dotenv = require('dotenv').config();
const Razorpay = require('razorpay');

var razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});


module.exports = {
    razorpay
}