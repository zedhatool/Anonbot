require('dotenv').config();
var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
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

function createImage(text) {
  var formatted = wrap(text, {indent: '', width: 28});
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '62px "SourceCodePro"';
  ctx.fillStyle = '#FFF';
  ctx.fillText(formatted, 17, 65);

  var buf = canvas.toBuffer();
  fs.writeFileSync("submission.png", buf);

  //convert to jpeg becuase api only currently support jpeg
  let buffer = fs.readFileSync("./submission.png");
  pngToJpeg()(buffer)
    .then(output => fs.writeFileSync("./submission.jpeg", output));
  fs.unlinkSync('./submission.png');
}

function getData() {
  return fs.readFileSync('./submission.txt', 'utf-8');
}
function clearData() {
  fs.truncate('./submission.txt', 0, function(){console.log('submission file cleared')});
}

function logSubmission(ip) {
  var date = new Date();

  fs.readFile('./logs-submissions.json', 'utf-8', function readFileCallback(err, data){
    if (err){
        console.log(err);
    } else {
    var obj = JSON.parse(data);
    obj.submissionMade.push({hour: date, addr: ip});
    var json = JSON.stringify(obj);
    fs.writeFile('./logs-submissions.json', json, 'utf-8', function(err) {
      if (err) {
        console.log(err);
      }
    });
  }});
}
function logPost(text) {
  var date = new Date();

  fs.readFile('./logs-posts.json', 'utf-8', function readFileCallback(err, data) {
    if (err) { console.log(err) } else {
      var obj = JSON.parse(data);
      obj.postMade.push({hour: date, post: text});
      var json = JSON.stringify(obj);
      fs.writeFile('./logs-posts.json', json, 'utf-8', function(err) {
      if (err) {
        console.log(err);
      }
    });
    }
  });
}

io.on('connection', function(socket) {
  socket.on('submission', function(data) {
    console.log("received " + data);
    clearData();
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    createImage(data);
    fs.writeFile("./submission.txt", data, 'utf-8', function(err) {
      if (err) { return console.log(err); }
      console.log("submission saved");
    });
  });
});

function publish() {
  var data = getData();
  if (data.length != 0) {
    Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
      .then(function(session) {
        Client.Upload.photo(session, './submission.jpeg')
          .then(function(upload) {
              console.log(upload.params.uploadId);
              return Client.Media.configurePhoto(session, upload.params.uploadId, data);
          })
          .then(function(medium) {
              console.log(medium.params)
          })
      });
      logPost(data);
      clearData();
  }
} setInterval(publish, 4000);

publish();

function getClientIP(req){ // Anonbot logs IPs for safety & moderation
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

app.get("/", function(request, response) {
  response.sendFile(__dirname + '/index.html');
});
app.get("/submitted", function(request, response) {
  logSubmission(getClientIP(request));
  response.sendFile(__dirname + '/submitted.html');
});

http.listen(3000);
