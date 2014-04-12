"use strict";
//handy routines for line-oriented communications protocols
var events=require("events");
var util=require("util");


function LineIO(myconn) //inherits-from...
{
  this.conn=myconn;
  var buffer='';
  var that=this;
  events.EventEmitter.call(this);
  this.conn.on('readable',function () {
    buffer+=that.conn.read();
    var line_end;
    var linecount=0;
    while(buffer.indexOf("\r\n") !== -1) {
      linecount++;
      line_end=buffer.indexOf("\r\n");
      console.warn("FOUND line end at: "+line_end);
      var chunk_to_emit=buffer.substring(0,line_end);
      console.warn("Chunk to emit '"+chunk_to_emit+"'");
      that.emit('line',chunk_to_emit);
      buffer=buffer.slice(line_end+2); //skip past the \r\n
      console.warn("Remaining buffer: '"+buffer+"'");
      if(linecount>10) {
        console.warn("TOO MANY LINES IN ONE PACKET!")
        process.exit();
      }
    }

  });
  this.conn.on('end',function () {
    that.emit("end");
  });
}

util.inherits(LineIO, events.EventEmitter);

LineIO.prototype.write= function (line) {
  this.conn.write(line+"\r\n");
};

LineIO.prototype.end=function () {
  this.conn.end();
};

module.exports=LineIO;
