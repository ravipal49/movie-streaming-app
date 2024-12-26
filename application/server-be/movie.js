const mongoose =require('mongoose');


const movieSchema= new mongoose.Schema({
    movieName:{
        type:String,
        required:true
    },
    movieUrl:{
        type:String,
        required:true
    },
    thumbnailUrl:{
        type:String,
    },
    movieDescription:{
        type:String,
    },
    movieimage:{
        type:String,
    },
    isPaid: {
        type: Boolean,
        default: false
    }
    
})

const movie=mongoose.model('movie',movieSchema);
module.exports=movie