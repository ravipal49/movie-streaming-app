const dotenv = require('dotenv').config()
const mongoose = require('mongoose')

function connectDatabase() {

    const mongoUri = process.env.MONGODB_URI


    mongoose.connect(mongoUri)
        .then(() => {
            console.log('database is connected')
        })
}
module.exports = {
    connectDatabase
}

