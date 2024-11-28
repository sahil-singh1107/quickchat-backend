import connectDB from "./config";
import dotenv from "dotenv"
import express, { response } from "express"
import { OAuth2Client } from "google-auth-library";
import User from "./Models/User";
import Content from "./Models/Content"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');
import { WebSocket, WebSocketServer } from "ws";
const logger = require('pino')()
import cors from "cors"

let clients = new Map<string, WebSocket>()
const wss = new WebSocketServer({ port: 443 })

type Message = {
    type: "establish";
    name: string
} | {
    type: "message";
    sender: string;
    recipient: string;
    content: string;
}

wss.on("connection", async (socket) => {
    socket.on("message", async (data) => {

        // @ts-ignore
        const message: Message = JSON.parse(data);

        if (message.type === "establish") {
            const { name } = message;

            clients.set(name, socket);
        } else if (message.type === "message") {
            const { sender, recipient, content } = message;
            logger.info(content);
            const recipientSocket = clients.get(recipient);
            let s = await User.findOne({ name: sender });
            let r = await User.findOne({ name: recipient });
            await Content.create({ sender: s?._id, receiver: r?._id, content });
            if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
                recipientSocket.send(
                    JSON.stringify({ sender, content })
                );
                socket.send(JSON.stringify({ sender, content }))
            } else {
                socket.send(JSON.stringify({ sender, content }))
            }
        }

    });

    socket.on("close", () => {
        for (const [name, clientSocket] of clients.entries()) {
            if (clientSocket === socket) {
                clients.delete(name);
                break;
            }
        }
    });
});


dotenv.config()

const app = express();
app.use(express.json())
app.use(cors())

const port = process.env.PORT || 5000

const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'postmessage',
);

app.post('/auth/google', async (req, res) => {
    const { tokens } = await oAuth2Client.getToken(req.body.code);
    res.json(tokens);
});

app.post("/googlelogin", async (req, res) => {
    const { idToken } = req.body

    oAuth2Client.verifyIdToken({ idToken, audience: process.env.CLIENT_ID }).then(async (response) => {
        // @ts-ignore
        const { email_verified, name, email, picture } = response.payload;
        if (email_verified) {
            try {
                let user = await User.findOne({ email })
                if (user) {
                    // @ts-ignore
                    const token = jwt.sign({ _id: user._id }, "sdfefergegg");
                    res.json({ token, name: user.name, picture })
                    return;
                }
                else {
                    const randomName = uniqueNamesGenerator({ dictionaries: [colors, animals] });
                    let user = await User.create({ name: name + "_" + randomName, email, imageUrl: picture })
                    const token = jwt.sign({ _id: user._id }, "sdfefergegg");
                    res.json({ token, name: user.name, picture })
                    return;
                }
            } catch (error) {
                console.log(error)
                res.status(400).json({
                    error: "Google login failed. Try again"
                });
                return;
            }
        }
        else {
            res.status(400).json({
                error: "Google login failed. Try again"
            });
            return;
        }
    })
})

app.post("/emailsignup", async (req, res) => {
    const { email, password, name } = req.body
    if (name.length < 3) {
        res.status(400).json({ error: "Name must be 3 characters long" })
        return;
    }
    if (!email) {
        res.status(400).json({ error: "Email cannot be empty" })
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: "Password must be 8 characters long" })
        return;
    }
    try {
        let user = await User.findOne({ email })
        if (user) {
            res.status(400).json({ error: "User already exists" })
            return;
        }
    } catch (error) {
        console.log(error)
        return;
    }


    bcrypt.hash(password, 10, async function (err, hash) {
        try {
            await User.create({ email, password: hash, name });
            res.status(200).json({ message: "User created successfully" });
            return;
        } catch (error) {
            res.status(400).json({ error: "Error creating user" })
            return;
        }
    })
})

app.post("/emaillogin", async (req, res) => {
    const { email, password } = req.body
    if (!email) {
        res.status(400).json({ error: "Email cannot be empty" })
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: "Password must be 8 characters long" })
        return;
    }
    try {
        let user = await User.findOne({ email })
        if (!user) {
            res.status(400).json({ error: "The user doesn't exist" });
            return;
        }
        // @ts-ignore
        bcrypt.compare(password, user.password, function (err, result) {
            if (result) {
                const token = jwt.sign({ _id: user._id }, "sdfefergegg");
                res.json({ token, name: user.name, picture: "https://www.reddit.com/media?url=https%3A%2F%2Fpreview.redd.it%2F4yks7n8rx9h81.png%3Fauto%3Dwebp%26s%3D646b65ae75919a64df6ead0fff622f63857bb278" });
                return;
            }
            else {
                res.status(400).json({ message: "Password is wrong" });
                return;
            }
        })
    } catch (error) {

        res.status(400).json({ error: "Something went wrong" })
        return;
    }

})

app.get("/search", async (req, res) => {
    const searchQuery = req.query.query
    try {
        const result = await User.find({ email: { $regex: searchQuery, $options: "i" } })
        if (!result) return;
        res.json(result)
        return;
    } catch (error) {
        console.log(error);
        return;
    }
})

app.get("/getImage", async (req, res) => {
    const searchQuery = req.query.query
    try {
        let user = await User.findOne({ name: searchQuery });
        res.json(user?.imageUrl);
        return;
    } catch (error) {
        console.log(error);
        return;
    }
})

app.post("/messages", async (req, res) => {
    try {
        const { sender, receiver } = req.body;

        const s = await User.findOne({ name: sender });
        const r = await User.findOne({ name: receiver });

        if (!s || !r) {
            res.status(404).json({ error: "Sender or receiver not found" });
            return;
        }

        // Use $or to handle bidirectional messages
        const messages = await Content.find({
            $or: [
                { sender: s._id, receiver: r._id },
                { sender: r._id, receiver: s._id },
            ],
        })
            .populate("sender", "name") // Populate sender's name
            .populate("receiver", "name"); // Populate receiver's name

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "An error occurred while fetching messages" });
    }
});



connectDB().then(() => app.listen(port, () => console.log("server up and running"))).catch((err) => console.log(err));