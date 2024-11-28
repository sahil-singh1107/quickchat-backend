// user schema

import mongoose, { Types } from "mongoose";

const Schema = mongoose.Schema

const userSchema = new Schema({
    name: {
        type: String,
        trim: true,
        max: 32,
        required: true
    },
    email: {
        type: String,
        trim: true,
        required: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: false
    },
    imageUrl: {
        type: String
    }
}, { timestamps: true })

const userModel = mongoose.model("User", userSchema)

export default userModel