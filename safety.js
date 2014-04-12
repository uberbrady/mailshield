"use strict";

var net=require('net');

//HORRIBLE copy-paste
var server_connect_blob={
  host: process.env.MAIL_ADDRESS,
  port: 25,
};

if(process.env.SOURCE_ADDRESS) {
  server_connect_blob.localAddress= process.env.SOURCE_ADDRESS
}

//I think I'll do some other configuration checks here -
//missing environment variables, etc.

//JUNKY quick'n'dirty safety check
//I can't let open relays out on to the internet
//it'd just be irresponsible

var client=net.connect(server_connect_blob);
client.on('error',function (err) {
  console.warn("ERRRRRRRROOOOORRRRR: ",err);
});
client.on('connect',function () {
  client.once('readable',function () {
    var greeting=client.read();
    console.warn("GReeting line: "+greeting);
    client.write("HELO whatever\r\n",function () {
      client.once('readable',function() {
        var answer=client.read();
        console.warn("HELO result: "+answer);
        client.write("MAIL FROM:<sample@example.com>\r\n",function () {
          client.once('readable',function () {
            var answer2=client.read();
            console.warn("MAIL FROM result: "+answer2);
            client.write("RCPT TO:<sample@example.com>\r\n",function () {
              client.once('readable',function () {
                var results=client.read();
                console.warn("RCPT TO result: "+results);
                if(results.toString().match(/^2\d\d/)) {
                  console.log("YOUR CONFIGURATION IS AN OPEN RELAY");
                  console.log("REFUSING TO START!");
                  process.exit();
                } else if(results.toString().match(/^5\d\d/)) {
                  console.log("SAFE CONFIGURATION - you are not an open relay");
                } else {
                  console.log("UNKNOWN configuration - forcing exit");
                  process.exit();
                }
                client.end("QUIT\r\n");
              });
            });
          })
        })
      });
    });
  });
});
