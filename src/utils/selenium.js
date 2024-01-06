import { Builder, By, Key, until } from "selenium-webdriver"
import webdriver from "selenium-webdriver"
import chrome from "selenium-webdriver/chrome"
import { Server } from "socket.io"
import userModel from "../model/user"
import { PageLoadStrategy } from "selenium-webdriver/lib/capabilities"
import EventEmitter from "events"

const emitter = new EventEmitter();

const io = new Server(8765, {
    cors: {
        origin: "*"
    }
})

function configure(username, proxy) {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments(`--user-data-dir=C:/profiles/${username}`);
    chromeOptions.addArguments(`--proxy-server=${proxy}`);
    chromeOptions.setPageLoadStrategy(PageLoadStrategy.NONE);
    // chromeOptions.addArguments("--disable-extensions");
    // chromeOptions.addArguments("--disable-infobars");
    // chromeOptions.addArguments("--no-sandbox");
    // chromeOptions.addArguments("--disable-dev-shm-usage");
    // chromeOptions.addArguments("--disable-3d-apis");
    // chromeOptions.setMobileEmulation({
    //     deviceMetrics: { width: 600, height: 800, pixelRatio: 3.0 },
    // });

    return new webdriver.Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
}

io.on("connection", async (socket) => {
    console.log("connected");

    let driver, sendCapture = 0;
    socket.on("initial", async (username, proxy = "socks5://35.172.151.238:8128") => {

        console.log("initialize", username);

        driver = configure(username, proxy);
        await driver.manage().window().setRect({ width: 400, height: 500 });
        // console.log(await driver.takeScreenshot());
        let prev;

        let sendCaptureFunc = async () => {
            try {
                // console.log("screenshot started");
                const readyState = await driver.executeScript('return document.readyState');
                if (readyState === 'complete')
                {
                    let cur = await driver.takeScreenshot();
                    if(cur != prev)
                    {
                        socket.emit("screen", await driver.takeScreenshot());
                        prev = cur;
                    }
                }
                else {
                    console.log("loading sent");
                    socket.emit("screen", "loading");
                }
            }
            catch (err) {
                console.log("screenshot error");
            }
        }

        sendCapture = setInterval(sendCaptureFunc, 100);

        emitter.on("screen", async () => {
            sendCaptureFunc();
        });


        await driver.get("https://linkedin.com");
        try {
            await driver.wait(until.elementLocated(By.id('ember16')), 240000);
            socket.emit("success");
            console.log("login success");
            let user = await userModel.findOne({ id: username });
            user.signed = true;
            await user.save();
        }
        catch (err) {
            console.log("Login failed");
        }
        socket.disconnect(true);
    })

    socket.on("kbd", async (key) => {
        if (key == "ArrowLeft") key = Key.ARROW_LEFT;
        else if (key == "ArrowRight") key = Key.ARROW_RIGHT;
        else if (key == "ArrowUp") key = Key.ARROW_UP;
        else if (key == "ArrowDown") key = Key.ARROW_DOWN;
        else if (key == "Backspace") key = Key.BACK_SPACE;
        else if (key == "Delete") key = Key.DELETE;
        else if (key == "Tab") key = Key.TAB;
        else if (key == "Enter") key = Key.RETURN;
        else if (key.length > 1) {
            console.log("key blocked ", key);
            return;
        }

        await driver.actions().sendKeys(key).perform();
        emitter.emit("screen");
    });
    socket.on("text", async (text) => {
        await driver.actions().sendKeys(text).perform();
    });
    socket.on("mouse", async (x, y) => {
        try {
            console.log(x, y);
            await driver.actions().move({ x: parseInt(x), y: parseInt(y) }).click().perform();
        }
        catch (err) {
            console.log("mouse error", err);
        }
    })

    socket.on("disconnect", async () => {
        console.log("disconnected");
        if (sendCapture)
            clearInterval(sendCapture);

        try {
            await driver.close();
            await driver.quit();
        }
        catch (err) {
            console.log("driver closed error --- socket.disconnect");
        }
    })
})

// export async function login(username, proxy = "socks5://35.172.151.238:8128") {
//     const driver = configure(username, proxy);
//     await driver.manage().window().setRect({ width: 600, height: 800 });
//     await driver.manage().setTimeouts({ implicit: 240000 });
//     await driver.get('https://linkedin.com');
//     WS.start(driver);
//     try {
//         await driver.findElement(By.id('ember16'));
//         await driver.close();
//         return 1;
//     }
//     catch (err) {
//         console.log("Login error!!!");
//     }
//     try { await driver.close(); } catch (err) { console.log("Chrome close error -- selenium"); }
//     WS.close();
//     return 0;
// }
export async function getData(username, query, proxy = "socks5://35.172.151.238:8128") {
    const driver = configure(username, proxy);
    try {

        await driver.manage().setTimeouts({ implicit: 30000 });
        await driver.get('https://www.linkedin.com/sales/search/people?query=(spellCorrectionEnabled%3Atrue%2Ckeywords%3Areal%2520estate%2520investor)');
        await driver.findElement(By.css(".artdeco-list__item.pl3.pv3"))
        const cookies = await driver.manage().getCookies();
        console.log("Getting Data...");
        const csrfTokenCookie = cookies.find(cookie => cookie.name === 'JSESSIONID');
        const csrfToken = csrfTokenCookie ? csrfTokenCookie.value : '';
        let res = [];
        for (let i = 0; i < 1; ++i) {
            const jsCode = `
                let res = await fetch('https://www.linkedin.com/sales-api/salesApiLeadSearch?q=searchQuery&query=(spellCorrectionEnabled:true,keywords:${encodeURI(query)})&start=${i * 100}&count=100', {
                    method: 'GET',
                    headers: {
                        'Csrf-Token': ${csrfToken},
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                })
                try{
                    return await res.json();
                }
                catch(err) {
                    return await res.text();
                }
            `;
            const data = await driver.executeScript(jsCode);
            console.log(data);
            res.push(...data.elements);
        }
        await driver.close();
        let optRes = res.map(item => {
            let res = {
                firstName: item.firstName,
                lastName: item.lastName,
                geoRegion: item.geoRegion,
                profileUrl: (() => {
                    return "https://www.linkedin.com/sales/lead/" + item.entityUrn.match(/\(([^)]+)\)/)[1];
                })(),
            }
            if (item.currentPositions[0]) {
                res.company = item.currentPositions[0].companyName;
                res.title = item.currentPositions[0].title;
            }
            if (item.profilePictureDisplayImage) {
                res.photoUrl = item.profilePictureDisplayImage.rootUrl + item.profilePictureDisplayImage.artifacts[item.profilePictureDisplayImage.artifacts.length - 1].fileIdentifyingUrlPathSegment;
            }

            return res;
        });
        return optRes;
    }
    catch (err) {
        console.log(err);
        await driver.close();
        return 0;
    }
}