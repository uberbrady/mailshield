"use strict";
var net=require('net');
var dns=require('dns');
var events=require('events');
var EventEmitter=events.EventEmitter;
var net = require('net');

var LineIO = require('./lineIO.js');
var IPstore = require('./IPstore.js');

/* config stuff */
// telnet -b 10.177.135.184 173.203.205.61 25

/* hey it's config */

var ENVIRONMENTS= [
  'LISTEN_PORT',
  'LISTEN_ADDRESS',
//  'SOURCE_ADDRESS',
  'MAIL_ADDRESS'
];

var env=process.env;

for(var e in ENVIRONMENTS) {
  if(!env[ENVIRONMENTS[e]]) {
    console.warn(ENVIRONMENTS[e]+" is not defined, cannot run.");
    process.exit(-1);
  }
}

var VERSION=process.env.npm_package_version;

var spamhaus={
  "127.0.0.2": ["SBL",  "Spamhaus SBL Data"],
  "127.0.0.3": ["SBL",	"Spamhaus SBL CSS Data"],
  "127.0.0.4": ["XBL",	"CBL Data"],
  "127.0.0.10":["PBL",	"ISP Maintained"],
  "127.0.0.11":["PBL",	"Spamhaus Maintained"]
};

var server_connect_blob={
  host: env.MAIL_ADDRESS,
  port: 25,
};

if(env.SOURCE_ADDRESS) {
  server_connect_blob.localAddress= env.SOURCE_ADDRESS
}

process.on('SIGUSR2',function() {
  IPstore.debug();
});

net.createServer(function (conn) {
  var remote_ip=conn.remoteAddress;
  remote_ip="127.0.0.2";
  var internal_lookup=IPstore.lookup(remote_ip);
  if(internal_lookup) {
    conn.end("YOU ARE IN BAD PLACE");
    return;
  }


  //Spamhaus Lookup
  var octets=remote_ip.split(".");
  var blname=octets.reverse().join(".")+".zen.spamhaus.org";

  var sbl_xbl=null;
  var pbl=null;

  console.warn("BL name:",blname);
  dns.resolve(blname,function (err,addr, family) {
    console.warn("Err: ",err,"addr:",addr,"family",family);
    if(err) {
      //uhm, we dunno?
      //one 'err' might be (can't talk to server)
      //or "no entry" - either way, let it thru!
    } else {
      for(var i in addr) {
        var entry=spamhaus[addr[i]]
        if(entry) {
          console.warn("Lookup FOUND: ",entry[0],entry[1]);
          if(entry[0]=="PBL") {
            pbl=true;
          } else {
            sbl_xbl=true;
          }
        }
      }
    }
    if(!sbl_xbl) {
      sbl_xbl=false;
    }
    if(!pbl) {
      pbl=false;
    }
    console.warn("FINAL STATUS: PBL?: ",pbl," SBL-XBL?: ",sbl_xbl);
    if(sbl_xbl) {
      IPstore.store(remote_ip,'BLACKLIST');
    }
    var internet=new LineIO(conn);
    internet.write("220 MailShield v"+VERSION+" - tread lightly");
    IPstore.debug();
    var client=net.connect(server_connect_blob);
    client.on('error',function (err) {
      console.warn("ERRRRRRRROOOOORRRRR: ",err);
    });
    client.on('connect',function () {
      client.on('end',function () {
        internet.end();
      });
      internet.on('end',function () {
        client.end();
      })
      var server=new LineIO(client);
      server.once('line',function (throwaway) {
        var mode=null;
        console.warn("Here's the server's welcome line: "+throwaway);
        server.on('line',function (line) {
          console.warn("READING IN: "+line);
          switch(mode) {
            case "RCPT":
            console.warn("Reading in the results of RCPT TO:");
            if(line.match(/^5\d\d/)) {
              console.warn("BAD RECIPIENT!!!! TIME TO BREAK SOME SHIT!");
              IPstore.store(remote_ip,'BAD_RCPT');
            }
            if(line.match(/^2\d\d/)) {
              console.warn("GOOD RECIPIENT!!! Better note it still");
              IPstore.store(remote_ip,'GOOD_RCPT');
            }
            mode=null; //reset mode back to null! done with recipients for now
            break;
          }
          internet.write(line);
        });
        internet.on('line',function (line) {
          console.warn("ABOUT TO SEND OUT: "+line);
          if(line.match(/^RCPT TO/)) {
            console.warn("RCPT TO MODE ENGAGED!");
            mode="RCPT";
          }
          server.write(line);
        });
      });
    });
  });
  //End Spamhaus
}).listen(env.LISTEN_PORT,env.LISTEN_ADDRESS);
