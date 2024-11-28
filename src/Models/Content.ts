import mongoose, { Schema, Types } from "mongoose";

const contentSchema = new Schema({
    sender: {
        type: Types.ObjectId,
        ref: "User"
    },
    receiver: {
        type : Types.ObjectId,
        ref: "User"
    },
    content: {
        type: String
    }
}, {timestamps: true})

const contentModel = mongoose.model("Content", contentSchema);

export default contentModel