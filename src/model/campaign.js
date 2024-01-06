import { Schema, model } from "mongoose"

const schema = new Schema({
    name: {
        type: String,
    },
    query: {
        type: String,
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    profiles: {
        type: [Schema.Types.ObjectId],
        ref: 'Profile'
    }
});

export default model("Campaign", schema);