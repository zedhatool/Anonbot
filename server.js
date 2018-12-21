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
var sha256 = require('crypto-js/sha256');

function createSubmission(text, fillStyle, ip, isResponse, responseText) {
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
      if (exists && isResponse) publish(responseText, ip, isResponse);
      else if (exists && !isResponse) publish(text, ip, isResponse);
    })
  }));
  fs.unlinkSync('./submission.png');
}
function createResponse(text, originalText, ip) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var formatted = wrap(text, {indent: '', width: 28});
  var truncated = formatted.length > 355 ? formatted.substr(0, 356) + "\u2026" : formatted;
  ctx.fillStyle = "#c6c6c6";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.font = '62px "SourceCodePro"';
  ctx.fillStyle = '#000';
  ctx.fillText(truncated, 17, 65);

  var buf = canvas.toBuffer();
  fs.writeFileSync("response.png", buf);

  let buffer = fs.readFileSync("./response.png");
  pngToJpeg()(buffer)
  .then(output => fs.writeFile("./response.jpeg", output, function(err) {
    if (err) console.log(err);
    fs.exists("./response.jpeg", function(exists) {
      if (exists) createSubmission(originalText, '#404040', ip, true, text + "\n---\n" + originalText);
    })
  }));
  fs.unlinkSync('./response.png');
}

function publish(caption, ip, isResponse) {
  if (isResponse) {
    var photos = [
      {
        type: 'photo',
        size: [1000,1000],
        data: './response.jpeg'
      },
      {
        type: 'photo',
        size: [1000,1000],
        data: './submission.jpeg'
      }
    ], disabledComments = false;
    Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
    .then(function(session) {
      Client.Upload.album(session, photos)
      .then(function(payload) {
        console.log("Uploaded new response!");
        Client.Media.configureAlbum(session, payload, caption, disabledComments)
      })
    })
  }
  else {
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
  }
  log(caption, ip);
}

function postComment(id, comment) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
    console.log("posted comment " + comment);
    return Client.Comment.create(session, ''+id, comment);
  })
}

function postReponse(url, comment, ip) {
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
    return Client.Media.getByUrl(session, url)
    .then(function(data) {
      createResponse(comment, data._params.caption, ip);
    })
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
    "IP Hash": ""+sha256(ip)
  }, function(err, record) {
    if (err) { console.error(err); return; }
    console.log("new log created! " + record.getId());
  })
}

function getClientIP(req){ // Anonbot logs IPs for safety & moderation
  var ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(',');
  return ip[0];
}

function determineIfBanned(address) {
  var banned = false;
  return new Promise(function(resolve, reject) {
    blacklist('Blacklist').select({
      view: "Grid view"
    }).eachPage(function page(records, fetchNextPage) {
      records.forEach(function(record) {
        if (record.get('IP Hash') === ""+sha256(address)) {
          console.log("A banned user tried to access the site!");
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
  console.log("received submission " + req.body.anon);
  if (req.body.anon === "") return res.redirect('/');
  createSubmission(req.body.anon, '#404040', getClientIP(req), false);
  return res.redirect('/submitted');
});
app.post("/postcomment", function(req, res) {
  var commentString = req.body.comment.split('::');
  var comment = commentString[0];
  var commentType = commentString[1];
  console.log("received comment " + comment + " type " + commentType + " on " + req.body.url);
  var shortcode = getShortcode(req.body.url);
  Client.Session.create(device, storage, 'anonbot.wl', process.env.ANON_PASSWORD)
  .then(function(session) {
     return Client.Media.getByUrl(session, ''+req.body.url)
     .then(function(data) {
       if (data._params.user.username === "anonbot.wl") {
         if (commentType === "comm") postComment(urlSegmentToInstagramId(shortcode), comment);
         else postReponse(req.body.url, comment, getClientIP(req));
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
    createSubmission(req.body.mod, '#b20000', false);
    return res.redirect('/submitted');
  } else {
    console.log("request denied: incorrect mod key");
    return res.redirect('/');
  }
})
app.post("/banip", function(req, res) {
  console.log("received ban request for IP " + req.body.ip);
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
  determineIfBanned(getClientIP(request)).then(function(banned) {
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
app.get("/respond", function(request, response) {
  determineIfBanned(getClientIP(request)).then(function(banned) {
    if (banned) return response.sendFile(__dirname + '/views/banned.html');
    else return response.sendFile(__dirname + '/views/respond.html');
  })
});
app.get("/commented", function(request, response) {
  response.sendFile(__dirname + '/views/commented.html');
});
app.get("/ban", function(request, response) {
  response.sendFile(__dirname + '/views/ban.html');
})
app.get("/banned", function(request, response) {
  response.sendFile(__dirname + '/views/banned.html');
});

http.listen(3000);
