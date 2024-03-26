const TEST_URL = "https://cachefly.cachefly.net/100mb.test";
var testInProgress = false;
var totalDownloadedGlobally = 0.0;
var speedSteps = [0, 5, 10, 20, 50, 75, 100];


function linearMap(xMin, xMax, yMin, yMax, speed) {
    var slope = (yMax - yMin) / (xMax - xMin);
    var intercept = yMin - slope * xMin;
    return slope * speed + intercept;
}

function getSpeedAngle(speed) {
    // piecewise function 
    /*
        0 Mbps -> -123 deg
        5 Mbps -> -82
        10 Mbps -> -41
        20 Mbps -> 0 deg
        50 Mbps -> 41
        75 Mbps -> 82
        100 Mbps -> 123 deg
    */

    if (speed <= 5) {
        return linearMap(0, 5, -123, -82, speed);

    } else if (speed <= 10) {
        return linearMap(5, 10, -82, -41, speed);

    } else if (speed <= 20) {
        return linearMap(10, 20, -41, 0, speed);

    } else if (speed <= 50) {
        return linearMap(20, 50, 0, 41, speed);

    } else if (speed <= 75) {
        return linearMap(50, 75, 41, 82, speed);

    } else {
        if (speed > 100) {
            return 123;
        }
        return linearMap(0, 100, 82, 123, speed);
    }
}

function setSpeed(speed) {
    var angle = getSpeedAngle(speed);
    $("#stick").css("transform", "rotate(" + angle + "deg) translateX(153px) translateY(45px)");
    $("#speed-text").text(Number.parseFloat(speed).toFixed(2));

    for (var i = 0; i < speedSteps.length; i++) {
        if (speed >= speedSteps[i]) {
            $("#speed-" + speedSteps[i]).addClass("active-speed");
        } else {
            $("#speed-" + speedSteps[i]).removeClass("active-speed");
        }
    }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

$(document).ready(function() {

    $(".start-btn").click(function () {
        startTest();
    });

    if (localStorage.getItem("totalBw") === null) {
        localStorage.setItem("totalBw", 0);
    }
    totalDownloadedGlobally = parseInt(localStorage.getItem("totalBw"));


    $(".data-used").html(parseFloat(totalDownloadedGlobally / 1000000 / 1000).toFixed(2));
    
})


async function startTest() {
    if (testInProgress) {
        return;
    }

    $(".gauge").addClass("run");
    testInProgress = true;

    $("#test-type").addClass("blinking");
    $("#test-type").text("Connecting...");

    $(".start-btn").prop('disabled', true);

    $(".speed-line").fadeOut(function () {
        $(".start-btn").fadeOut();
    });

    await sleep(3000);

    $("#test-type").removeClass("blinking");
    $("#test-type").text("Mbps (+0)");

    
    await sleep(1000);


    let connectionFailed = false;

    let totalTests = 0;
    let stopTests = false;
    // wait for the last test to complete before showing results (not guaranteed; if the while loop executes in between a transition between
    // false -> true, we will be in sh*t)
    let waitForMe = false;
    let firstRun = false;
    let dlSpeedFinal = 0;
    let totalDownloaded = 0;
    let startDate = new Date();

    const controller = new AbortController();

    
    async function main(curr) {

        const signal = controller.signal;

        const response = await fetch(TEST_URL + '?v=' + (Math.floor(new Date().getTime() / 1000)), {
            signal: controller.signal
        });

        if (firstRun) {
            // deal with the delay between the first request and actual progress
            startDate = new Date();
            firstRun = false;
        }

        const contentLength = response.headers.get('content-length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        totalTests++;
        const res = new Response(new ReadableStream({

            async start(controller) {

                const reader = response.body.getReader();
                for (;;) {
                const {
                    done,
                    value
                } = await reader.read();
                if (done) break;
                if (stopTests) controller.abort();
                loaded += value.byteLength;
                totalDownloadedGlobally += value.byteLength;
                totalDownloaded += value.byteLength;
                controller.enqueue(value);
                }
                controller.stop();
                return;
            },
        }));

        try {
            const blob = await res.blob();

        } catch {

        }
        totalTests--;
    }


    async function trackTest() {

        waitForMe = true;
        while (!stopTests) {
            await main(totalTests);
        }
        waitForMe = false;
    }

    async function runTest() {
        totalDownloaded = 0;
        firstRun = true;

        for (let i = 0; i < 3; i++) {
            trackTest();
        }

        while ((((new Date()).getTime() - startDate.getTime()) / 1000 < 12 && waitForMe)) {
            let mb = totalDownloaded / 1000000;
            let str = "Mbps (+" + totalTests + ")";
            let gb = totalDownloadedGlobally / 1000000 / 1000;
            dlSpeedFinal = mb / (((new Date()).getTime() - startDate.getTime()) / 1000) * 8 + "";
            if (dlSpeedFinal < 100) {
                setSpeed(dlSpeedFinal);
            } else if (dlSpeedFinal < 1000) {
                setSpeed(dlSpeedFinal);
            } else {
                setSpeed(dlSpeedFinal);
            }
            $(".data-used").html(parseFloat(gb + "").toFixed(2));
            if ($("#test-type").html() != str) {
                $("#test-type").html(str);
            }
            await sleep(50);
        }

        localStorage.setItem("totalBw", totalDownloadedGlobally);

        controller.abort();
        stopTests = true;

        if (connectionFailed) {
            $(".speed").html("Connection failed");
        } else {
            $(".speed").html("Your speed: " + parseFloat(dlSpeedFinal + "").toFixed(2) + " Mbps");
        }

        await sleep(1000);

        // end of test

        setSpeed(0.00);

        for (var i = 0; i < speedSteps.length; i++) {
            $("#speed-" + speedSteps[i]).removeClass("active-speed");
        }

        $(".start-btn").fadeIn();
        $(".speed-line").fadeIn();
        $(".start-btn").prop('disabled', false);
        $("#test-type").text("Mbps");
        testInProgress = false;
    }

        runTest();
    }