import express from "express"
import { login, getData } from "./utils/selenium"
import mongoose from "mongoose";
import profileModel from "./model/profile";
import userModel from "./model/user"
import campaignModel from "./model/campaign"
import cors from "cors"
import jwt from "jsonwebtoken"

const secretKey = "hundred";

const app = express();
mongoose.connect("mongodb+srv://babeengineer:yGRIxF0LwH6YGC00@cluster0.w13ff3t.mongodb.net/salesrobot");

app.use(cors());
app.use(express.json());


const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader;
        console.log(token);
        jwt.verify(token, secretKey, async (err, decoded) => {
            if (err) {
                console.log(err);
                res.sendStatus(403);
            }
            else {
                req.user = await userModel.findOne({ id: decoded.id });
                next();
            }
        })
    }
    else {
        res.sendStatus(401);
    }
};



app.post("/signup", async (req, res) => {
    req.body.email = req.body.email.toLowerCase();
    console.log(req.body);
    try {
        res.send({ status: "success", data: await userModel.create(req.body) });
    }
    catch (err) {
        res.send({ status: "error", data: err });
    }
});
app.post("/signin", async (req, res) => {
    console.log(req.body);
    const user = await userModel.findOne({ email: req.body.email });
    if (!user)
        res.send({ status: "Not email" });
    else if (user.password == req.body.password)
        res.send({ token: jwt.sign({ id: user.id }, secretKey, { expiresIn: 100000 }), status: "success" });
    else
        res.send({ status: "Not password" });
});

app.get("/me", authenticateJWT, async (req, res) => {
    res.send(req.user);
})
app.get("/campaigns", authenticateJWT, async (req, res) => {
    res.send(await campaignModel.find({ user: req.user._id }));
})


app.get("/:campaign/profile", authenticateJWT, async (req, res) => {
    let campaign = await campaignModel.findById(req.params.campaign);
    let page = req.query.page;
    let count = req.query.count;

    res.send({
        count: await profileModel.countDocuments({ campaign: campaign._id }),
        data: await profileModel.find({
            campaign: campaign._id
        }).skip(count * (page - 1)).limit(count)
    });
});

app.get("/campaign", authenticateJWT, async (req, res) => {
    res.send(await campaignModel.findById(req.query._id));
})
app.post("/campaign", authenticateJWT, async (req, res) => {
    res.send(await campaignModel.create({
        name: req.body.campaign,
        query: req.body.query,
        user: req.user._id,
    }));

    let campaign = await campaignModel.findOne({ name: req.body.campaign });
    let items = await getData(req.user.id, req.body.query);
    console.log(items);
    if (items)
        for (let item of items) {
            profileModel.create({
                ...item,
                campaign: campaign._id
            })
        };
});






app.listen(8000, () => {
    console.log("Server running on port 8000");
})