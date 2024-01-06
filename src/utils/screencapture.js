import { Server } from "socket.io"
import robot from "robotjs";
import Jimp from "jimp";
import screenshot from "screenshot-desktop";
import activeWin from "active-win";


const screen_io = new Server({
    cors: {
        origin: "*"
    }
}), io = new Server({
    cors: {
        origin: "*"
    }
});
let driver;
let x, y, width, height;
screen_io.on("connection", (socket) => {
    console.log("connected");
    const capture = async () => {
        try {
            let start = new Date();
            const window = await activeWin();
            if (!(window.owner.name.search("Chrome") + 1)) return;
            ({ x, y, width, height } = window.bounds); ``

            width -= 20;
            x += 10;
            y += 100;
            height -= 100;
            const imgBuffer = await screenshot({ format: "png" });
            console.log("imgbuffer time", new Date() - start);
            const img = await Jimp.read(imgBuffer);
            console.log("jimp time", new Date() - start);
            const croppedImage = img.crop(x, y, width, height);
            console.log("crop time", new Date() - start);
            const croppedBuffer = await croppedImage.getBufferAsync(Jimp.MIME_PNG);
            console.log("getbuffer time", new Date() - start);
            socket.emit("screen", croppedBuffer.toString("base64"));
            console.log("base64 time", new Date() - start);
        }
        catch (err) {
            console.log("Screenshot Error");
        }
    }
    const sendCapture = setInterval(capture, 40);

    socket.on("disconnect", () => {
        console.log("socket closed");
        clearInterval(sendCapture);
        try {
            driver.close();
            driver.quit();
        }
        catch (err) {
            console.log("Chrome close error --- on socket disconnected");
        }
    })
});

io.on("connection", (socket) => {
    socket.on("mouse", (action, _x, _y, buttonNum) => {
        const absoluteX = x + parseInt(_x * width);
        const absoluteY = y + parseInt(_y * height);

        // if (action === "MOVE") {
        //     robot.moveMouse(absoluteX, absoluteY);
        // } else
        if (action === "DRAG") {
            robot.dragMouse(absoluteX, absoluteY);
        } else if (action === "MOUSEDOWN") {
            const button = "left";
            robot.moveMouse(absoluteX, absoluteY);
            robot.mouseToggle("down", button);
        } else if (action === "MOUSEUP") {
            const button = "left"
            robot.moveMouse(absoluteX, absoluteY);
            robot.mouseToggle("up", button);
        }
    });

    socket.on("kbd", (action, key) => {
        if (action == "text") {
            robot.typeStringDelayed(key, 2000);
            return;
        }
        if (key == " ") key = "space";
        key = key.toLowerCase();
        key = key.split("arrow");
        key = key[key.length - 1];
        if (key != "ctrl" && key != "alt" && key[0] != 'f')
            try {
                if (action === "KEYDOWN") {
                    robot.keyToggle(key, "down");
                } else if (action === "KEYUP") {
                    robot.keyToggle(key, "up");
                }
            } catch (err) {
                console.log("key down error ", key);
            }
    })
})


export function start(_driver) {
    try {
        driver = _driver;
        screen_io.listen(8765);
        io.listen(8766);
    }
    catch (err) {
        console.log("io start error");
    }
}
export function close() {
    try {
        screen_io.close();
        io.close();
    }
    catch (err) {
        console.log("io close error");
    }
}