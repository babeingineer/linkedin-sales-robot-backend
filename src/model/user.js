import { Schema, model } from "mongoose"

const schema = new Schema({
    id: {
        type: String,
        unique: true,
        required: true
    },
    signed: {
        type: Boolean
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
    },
    campaigns: {
        type: [Schema.Types.ObjectId],
        ref: 'Campaign'
    }
});

export default model("User", schema);