"use strict";
var net=require('net');
var dns=require('dns');
var events=require('events');
var EventEmitter=events.EventEmitter;
var net = require('net');

var LineIO = require('./lineIO.js');
var IPstore = require('./IPstore.js');

var cfg = require ('./configuration.json');

var blacklist = new IPstore(cfg.ip.blacklist_threshhold);
var bad_recipient = new IPstore(cfg.ip.bad_recipients_threshhold,cfg.ip.bad_recipients);
var mail_sends = new IPstore(cfg.ip.message_send_threshhold,cfg.ip.message_sends);
var bad_auth = new IPstore(cfg.ip.bad_auth_threshhold,cfg.ip.bad_auths);

/* config stuff */

/* hey it's config */

var ENVIRONMENTS= [
  'LISTEN_PORT',
  'LISTEN_ADDRESS',
//  'SOURCE_ADDRESS', (optional)
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
  console.warn("BLACKLIST:");
  blacklist.debug();
  console.warn("Bad recips:");
  bad_recipient.debug();
  console.warn("Mail Sends:");
  mail_sends.debug();
});

net.createServer(function (conn) {
  var remote_ip=conn.remoteAddress;
  var internet=new LineIO(conn);
  //remote_ip="127.0.0.2";
  var internal_lookup=blacklist.lookup(remote_ip);
  var rejector=function (reason) {
    internet.write("550 IP "+remote_ip+" is temporarily blocked because of "+reason);
    internet.end(); //violation of RFC2821 section 3.1
    console.log("MAIL BLOCKED FROM "+remote_ip+" due to: "+reason);
  }
  if(internal_lookup) {
    rejector("cached blacklist");
    return;
  }

  if(bad_recipient.lookup(remote_ip)) {
    rejector("excessive bad recipient attempts (cached)"); //"More than "+x+"bad recipient attempts in "+y+"seconds/minutes/hours"
    return;
  }

  if(mail_sends.lookup(remote_ip)) {
    rejector("Attempt to send extremely excessive amounts of mail");
    return;
  }

  if(bad_auths.lookup(remote_ip)) {
    rejector("authentication fails");
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
      blacklist.store(remote_ip);
      rejector("blacklist");
      return;
    }
    internet.write("220 MailShield v"+VERSION+" - tread lightly");
    blacklist.debug();
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
        var authed=false;
        console.warn("Here's the server's welcome line: "+throwaway);
        server.on('line',function (line) {
          console.warn("READING IN: "+line);
          switch(mode) {
            case "RCPT":
              console.warn("Reading in the results of RCPT TO:");
              if(line.match(/^5\d\d/)) {
                console.warn("BAD RECIPIENT!!!! TIME TO BREAK SOME SHIT!");
                bad_recipient.store(remote_ip);
                if(bad_recipient.lookup(remote_ip)) {
                  rejector("excessive bad recipient attempts");
                  return;
                }
              }
              if(line.match(/^2\d\d/)) {
                console.warn("GOOD RECIPIENT!!! Better note it still");
                mail_sends.store(remote_ip,'GOOD_RCPT');
              }
              mode=null; //reset mode back to null! done with recipients for now
              break;

            case "AUTH":
              if(line.match(/^5\d\d/)) {
                bad_auths.store(remote_ip);
                if(bad_auths.lookup(remote_ip)) {
                  rejector("authentication fails");
                  return;
                } else if(line.match(/^2\d\d/)) {
                  authed=true;
                }
              }
              mode=null;
              break;
          }
          internet.write(line);
        });
        internet.on('line',function (line) {
          console.warn("ABOUT TO SEND OUT: "+line);
          if(line.match(/^RCPT TO/)) {
            if(pbl && !authed) {
              internet.write("530 5.7.0 Authentication required");
              return;
            }
            mode="RCPT";
          }
          if(line.match(/^AUTH/)) {
            mode="AUTH";
          }
          if(line.match(/^DATA/) && pbl && !authed) {
            internet.write("")
          }
          console.warn("Engaging Mode: "+mode);
          server.write(line);
        });
      });
    });
  });
  //End Spamhaus
}).listen(env.LISTEN_PORT,env.LISTEN_ADDRESS);
