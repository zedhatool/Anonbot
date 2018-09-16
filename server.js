require('dotenv').config();
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);
var ref = require('instagram-id-to-url-segment');
let date = require('date-and-time');
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
var Airtable = require('airtable');
var logs = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('appDowHJJVQTHNJfk');
var blacklist = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('applZHoMDx5uF9h1Z');

function createImage(text, fillStyle, ip) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var formatted = wrap(text, {indent: '', width: 28});
  var truncated = formatted.length > 355 ? formatted.substr(0, 356) + "\u2026" : formatted;
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '62px "SourceCodePro"';
  ctx.fillStyle = '#FFF';
  ctx.fillText(truncated, 17, 65);

  var buf = canvas.toBuffer();
  fs.writeFileSync("submission.png", buf);

  //convert to jpeg because currently api only supports jpeg
  let buffer = fs.readFileSync("./submission.png");
  pngToJpeg()(buffer)
    .then(output => fs.writeFile("./submission.jpeg", output, function(err) {
      if (err) console.log(err);
      fs.exists("./submission.jpeg", function(exists) {
        if (exists) publish(text, ip);
      })
    }));
  fs.unlinkSync('./submission.png');
}

function publish(caption, ip) {
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
  log(caption, ip);
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

function log(caption, ip) {
  var now = new Date();
  // set to eastern time
  now.setTime(now.getTime()+now.getTimezoneOffset()*60*1000);
  var estDate = new Date(now.getTime() + -240*60*1000);
  let formattedDate = date.format(estDate, 'YYYY/MM/DD HH:mm:ss');

  logs('Anonbot Logs').create({
    "Time": formattedDate,
    "Post": caption,
    "IP": ip
  }, function(err, record) {
    if (err) { console.error(err); return; }
    console.log("new log created! " + record.getId());
  })
}

function getClientIP(req){ // Anonbot logs IPs for safety & moderation
  var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',');
  return ip[0];
}

var isBanned = function(address) {
  var banned = false;
  return new Promise(function(resolve, reject) {
    blacklist('Blacklist').select({
      view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {
      records.forEach(function(record) {
        if (record.get('IP') === address) {
          console.log("User with IP " + address + " tried to access the site, but is banned!");
          banned = true;
        }
      })
      fetchNextPage();
    }, function done(err) {
      if (err) reject(err);
      resolve(banned);
    })
  })
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
  if (req.body.anon === "") return res.redirect('/');
  createImage(req.body.anon, '#404040', getClientIP(req));
  return res.redirect('/submitted');
});
app.post("/postcomment", function(req, res) {
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
    var shortcode = getShortcode(req.body.url);
    delPost(urlSegmentToInstagramId(shortcode));
    console.log("deletion successful");
    return res.redirect(req.body.url);
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
app.post("/banip", function(req, res) {
  console.log("receieved ban request for IP " + req.body.ip);
  if (req. body.key === process.env.MOD_KEY) {
    blacklist('Blacklist').create({
      "IP": req.body.ip,
      "Reason": req.body.reason
    }, function(err) {
      if (err) { console.error(err); return; }
      console.log("banned " + req.body.ip);
      res.redirect('/banned');
    })
  } else {
    console.log("request denied: incorrect mod key");
    return res.redirect('/');
  }
})

app.get("/", function(request, response) {
  isBanned(getClientIP(request)).then(function(banned) {
    if (banned) return response.sendFile(__dirname + '/views/banned.html');
    else return response.sendFile(__dirname + '/views/index.html');
  })
});
app.get("/submitted", function(request, response) {
  response.sendFile(__dirname + '/views/submitted.html');
});
app.get("/delete", function(request, response) {
  response.sendFile(__dirname + '/views/delete.html');
});
app.get("/modpost", function(request, response) {
  response.sendFile(__dirname + '/views/modpost.html');
});
app.get("/comment", function(request, response) {
  isBanned(getClientIP(request)).then(function(banned) {
    if (banned) return response.sendFile(__dirname + '/views/banned.html');
    else return response.sendFile(__dirname + '/views/comment.html');
  })
});
app.get("/commented", function(request, response) {
  response.sendFile(__dirname + '/views/commented.html');
});
app.get("/ban", function(requrest, response) {
  response.sendFile(__dirname + '/views/ban.html');
})

http.listen(3000);
