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
  var linecount=0;
  var line_end;
  var line_emitter=function () {
    if(buffer.indexOf("\r\n") !== -1) {
      linecount++;
      line_end=buffer.indexOf("\r\n");
      console.warn("FOUND line end at: "+line_end);
      var chunk_to_emit=buffer.substring(0,line_end);
      console.warn("Chunk to emit '"+chunk_to_emit+"'");
      that.emit('line',chunk_to_emit);
      buffer=buffer.slice(line_end+2); //skip past the \r\n
      console.warn("Remaining buffer: '"+buffer+"'");
      process.nextTick(line_emitter);
      if(linecount>10) {
        throw new Error("TOO MANY LINES IN ONE PACKET!")
      }
    }
  };
  this.conn.on('readable',function () {
    linecount=0; //reset linecount!
    buffer+=that.conn.read();
    line_emitter();
  });
  this.conn.on('end',function () {
    that.emit("end");
  });
}

util.inherits(LineIO, events.EventEmitter);

LineIO.prototype.write= function (line) {
  this.conn.write(line+"\r\n");
};

LineIO.prototype.end=function (optional) {
  this.write(optional);
  this.conn.end();
};

module.exports=LineIO;
