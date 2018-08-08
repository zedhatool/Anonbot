require('dotenv').config();
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var sleep = require('sleep');
var wrap = require('word-wrap');
var Client = require('instagram-private-api').V1;
var device = new Client.Device('anonbot.wl');
var storage = new Client.CookieFileStorage(__dirname + '/cookies/anonbot.json');
const pngToJpeg = require('png-to-jpeg');
const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./SourceCodePro-Regular.ttf', {family: 'SourceCodePro'});
const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext('2d');

app.use('/public', express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/submission", function(req, res) {
  console.log("received " + req.body.anon);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  createImage(req.body.anon);
  return res.redirect('/submitted');
});

function createImage(text) {
  var formatted = wrap(text, {indent: '', width: 28});
  ctx.fillStyle = '#404040'; // #0079a5 for admin posts
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '62px "SourceCodePro"';
  ctx.fillStyle = '#FFF';
  ctx.fillText(formatted, 17, 65);

  var buf = canvas.toBuffer();
  fs.writeFileSync("submission.png", buf);

  //convert to jpeg becuase api only currently support jpeg
  let buffer = fs.readFileSync("./submission.png");
  pngToJpeg()(buffer)
    .then(output => fs.writeFile("./submission.jpeg", output, function(err) {
      if (err) {
        console.log(err);
      }

      fs.exists("./submission.jpeg", function(exists) {
        if (exists) {
          publish(text);
        }
      })
    }));
  fs.unlinkSync('./submission.png');
}

function publish(caption) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
    .then(function(session) {
      Client.Upload.photo(session, './submission.jpeg')
      .then(function(upload) {
          console.log(upload.params.uploadId);
          return Client.Media.configurePhoto(session, upload.params.uploadId, caption);
      })
      .then(function(medium) {
        console.log(medium.params)
      })
    });
    log("post", caption);
}

function log(type, data) {
  var date = new Date();

  fs.readFile('./logs-'+type+'.json', 'utf-8', function(err, result) {
    if (err) console.log(err);
    else {
      var obj = JSON.parse(result);
      if (type === "submission") obj.submissionMade.push({hour: date, addr: data});
      else if (type === "post") obj.postMade.push({hour: date, post: data});

      var json = JSON.stringify(obj);
      fs.writeFile('./logs-'+type+'.json', json, 'utf-8', function(err) {
        if (err) console.log(err);
      })
    }
  })
}

function getClientIP(req){ // Anonbot logs IPs for safety & moderation
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

app.get("/", function(request, response) {
  response.sendFile(__dirname + '/index.html');
});
app.get("/submitted", function(request, response) {
  log("submission", getClientIP(request));
  response.sendFile(__dirname + '/submitted.html');
});

http.listen(3000);
