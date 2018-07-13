var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sleep = require('sleep');
var Client = require('instagram-private-api').V1;
var device = new Client.Device('bogdan.stencil');
var storage = new Client.CookieFileStorage(__dirname + '/cookies/bogdan.json');
const pngToJpeg = require('png-to-jpeg');
const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./SourceCodePro-Regular.ttf', {family: 'SourceCodePro'});
const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext('2d');

app.use('/public', express.static('public'));

function createImage(text) {
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '40px "SourceCodePro"';
  ctx.fillStyle = '#FFF';
  ctx.fillText(text, 100, 50);

  var buf = canvas.toBuffer();
  fs.writeFileSync("test.png", buf);

  //convert to jpeg becuase api only currently support jpeg
  let buffer = fs.readFileSync("./test.png");
  pngToJpeg()(buffer)
    .then(output => fs.writeFileSync("./test.jpeg", output));
}

io.on('connection', function(socket) {
  socket.on('submission', function(data) {
    console.log("received " + data);
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    createImage(data);
    Client.Session.create(device, storage, 'bogdan.stencil', 'stancium1151')
      .then(function(session) {
        Client.Upload.photo(session, './test.jpeg')
          .then(function(upload) {
            console.log("id: " + upload.params.uploadId);
		        return Client.Media.configurePhoto(session, upload.params.uploadId, data);
          })
          .then(function(medium) {
            console.log(medium.params);
          });
      });
  });
});

app.get("/", function (request, response) {
  response.sendFile(__dirname + '/index.html');
});

http.listen(3000);
