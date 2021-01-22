#! /usr/bin/env node
// Device Descriptors https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js


const puppeteer = require('puppeteer');
const options = require('node-options');
const Service = require('./logService').Service;

// Command defaults
const opts = {
  "verbose" : false,
  "file": "report",
  "listscenarios":"",
  "listsuite":"",
  "device" : "",
  "screenshot": false,
  "token":"",
  "userdatadir":"",
  "width":1280,
  "height":1024,
  "docker": false,
  "keepalive": false
}

// Remove the first two arguments, which are the 'node' binary and the name
// of your script.
const result = options.parse(process.argv.slice(2), opts);
const verbose = opts.verbose;
const token = opts.token;
const docker = opts.docker;
const userdatadir = opts.userdatadir;
const width = opts.width;
const height = opts.height;
const listscenarios=opts.listscenarios;
const listsuite=opts.listsuite;
let keepalive=opts.keepalive;
let inService;
const file = opts.file;

if (result.errors || !result.args || result.args.length !== 1) {
  console.log('USAGE: boozang [--token] [--docker] [--keepalive] [--verbose] [--userdatadir] [--listscenarios] [--listsuite] [--width] [--height] [--screenshot] [--file=report] [url]');
  process.exit(2);
}

console.log("Running with following args");
console.log(opts);
console.log("Example: Use --verbose for verbose logging (boolean example). Use --width=800 to override default width (value example.)");

console.log('The value of BROWSERID is:', process.env.BROWSERID);
let browserid = process.env.BROWSERID;

(async () => {
  
  let file = (docker ? "/var/boozang/" : "");
  if (opts.file){
    file += opts.file;
  }

  let userdatadir = "";
  if (opts.userdatadir){
    userdatadir = (docker ? "/var/boozang/userdatadir" : "") + (opts.userdatadir || "");
    console.log("Setting userdatadir: " + userdatadir);
  }
  
  const launchargs = [
    '--disable-extensions-except=' + __dirname + '/bz-extension',
    '--load-extension=' + __dirname + '/bz-extension',
    '--ignore-certificate-errors',
    '--no-sandbox',
    `--window-size=${width},${height}`,
    '--defaultViewport: null'
    ];

  
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/'+browserid;
    const browser = await puppeteer.connect({
      headless: false,
        browserWSEndpoint: wsChromeEndpointurl,
        args: launchargs
    });

  function printStackTrace(app,err){
    console.error(
      "\n#######################################\n"
    + app + " error: " + err.message
    + "\n#######################################\n"
    );
  }

  function appPrintStackTrace(err){
    printStackTrace("app",err);
  }

  function idePrintStackTrace(err){
    printStackTrace("ide",err);
    Service.chkIDE()
  }

  // Setup popup
  let popup = null;
  function setupPopup() {
    popup = pages[pages.length-1]; 
    popup.setViewport({
      width: parseInt(width),
      height: parseInt(height)
    });

    popup.on("error", appPrintStackTrace);
    popup.on("pageerror", appPrintStackTrace);
    Service.setPopup(popup)
  }
  /** 
  let pages = await browser.pages();
  browser.on('targetcreated', async () => {    
        pages = await browser.pages();
        
        setupPopup(); 
        Service.setPage(page);  
  });
  */

  const page = await browser.newPage();
  
  let url = result.args[0];
  if ((!opts.screenshot) && (!opts.listscenarios) && typeof (url) == 'string' && !url.endsWith("/run") && url.match(/\/m[0-9]+\/t[0-9]+/)) {
    if (!url.endsWith("/")) {
        url += "/"
    }
    url += "run"
  }

  let inService=0;
  console.log("Browser URL: "+url)
  if(url.match(/(\?|\&)key=.+(\&|\#)/)){
    console.log("Running in cooperation!")
    inService=1
  }else{
    console.log("Running in stand alone!")
  }

  // Assign all log listeners
  Service.logMonitor(page,keepalive,file,inService);

  if(listsuite||listscenarios){
    Service.setBeginningFun(function(){
      Service.insertFileTask(function(){
        Service.result = 0;
        Service.shutdown()
      })
      if(listsuite){
        page.evaluate((v)=>{
          $util.getTestsBySuite(v)
        }, listsuite);
      }else if(listscenarios){
        page.evaluate((v)=>{
          $util.getScenariosByTag(v)
        }, JSON.parse(listscenarios));
      }
    })
  }

  //const version = await page.browser().version();
  //console.log("Running Chrome version: " + version);
  const response = await page.goto(url);

  page.on("error", idePrintStackTrace);
  page.on("pageerror", idePrintStackTrace);

})()





