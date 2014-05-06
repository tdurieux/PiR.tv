/**
 * Module dependencies.
 */

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , path = require('path')
  , io = require('socket.io').listen(server)
  , spawn = require('child_process').spawn
  , omx = require('omxcontrol'),
  NodeCEC = require('nodecec');



// all environments
app.set('port', process.env.TEST_PORT || 8080);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(omx());

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//Routes
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

app.get('/remote', function (req, res) {
  res.sendfile(__dirname + '/public/remote.html');
});

app.get('/play/:video_id', function (req, res) {

});


//Socket.io Config
io.set('log level', 1);

server.listen(app.get('port'), function(){
  console.log('Pirate TV is running on port ' + app.get('port'));
});

var ss;

//Run and pipe shell script output
function run_shell(cmd, args, cb, end) {
    var spawn = require('child_process').spawn,
        child = spawn(cmd, args),
        me = this;
    child.stdout.on('data', function (buffer) { cb(me, buffer); });
    child.stdout.on('end', end);
}

var cec = new NodeCEC();
// start cec connection
cec.start();

cec.on('ready', function(data) {
    console.log("ready...");
    sendMessage("cecready",data);
});

cec.on('status', function(data) {
  sendMessage("cecstatus",data);
  sendMessage("ceclog","[" + data.id + "] changed from " + data.from + " to " + data.to);
   console.log("[" + data.id + "] changed from " + data.from + " to " + data.to);
});

cec.on('key', function(data) {
    console.log(data.name);
    sendMessage("ceckey",data);
    if(data.name == "select") {
      sendControll("enter");
    } else if(data.name === "left"){
      sendControll("goLeft");
    } else if(data.name === "right"){
      sendControll("goRight");
    }
});

cec.on('close', function(code) {
    sendMessage("ceclog",'close: '+code);
});

cec.on('error', function(data) {
  sendMessage("ceclog",'---------------- ERROR ------------------\n'+data+'\n-----------------------------------------')
    console.log('---------------- ERROR ------------------');
    console.log(data);
    console.log('-----------------------------------------');
});

var remote;
var ss;
var sendMessage = function(type, message){
  if(ss)
    ss.emit(type,message);
};

var sendControll = function(action) {
  if(ss != undefined){
    ss.emit("controlling", {action:action});
  }
};
//Socket.io Server
io.sockets.on('connection', function (socket) {
 socket.on("screen", function(data){
   socket.type = "screen";
   ss = socket;
   console.log("Screen ready...");
 });
 socket.on("remote", function(data){
  remote = socket;
  socket.type = "remote";
  console.log("Remote ready...");
 });

 socket.on("controll", function(data){
	console.log(data);
   if(socket.type === "remote"){

     if(data.action === "tap"){
      sendControll("enter");
     }
     else if(data.action === "swipeLeft"){
      sendControll("goLeft");
     }
     else if(data.action === "swipeRight"){
      sendControll("goRight");
     }
   }
 });

 socket.on("video", function(data){

    if( data.action === "play"){
    var id = data.video_id,
         url = "http://www.youtube.com/watch?v="+id;

    var runShell = new run_shell('youtube-dl',['-o','%(id)s.%(ext)s','-f','/18/22',url],
        function (me, buffer) {
            me.stdout += buffer.toString();
            socket.emit("loading",{output: me.stdout});
            console.log(me.stdout);
         },
        function () {
            //child = spawn('omxplayer',[id+'.mp4']);
            omx.start(id+'.mp4');
        });
    }

 });
});


