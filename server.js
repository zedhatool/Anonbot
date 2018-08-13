require('dotenv').config();
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var sleep = require('sleep');
var ref = require('instagram-id-to-url-segment');
var urlSegmentToInstagramId = ref.urlSegmentToInstagramId;
var Client = require('instagram-private-api').V1;
var device = new Client.Device('anonbot.wl');
var storage = new Client.CookieFileStorage(__dirname + '/cookies/anonbot.json');
const pngToJpeg = require('png-to-jpeg');
var wrap = require('word-wrap');
const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./fonts/SourceCodePro-Regular.ttf', {family: 'SourceCodePro'});
const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext('2d');

function createImage(text, fillStyle) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var formatted = wrap(text, {indent: '', width: 28});
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '62px "SourceCodePro"';
  ctx.fillStyle = '#FFF';
  ctx.fillText(formatted, 17, 65);

  var buf = canvas.toBuffer();
  fs.writeFileSync("submission.png", buf);

  //convert to jpeg becuase currently api only supports jpeg
  let buffer = fs.readFileSync("./submission.png");
  pngToJpeg()(buffer)
    .then(output => fs.writeFile("./submission.jpeg", output, function(err) {
      if (err) console.log(err);
      fs.exists("./submission.jpeg", function(exists) {
        if (exists) publish(text);
      })
    }));
  fs.unlinkSync('./submission.png');
}

function publish(caption) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
    Client.Upload.photo(session, './submission.jpeg')
    .then(function(upload) {
      console.log("uploading...");
      return Client.Media.configurePhoto(session, upload.params.uploadId, caption);
    })
    .then(function(medium) {
      console.log("photo uploaded at " + medium.params.webLink);
    })
  });
  log("post", caption);
}

function postComment(id, comment) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
    return Client.Comment.create(session, ''+id, comment);
  })
}

function delPost(id) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
    return Client.Media.delete(session, ''+id);
  })
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

function getShortcode(url) {
  var parts = url.split('/');
  return parts[4];
}

app.use('/public', express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/submission", function(req, res) {
  console.log("received " + req.body.anon);
  createImage(req.body.anon, '#404040');
  return res.redirect('/submitted');
});
app.post("/comm", function(req, res) {
  console.log("received comment " + req.body.comment + " on " + req.body.url);
  var shortcode = getShortcode(req.body.url);
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
     return Client.Media.getByUrl(session, ''+req.body.url)
     .then(function(data) {
       if (data._params.user.username === "anonbot.wl") {
         postComment(urlSegmentToInstagramId(shortcode), req.body.comment);
         console.log("posted comment " + req.body.comment);
         return res.redirect('/commented');
       } else {
         console.log("comment not posted: post is not an Anonbot post");
         return res.redirect('/');
       }
     })
     .catch(function(err) {
       if (err) {
         console.log("commment not posted: url is invalid");
         return res.redirect('/');
       }
     })
  })
});
app.post("/delpost", function(req, res) {
  console.log("received deletion request for " + req.body.link);
  if (req.body.key === process.env.MOD_KEY) {
    var shortcode = getShortcode(req.body.link);
    delPost(urlSegmentToInstagramId(shortcode));
    console.log("deletion successful");
    return res.redirect(req.body.link);
  } else {
    console.log("request denied: incorrect mod key");
    return res.redirect('/');
  }
});
app.post("/modpost", function(req, res) {
  console.log("received mod post request " + req.body.mod);
  if (req.body.key === process.env.MOD_KEY) {
    createImage(req.body.mod, '#b20000');
    return res.redirect('/submitted');
  } else {
    console.log("request denied: incorrect mod key");
    return res.redirect('/');
  }
})

app.get("/", function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});
app.get("/submitted", function(request, response) {
  log("submission", getClientIP(request));
  response.sendFile(__dirname + '/views/submitted.html');
});
app.get("/delete", function(request, response) {
  response.sendFile(__dirname + '/views/delete.html');
});
app.get("/modpost", function(request, response) {
  response.sendFile(__dirname + '/views/modpost.html');
});
app.get("/comment", function(request, response) {
  response.sendFile(__dirname + '/views/comment.html');
});
app.get("/commented", function(request, response) {
  response.sendFile(__dirname + '/views/commented.html');
});

http.listen(3000);
