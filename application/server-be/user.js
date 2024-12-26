const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password:{
        type: String,
        required: true
    },
    role: {
        type: String,
        default: "Viewer"
    },
    isAdmin: {
        type: Boolean
    },
    otp: {
        type: String
    },
    isSubscribed: {
        type: Boolean,
        default: false
    },
    subscriptionValidTill: {
        type: Date
    }
})


const User = mongoose.model('User', userSchema)

module.exports = User
