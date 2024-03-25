const TEST_URL = "https://cachefly.cachefly.net/100mb.test";
var testInProgress = false;
var totalDownloadedGlobally = 0.0;

$(function () {

   $(".start-btn").click(function () {
      startTest();
   });

   class GaugeChart {
      constructor(element, params) {
         this._element = element;
         this._initialValue = params.initialValue;
         this._higherValue = params.higherValue;
         this._title = params.title;
         this._subtitle = params.subtitle;
      }

      _buildConfig() {
         let element = this._element;

         return {
            value: this._initialValue,

            valueIndicator: {
               type: 'rectangle',
               width: 10,
            },
            geometry: {
               startAngle: 185,
               endAngle: 355
            },
            scale: {
               startValue: 0,
               offset: 0,
               endValue: 500,
               customTicks: [0, 100, 200, 300, 400, 500],
               tick: {
                  length: 6
               },
               label: {
                  font: {
                     color: '#87959f',
                     size: 12,
                     family: 'Albert Sans,sans-serif'
                  }
               }
            },
            title: {
               verticalAlignment: 'bottom',
               text: this._title,
               font: {
                    family: 'Albert Sans,sans-serif',
                    color: '#fff',
                    size: 12
               },
               subtitle: {
                  text: this._subtitle,
                  font: {
                    family: 'Albert Sans,sans-serif',
                    color: '#fff',
                    weight: 700,
                    size: 30
                  }
               }
            },
            onInitialized: function () {
               let currentGauge = $(element);
               let circle = currentGauge.find('.dxg-spindle-hole').clone();
               let border = currentGauge.find('.dxg-spindle-border').clone();

               currentGauge.find('.dxg-title text').first().attr('y', 48);
               currentGauge.find('.dxg-title text').last().attr('y', 28);
               currentGauge.find('.dxg-value-indicator').append(border, circle);
            }

         }
      }

      init() {
         $(this._element).dxCircularGauge(this._buildConfig());
      }
   }

   let params = {
      initialValue: 0,

      higherValue: 200,
      title: `Megabit/s`,
      subtitle: '0.00'
   };

   let gauge = new GaugeChart($(".gauge"), params);
   gauge.init();

   if (localStorage.getItem("totalBw") === null) {
      localStorage.setItem("totalBw", 0);
   }
   totalDownloadedGlobally = parseInt(localStorage.getItem("totalBw"));


   $(".data-used").html(parseFloat(totalDownloadedGlobally / 1000000 / 1000).toFixed(2));
});

function resetStroke(ticks, elems) {
   ticks.forEach(e => {
      e.css({
         stroke: 'rgba(255, 255, 255, 0.25)'
      });
   });
   elems.forEach(e => {
      e.css({
         fill: '#87959f'
      });
   });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));


function generate_random_data(size) {
   return new Blob([new ArrayBuffer(size)], {
      type: 'application/octet-stream'
   });
}

function startTest() {
   if (testInProgress) {
      return;
   }

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

   testInProgress = true;

   $(".start-btn").prop('disabled', true);

   $(".speed-line").fadeOut(function () {
      $(".start-btn").fadeOut();
   });

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
         let str = "Megabit/s (+" + totalTests + ")";
         let gb = totalDownloadedGlobally / 1000000 / 1000;
         dlSpeedFinal = parseFloat(mb / (((new Date()).getTime() - startDate.getTime()) / 1000) * 8 + "").toFixed(2);
         if (dlSpeedFinal < 100) {
            setValue(parseFloat(dlSpeedFinal + "").toFixed(2));
         } else if (dlSpeedFinal < 1000) {
            setValue(parseFloat(dlSpeedFinal + "").toFixed(1));
         } else {
            setValue(Math.round(dlSpeedFinal));
         }
         $(".data-used").html(parseFloat(gb + "").toFixed(2));
         if ($(".dxg-title text:first-child").html() != str) {
            $(".dxg-title text:first-child").html(str);
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

      await sleep(500);

      // end of test

      setValue("0.00");

      $(".dxg-title text:first-child").fadeOut(function () {
         $(".dxg-title text:first-child").html("Megabit/s");
         $(".dxg-title text:first-child").fadeIn();
      });


      $(".start-btn").fadeIn();
      $(".speed-line").fadeIn();
      $(".start-btn").prop('disabled', false);
      testInProgress = false;
   }

   runTest();
}

function setValue(val) {
   let ticks = [$(".dxg-line path:nth-child(1)"), $(".dxg-line path:nth-child(2)"),
      $(".dxg-line path:nth-child(3)"), $(".dxg-line path:nth-child(4)"),
      $(".dxg-line path:nth-child(5)"), $(".dxg-line path:nth-child(6)")
   ];
   let elems = [$(".dxg-elements text:nth-child(1)"), $(".dxg-elements text:nth-child(2)"),
      $(".dxg-elements text:nth-child(3)"), $(".dxg-elements text:nth-child(4)"),
      $(".dxg-elements text:nth-child(5)"), $(".dxg-elements text:nth-child(6)")
   ];
   let gauge = $(".gauge").dxCircularGauge('instance');
   let gaugeElement = $(gauge._$element[0]);

   resetStroke(ticks, elems);

   for (let i = 0; i < ticks.length; i++) {
      // set ticks to white if speed of 100 * i is reached
      if (val >= (i * 100)) {
         ticks[i].css({
            stroke: 'rgba(255, 255, 255, 1)'
         });
         elems[i].css({
            fill: '#fff'
         });
      }
   }
   gaugeElement.find('.dxg-title text').last().html(`${val}`);
   gauge.value(val);
}