"use strict";
var net=require('net');
var dns=require('dns');
var events=require('events');
var EventEmitter=events.EventEmitter;
var net = require('net');

var LineIO = require('./lineIO.js');
var IPstore = require('./IPstore.js');

var cfg = require ('./configuration.json');

var safety = require ('./safety.js');

var blacklist = new IPstore(cfg.ip.blacklist_threshhold);
var bad_recipients = new IPstore(cfg.ip.bad_recipients_threshhold,cfg.ip.bad_recipients);
var mail_sends = new IPstore(cfg.ip.message_send_threshhold,cfg.ip.message_sends);
var bad_auths = new IPstore(cfg.ip.bad_auth_threshhold,cfg.ip.bad_auths);

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
  bad_recipients.debug();
  console.warn("Mail Sends:");
  mail_sends.debug();
  console.warn("Bad Auths:");
  bad_auths.debug();
});

net.createServer(function (internet_conn) {
  var remote_ip=internet_conn.remoteAddress;
  var internet=new LineIO(internet_conn);
  //remote_ip="127.0.0.2";
  var internal_lookup=blacklist.lookup(remote_ip);
  var rejector=function (reason) {
    internet.write("550 IP "+remote_ip+" is temporarily blocked because of "+reason);
    internet.removeAllListeners('line');
    internet.on('line',function (line) {
      if(line === "QUIT") {
        internet.end("221 Goodbye");
      } else {
        internet.write("503 bad sequence of commands");
      }
    });
    console.log("MAIL BLOCKED FROM "+remote_ip+" due to: "+reason);
  }
  if(internal_lookup) {
    rejector("cached blacklist");
    return;
  }

  if(bad_recipients.lookup(remote_ip)) {
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
    internet.write("220 MailShield v"+VERSION+" - tread lightly",function () {
      blacklist.debug();
      var server=new LineIO(net.connect(server_connect_blob));
      server.on('error',function (err) {
        console.warn("ERRRRRRRROOOOORRRRR: ",err);
        server.end();

      });
      server.on('connect',function () {
        server.on('end',function () {
          console.warn("The mailserver has closed the connection, so we will too.");
          internet.end();
        });
        internet.on('end',function () {
          server.end();
        });
        internet.on('error',function (err) {
          switch(err.name) {
            case "LengthError":
              internet.write("500 Line too long.")
              break;

            default:
              internet.write("500 Unknown Error: "+err.name);
          }
        });
        var startline=function (throwaway) {
          var mode=null;
          var authed=false;
          console.warn("Here's the server's welcome line: "+throwaway);
          var readwriteline=function() {
            console.warn("Readwriteline invoked?")
            internet.once('line',function (line) {
              console.warn("ABOUT TO SEND OUT: "+line);
              if(line.match(/^RCPT TO/)) {
                if(pbl && !authed) {
                  console.log("IP:",remote_ip,"Blocked by PBL and unauthenticated access requested");
                  internet.write("530 5.7.0 Authentication required");
                  readwriteline();
                  return;
                } else {
                  mode="RCPT";
                }
              }
              if(line.match(/^AUTH/)) {
                mode="AUTH";
              }
              if(line.match(/^DATA$/)) {
                mode="DATA";
              }
              console.warn("Engaging Mode: "+mode);
              server.write(line,function () {
                server.once('line',function (line) {
                  console.warn("READING FROM REAL SERVER: "+line);
                  switch(mode) {
                    case "RCPT":
                      console.warn("Reading in the results of RCPT TO:");
                      if(line.match(/^5\d\d/)) {
                        console.warn("BAD RECIPIENT!!!! TIME TO BREAK SOME STUFF!");
                        bad_recipients.store(remote_ip);
                        if(bad_recipients.lookup(remote_ip)) {
                          rejector("excessive bad recipient attempts");
                          return;
                        }
                      }
                      if(line.match(/^2\d\d/)) {
                        console.warn("GOOD RECIPIENT!!! Better note it still");
                        mail_sends.store(remote_ip);
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

                    case "DATA":
                      console.warn("RETURNING FOR DATA MODE!");
                      var datamode=function () {
                        console.warn("Continuing Data Mode");
                        internet.once('line',function (line) {
                          console.warn("INTERNET LINE IS: '"+line+"'");
                          if(line === ".") {
                            console.warn("LINE IS: '"+line+"' - ");
                            server.write(line,function () {
                              server.once('line',function (line) {
                                console.warn("Line from server is: "+line);
                                internet.write(line,readwriteline);
                              });
                            });
                          } else {
                            server.write(line,datamode);
                          }
                        });
                      };
                      internet.write(line,function () {
                        datamode();
                      });
                      return;
                      break;
                  }
                  internet.write(line,readwriteline);
                });
              });
            });
          };
          internet.once('line',function (greeting) {
            if(greeting.match(/^EHLO/)) {
              internet.write("500 Extended Hello Function not supported yet; use HELO",function () {
                startline("Retrying from failed EHLO greeting...");
              });
            } else if(greeting.match(/^HELO/)) {
              server.write(greeting,function () {
                server.once('line',function (line) {
                  internet.write(line,function () {
                    readwriteline();
                  })
                })
              });
            }
          })
        };
        server.once('line',startline);
      });
    });
  });
  //End Spamhaus
}).listen(env.LISTEN_PORT,env.LISTEN_ADDRESS);
