var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Client = require('instagram-private-api').V1;
var device = new Client.Device('bogdan.stencil');
var storage = new Client.CookieFileStorage(__dirname + '/cookies/bogdan.json');
//const mergeImages = require('merge-images');
const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./SourceCodePro-Regular.ttf', {family: 'SourceCodePro'});
const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext('2d')

app.use('/public', express.static('public'));

function createImage(text) {
  loadImage('./graygradient.jpg').then((image) => {
    ctx.drawImage(image, 1080, 0, 1080, 1080);
    ctx.font = '40px "SourceCodePro"';
    ctx.fillText(text, 500, 20);
  })
}

io.on('connection', function(socket) {
  socket.on('submission', function(data) {
    Client.Session.create(device, storage, 'bogdan.stencil', process.env.BOGDANPASSWORD)
      .then(function(session) {
        Client.Upload.photo(session, createImage(data))
          .then(function(upload) {
            console.log(upload.params.uploadId);
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
