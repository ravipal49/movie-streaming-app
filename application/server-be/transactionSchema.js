const mongoose = require('mongoose');


const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['created', 'paid', 'failed'],
        default: 'created'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
   
    isSubscriptionPurchase: {
        type: Boolean,
        default: false
    }
}); 


const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;