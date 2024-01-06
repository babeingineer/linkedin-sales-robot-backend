import { Schema, model } from "mongoose";

const schema = new Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    geoRegion: {
        type: String,
    },
    profileUrl: {
        type: String,
    },
    company: {
        type: String,
    },
    title: {
        type: String,
    },
    photoUrl: {
        type: String,
    },
    campaign: {
        type: Schema.Types.ObjectId,
        ref: 'Campaign'
    },
    messages: {
        type: Array
    }
});

export default model("Profile", schema);