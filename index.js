"use strict";
var ip=require('ip');
var net=require('net');
var dns=require('dns');
var events=require('events');
var EventEmitter=events.EventEmitter;
var net = require('net');

var LineIO = require('./lineIO.js');

/* config stuff */
// telnet -b 10.177.135.184 173.203.205.61 25

/* hey it's config */

var ENVIRONMENTS= [
  'LISTEN_PORT',
  'LISTEN_ADDRESS',
  'SOURCE_ADDRESS',
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

var ips={};
//format:
/*
ips= {
  //the key is a ip-to-long #
  123445677: [last_bad_Datetime, count?, ]
}
*/

net.createServer(function (conn) {
  var remote_ip=conn.remoteAddress;
  remote_ip="127.0.0.2"; // or '1' - or whatever you like
  remote_ip="0.0.0.1";
  //internal IP lookup
  var internal_lookup=ips[ip.toLong(remote_ip)];
  if(internal_lookup) {
    conn.end("YOU ARE IN BAD PLACE");
    console.warn("IP DB: ",ips);
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
      ips[ip.toLong(remote_ip)]=[new Date(),"poop"];
    }
    var internet=new LineIO(conn);
    internet.write("220 MailShield v"+VERSION+" - tread lightly");
    var client=net.connect({
      host: env.MAIL_ADDRESS,
      port: 25,
      localAddress: "192.168.72.241"// "localhost"//"127.0.0.1" //env.SOURCE_ADDRESS
    });
    client.on('error',function (err) {
      console.warn("ERRRRRRRROOOOORRRRR: ",err);
    });
    client.on('connect',function () {
      var server=new LineIO(client);
      server.once('line',function (throwaway) {
        console.warn("Here's the server's welcome line: "+throwaway);
        server.on('line',function (line) {
          console.warn("READING IN: "+line);
          internet.write(line);
        });
        internet.on('line',function (line) {
          console.warn("ABOUT TO SEND OUT: "+line);
          server.write(line);
        });
      });
    });
  });
  //End Spamhaus
}).listen(env.LISTEN_PORT,env.LISTEN_ADDRESS);
